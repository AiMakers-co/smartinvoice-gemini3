/**
 * Public Demo API for Smart Data Extractor
 * Extracts dynamic metadata + tabular data from any document
 * Uses the same dynamic metadata approach as the authenticated Cloud Function
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");


export async function POST(request: NextRequest) {
  try {

    const { fileData, mimeType } = await request.json();

    if (!fileData) {
      return NextResponse.json({ error: "No file data provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Dynamic metadata prompt — same philosophy as the authenticated Cloud Function
    const scanPrompt = `You are an expert document analyzer. Analyze this document and extract:
1. ALL key metadata/information present on the document
2. Tabular data that can be extracted into a spreadsheet

METADATA EXTRACTION (critical — extract EVERY piece of key information you find):
Scan the ENTIRE visible document for metadata. This is DYNAMIC — different documents have different info.

Examples of what to look for (include ALL that are present, skip what's not):
- Entity names: supplier/vendor name, customer/recipient name, bank name, merchant name, account holder
- References: invoice number, PO number, receipt number, account number, statement number
- Dates: document date, invoice date, due date, period start, period end, receipt date
- Financial: currency (ISO code), subtotal, total amount, tax/VAT amount, tax rate, discount, opening balance, closing balance, total credits, total debits
- Payment info: IBAN, BIC/SWIFT, bank name, payment terms, payment method
- Tax: VAT/tax number, tax registration, KVK number
- Contact: address, city, country, phone, email, website
- Other: any other clearly important info visible on the document

Each metadata item must have:
- "label": Human-readable name (e.g., "Supplier", "Invoice Number", "Currency", "Total Amount")
- "value": The extracted value as a string (for numbers, still use string like "2258.08")
- "category": One of "entity", "reference", "date", "financial", "payment", "tax", "contact", "other"

TABLE EXTRACTION:
Also extract the tabular/repeated data into headers + rows.

For each header:
- name: Clean column name (e.g., "Date", "Description", "Amount")
- type: One of "string", "number", "date", "currency", "boolean"
- description: Brief description
- example: An example value

Return ONLY valid JSON:
{
  "documentType": "string (e.g., 'Bank Statement', 'Invoice', 'Bill', 'Receipt', 'Report', 'Other')",
  "metadata": [
    { "label": "string", "value": "string", "category": "entity|reference|date|financial|payment|tax|contact|other" }
  ],
  "headers": [
    { "name": "string", "type": "string|number|date|currency|boolean", "description": "string", "example": "string" }
  ],
  "rows": [
    { "ColumnName": "value" }
  ],
  "pageCount": number,
  "confidence": number (0-1),
  "isExtractable": boolean,
  "warnings": ["string"]
}

IMPORTANT:
- The metadata array must contain EVERY key piece of info found — be thorough
- For currency in metadata, use the 3-letter ISO 4217 code (e.g., "EUR" not "€")
- The "rows" array must contain ALL extracted data rows from the ENTIRE document, not just a sample
- For dashes in amount columns, use null
- ALWAYS return valid JSON`;

    const scanResponse = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: scanPrompt },
          { inlineData: { mimeType: mimeType || "application/pdf", data: fileData } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    });

    const scanText = scanResponse.response.text();
    let scanResult: any;
    
    try {
      scanResult = JSON.parse(scanText);
    } catch {
      const jsonMatch = scanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scanResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse document analysis");
      }
    }

    // Check if document is extractable
    if (scanResult.isExtractable === false || !scanResult.headers || scanResult.headers.length === 0) {
      return NextResponse.json({
        success: false,
        error: "This document doesn't contain extractable tabular data.",
        documentType: scanResult.documentType,
        metadata: scanResult.metadata || [],
      });
    }

    // Validate metadata
    const validCategories = new Set(["entity", "reference", "date", "financial", "payment", "tax", "contact", "other"]);
    const metadata = (scanResult.metadata || [])
      .filter((m: any) => m && m.label && m.value)
      .map((m: any) => ({
        label: String(m.label),
        value: String(m.value),
        category: validCategories.has(m.category) ? m.category : "other",
      }));

    // Derive convenience fields from metadata for backward compat
    const findMeta = (labels: string[]): string | null => {
      const lower = labels.map(l => l.toLowerCase());
      const item = metadata.find((m: any) => lower.some((l: string) => m.label.toLowerCase().includes(l)));
      return item?.value || null;
    };

    const rows = scanResult.rows || [];

    return NextResponse.json({
      success: true,
      
      // Dynamic metadata
      metadata,
      
      // Document classification
      documentType: scanResult.documentType,
      confidence: scanResult.confidence,
      pageCount: scanResult.pageCount || 1,
      
      // Backward-compat convenience fields (derived from metadata)
      currency: findMeta(["currency"]),
      supplierName: findMeta(["supplier", "vendor"]),
      bankName: findMeta(["bank name"]),
      totalAmount: (() => {
        const v = findMeta(["total amount", "total"]);
        return v ? parseFloat(v) : null;
      })(),
      
      // Table data
      headers: scanResult.headers,
      rows,
      rowCount: rows.length,
      
      // Warnings
      warnings: scanResult.warnings || [],
    });

  } catch (error) {
    console.error("Demo extraction error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Extraction failed. Please try again.",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Smart Data Extractor",
  });
}
