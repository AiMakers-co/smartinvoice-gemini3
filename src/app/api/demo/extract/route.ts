/**
 * Public Demo API for Smart Data Extractor
 * Extracts rich metadata + tabular data from any document
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Simple in-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3; // 3 extractions per day per IP
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const { allowed, remaining } = checkRateLimit(clientIP);
    
    if (!allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Sign up for unlimited extractions!",
          signupUrl: "/login"
        },
        { status: 429 }
      );
    }

    const { fileData, mimeType } = await request.json();

    if (!fileData) {
      return NextResponse.json({ error: "No file data provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Comprehensive scan prompt
    const scanPrompt = `You are an expert document analyzer. Analyze this document and extract ALL available information.

FIRST, determine the document type, then extract the appropriate metadata.

=== FOR BANK STATEMENTS ===
Extract:
- bankName: Full bank name (e.g., "Chase Bank", "Bank of America", "HSBC")
- bankCountry: Country code (e.g., "US", "UK", "NL")
- accountNumber: Full account number (mask middle digits for privacy display)
- accountHolderName: Account holder's name
- accountType: "checking" | "savings" | "credit" | "investment"
- currency: Currency code (USD, EUR, GBP, etc.)
- periodStart: Statement start date (YYYY-MM-DD)
- periodEnd: Statement end date (YYYY-MM-DD)
- openingBalance: Opening balance (number)
- closingBalance: Closing balance (number)
- totalCredits: Sum of all credits/deposits (number)
- totalDebits: Sum of all debits/withdrawals (number)
- transactionCount: Total number of transactions

=== FOR INVOICES/BILLS ===
Extract:
- supplierName: Company name issuing the invoice
- supplierAddress: Supplier's address
- customerName: Customer/recipient name
- invoiceNumber: Invoice/bill number
- invoiceDate: Invoice date (YYYY-MM-DD)
- dueDate: Payment due date (YYYY-MM-DD)
- subtotal: Subtotal before tax (number)
- taxAmount: Tax amount (number)
- totalAmount: Total amount due (number)
- currency: Currency code
- paymentTerms: Payment terms (e.g., "Net 30")

=== FOR RECEIPTS ===
Extract:
- merchantName: Store/merchant name
- merchantAddress: Store address
- receiptDate: Receipt date (YYYY-MM-DD)
- receiptNumber: Receipt/transaction number
- totalAmount: Total amount (number)
- currency: Currency code
- paymentMethod: Payment method used

=== FOR ALL DOCUMENTS ===
Also extract:
- documentType: "Bank Statement" | "Invoice" | "Bill" | "Receipt" | "Credit Card Statement" | "Financial Report" | "Purchase Order" | "Expense Report" | "Other"
- pageCount: Number of pages
- confidence: 0.0-1.0 confidence score
- headers: Array of column headers for the tabular data
- rows: First 7 rows of ACTUAL DATA from the document. Each row is an object with header names as keys and the actual cell values.
- totalRowCount: Estimated total rows in document
- isExtractable: true if document has tabular data

IMPORTANT: The "rows" array must contain the actual extracted data values, not empty objects!

Return ONLY valid JSON:
{
  "documentType": "string",
  "pageCount": number,
  "confidence": number,
  "isExtractable": boolean,
  
  "bankName": "string or null",
  "bankCountry": "string or null",
  "accountNumber": "string or null",
  "accountHolderName": "string or null",
  "accountType": "string or null",
  "currency": "string or null",
  "periodStart": "string or null",
  "periodEnd": "string or null",
  "openingBalance": number or null,
  "closingBalance": number or null,
  "totalCredits": number or null,
  "totalDebits": number or null,
  "transactionCount": number or null,
  
  "supplierName": "string or null",
  "supplierAddress": "string or null",
  "customerName": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "string or null",
  "dueDate": "string or null",
  "subtotal": number or null,
  "taxAmount": number or null,
  "totalAmount": number or null,
  "paymentTerms": "string or null",
  
  "merchantName": "string or null",
  "merchantAddress": "string or null",
  "receiptDate": "string or null",
  "receiptNumber": "string or null",
  "paymentMethod": "string or null",
  
  "headers": [
    { "name": "Date", "type": "date", "example": "2024-01-15" },
    { "name": "Description", "type": "string", "example": "Payment received" },
    { "name": "Amount", "type": "currency", "example": "-150.00" }
  ],
  "rows": [
    { "Date": "2024-01-15", "Description": "Payment received", "Amount": 500.00 },
    { "Date": "2024-01-16", "Description": "Transfer out", "Amount": -150.00 }
  ],
  "totalRowCount": 25
}`;

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
        maxOutputTokens: 8192,
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
        remaining,
      });
    }

    // Use rows from scan result (single API call - no second extraction needed for demo)
    const rows = scanResult.rows || [];

    // Return rich response
    return NextResponse.json({
      success: true,
      
      // Document metadata
      documentType: scanResult.documentType,
      confidence: scanResult.confidence,
      pageCount: scanResult.pageCount || 1,
      
      // Bank statement fields
      bankName: scanResult.bankName,
      bankCountry: scanResult.bankCountry,
      accountNumber: scanResult.accountNumber,
      accountHolderName: scanResult.accountHolderName,
      accountType: scanResult.accountType,
      currency: scanResult.currency,
      periodStart: scanResult.periodStart,
      periodEnd: scanResult.periodEnd,
      openingBalance: scanResult.openingBalance,
      closingBalance: scanResult.closingBalance,
      totalCredits: scanResult.totalCredits,
      totalDebits: scanResult.totalDebits,
      transactionCount: scanResult.transactionCount,
      
      // Invoice/Bill fields
      supplierName: scanResult.supplierName,
      supplierAddress: scanResult.supplierAddress,
      customerName: scanResult.customerName,
      invoiceNumber: scanResult.invoiceNumber,
      invoiceDate: scanResult.invoiceDate,
      dueDate: scanResult.dueDate,
      subtotal: scanResult.subtotal,
      taxAmount: scanResult.taxAmount,
      totalAmount: scanResult.totalAmount,
      paymentTerms: scanResult.paymentTerms,
      
      // Receipt fields
      merchantName: scanResult.merchantName,
      merchantAddress: scanResult.merchantAddress,
      receiptDate: scanResult.receiptDate,
      receiptNumber: scanResult.receiptNumber,
      paymentMethod: scanResult.paymentMethod,
      
      // Table data (first 7 rows from single API call)
      headers: scanResult.headers,
      rows: rows,
      rowCount: rows.length,
      totalRowCount: scanResult.totalRowCount || rows.length,
      
      remaining,
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
    service: "Smart Data Extractor Demo",
    rateLimit: `${RATE_LIMIT_MAX} extractions per ${RATE_LIMIT_WINDOW / (60 * 60 * 1000)} hours`
  });
}
