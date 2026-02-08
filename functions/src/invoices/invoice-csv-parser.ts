/**
 * Invoice CSV/Excel Parser
 * 
 * Smart parsing that:
 * 1. AI analyzes sample rows → generates column mapping rules
 * 2. Code programmatically extracts ALL rows using those rules
 * 3. Each row becomes a separate invoice
 * 
 * 100% variable - works with ANY column names, ANY file format
 */

import { db, Timestamp } from "../config/firebase";

// ============================================
// INVOICE PARSING RULES
// ============================================

export interface InvoiceParsingRules {
  id?: string;
  
  // Structure
  headerRow: number;           // 0-indexed row containing headers
  dataStartRow: number;        // 0-indexed row where data starts
  skipFooterRows?: number;     // Footer rows to skip (totals, etc.)
  delimiter?: string;          // CSV delimiter (default: comma)
  
  // Column mappings - AI figures these out from ANY column names
  // Maps our standard field names to actual column names in the file
  columns: {
    invoiceNumber?: string;    // "Order ID", "Invoice #", "Inv No", etc.
    customerName?: string;     // "Customer Name", "Client", "Bill To", etc.
    vendorName?: string;       // "Vendor", "Supplier", "From", etc.
    invoiceDate?: string;      // "Invoice Date", "Date", "Inv Date", etc.
    dueDate?: string;          // "Due Date", "Payment Due", etc.
    amount?: string;           // "Total", "Amount", "Total Invoiced", etc.
    subtotal?: string;         // "Subtotal", "Net Amount", etc.
    tax?: string;              // "Tax", "VAT", "GST", "Total Taxes", etc.
    currency?: string;         // "Currency", "CEx ID", etc.
    status?: string;           // "Status", "Payment Status", etc.
    description?: string;      // "Description", "Memo", "Notes", etc.
    purchaseOrder?: string;    // "PO", "PO Number", "Purchase Order", etc.
    // Can add more as needed - AI discovers them
    [key: string]: string | undefined;
  };
  
  // Date parsing
  dateFormat?: string;         // "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", etc.
  
  // Amount parsing
  thousandsSeparator?: string; // "," or "." or " "
  decimalSeparator?: string;   // "." or ","
  
  // Currency extraction
  currencyFromColumn?: boolean;     // Extract currency from a column
  defaultCurrency?: string;         // Default if not found
  currencySymbols?: string[];       // Symbols to strip from amounts
  
  // Metadata
  createdBy?: string;
  createdAt?: FirebaseFirestore.Timestamp;
  sourceFileName?: string;
  
  // Sample data for reference
  sampleHeaders?: string[];
  sampleRow?: string[];
}

// ============================================
// PARSED INVOICE
// ============================================

export interface ParsedInvoice {
  invoiceNumber: string;
  customerName?: string;
  vendorName?: string;
  invoiceDate: string;        // YYYY-MM-DD
  dueDate?: string;           // YYYY-MM-DD
  amount: number;
  subtotal?: number;
  tax?: number;
  currency: string;
  status?: string;
  description?: string;
  purchaseOrder?: string;
  // Additional fields from the row
  additionalFields?: Record<string, any>;
  // Original row for debugging
  rawRow: string[];
  rowIndex: number;
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parse a CSV/Excel file using AI-generated rules
 * Extracts ALL rows as individual invoices
 */
export function parseInvoiceCSVWithRules(
  csvContent: string,
  rules: InvoiceParsingRules
): { invoices: ParsedInvoice[]; warnings: string[] } {
  const warnings: string[] = [];
  const invoices: ParsedInvoice[] = [];
  
  // Split into lines
  const delimiter = rules.delimiter || ",";
  const lines = csvContent.split("\n").map(line => line.trim()).filter(Boolean);
  
  if (lines.length === 0) {
    return { invoices: [], warnings: ["Empty file"] };
  }
  
  // Parse headers
  const headerLine = lines[rules.headerRow] || lines[0];
  const headers = parseCSVLine(headerLine, delimiter);
  
  console.log("=== INVOICE CSV PARSING ===");
  console.log("Total lines:", lines.length);
  console.log("Headers:", JSON.stringify(headers));
  console.log("Column mappings:", JSON.stringify(rules.columns));
  
  // Get column indices from rules
  const colIndices: Record<string, number> = {};
  for (const [field, colName] of Object.entries(rules.columns)) {
    if (colName) {
      const idx = getColumnIndex(colName, headers);
      colIndices[field] = idx;
      console.log(`  ${field}: "${colName}" -> index ${idx}`);
    }
  }
  
  // Parse data rows
  const dataStart = rules.dataStartRow ?? (rules.headerRow + 1);
  const dataEnd = rules.skipFooterRows ? lines.length - rules.skipFooterRows : lines.length;
  
  console.log(`Parsing rows ${dataStart} to ${dataEnd} (${dataEnd - dataStart} data rows)`);
  
  let skippedCount = 0;
  
  for (let i = dataStart; i < dataEnd; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    
    try {
      const row = parseCSVLine(line, delimiter);
      
      // Extract fields using column indices
      const invoiceNumber = getValue(row, colIndices.invoiceNumber) || `ROW-${i + 1}`;
      const amount = parseAmount(getValue(row, colIndices.amount), rules);
      
      // Skip rows with no invoice number AND no amount
      if (!invoiceNumber && amount === 0) {
        skippedCount++;
        continue;
      }
      
      // Parse dates
      const invoiceDate = parseDate(
        getValue(row, colIndices.invoiceDate), 
        rules.dateFormat
      ) || new Date().toISOString().split("T")[0];
      
      const dueDate = parseDate(
        getValue(row, colIndices.dueDate),
        rules.dateFormat
      );
      
      // Parse currency
      let currency = rules.defaultCurrency || "USD";
      if (colIndices.currency !== undefined && colIndices.currency !== -1) {
        const currencyVal = getValue(row, colIndices.currency);
        if (currencyVal) {
          // Extract currency code (e.g., "AWG: Aruban florin" -> "AWG")
          const match = currencyVal.match(/^([A-Z]{3})/);
          if (match) {
            currency = match[1];
          } else {
            currency = currencyVal.trim().toUpperCase().substring(0, 3);
          }
        }
      }
      
      // Build invoice object
      const invoice: ParsedInvoice = {
        invoiceNumber: cleanValue(invoiceNumber) || `ROW-${i + 1}`,
        customerName: cleanValue(getValue(row, colIndices.customerName)),
        vendorName: cleanValue(getValue(row, colIndices.vendorName)),
        invoiceDate,
        dueDate: dueDate || undefined,
        amount,
        subtotal: parseAmount(getValue(row, colIndices.subtotal), rules) || undefined,
        tax: parseAmount(getValue(row, colIndices.tax), rules) || undefined,
        currency,
        status: cleanValue(getValue(row, colIndices.status)),
        description: cleanValue(getValue(row, colIndices.description)),
        purchaseOrder: cleanValue(getValue(row, colIndices.purchaseOrder)),
        rawRow: row,
        rowIndex: i,
      };
      
      // Capture any additional mapped fields
      const additionalFields: Record<string, any> = {};
      for (const [field, idx] of Object.entries(colIndices)) {
        if (!["invoiceNumber", "customerName", "vendorName", "invoiceDate", "dueDate", 
              "amount", "subtotal", "tax", "currency", "status", "description", "purchaseOrder"].includes(field)) {
          const val = getValue(row, idx);
          if (val) {
            additionalFields[field] = cleanValue(val);
          }
        }
      }
      if (Object.keys(additionalFields).length > 0) {
        invoice.additionalFields = additionalFields;
      }
      
      invoices.push(invoice);
      
    } catch (err) {
      warnings.push(`Row ${i + 1}: Parse error - ${err}`);
    }
  }
  
  console.log(`Parsed ${invoices.length} invoices, skipped ${skippedCount} empty rows`);
  console.log("===========================");
  
  return { invoices, warnings };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse a CSV line respecting quoted fields
 */
function parseCSVLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Get column index from column name
 */
function getColumnIndex(column: string | number | undefined, headers: string[]): number {
  if (column === undefined || column === null) return -1;
  if (typeof column === "number") return column;
  
  const colLower = column.toLowerCase().trim();
  
  // Exact match
  const exactIdx = headers.findIndex(h => h && h.toLowerCase().trim() === colLower);
  if (exactIdx !== -1) return exactIdx;
  
  // Partial match
  const partialIdx = headers.findIndex(h => 
    h && (h.toLowerCase().includes(colLower) || colLower.includes(h.toLowerCase()))
  );
  return partialIdx;
}

/**
 * Get value from row at index
 */
function getValue(row: string[], index: number | undefined): string {
  if (index === undefined || index === -1 || index >= row.length) return "";
  return row[index] || "";
}

/**
 * Clean a value - remove quotes, trim
 */
function cleanValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "").trim() || undefined;
}

/**
 * Parse date string to YYYY-MM-DD
 */
function parseDate(dateStr: string | undefined, format?: string): string | null {
  if (!dateStr) return null;
  
  const cleaned = dateStr.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned) return null;
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }
  
  const parts = cleaned.split(/[-/.\s]+/);
  if (parts.length < 3) return null;
  
  let year: string, month: string, day: string;
  const fmt = (format || "").toUpperCase();
  
  if (fmt.startsWith("YYYY")) {
    [year, month, day] = parts;
  } else if (fmt.startsWith("DD")) {
    [day, month, year] = parts;
  } else if (fmt.startsWith("MM")) {
    [month, day, year] = parts;
  } else {
    // Auto-detect
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else {
      // Assume MM/DD/YYYY for US format
      [month, day, year] = parts;
    }
  }
  
  // Convert month name to number
  if (isNaN(parseInt(month, 10))) {
    month = monthNameToNumber(month);
  }
  
  // Convert 2-digit year
  if (year.length === 2) {
    const y = parseInt(year, 10);
    year = y > 50 ? `19${year}` : `20${year}`;
  }
  
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  
  return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function monthNameToNumber(month: string): string {
  const months: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };
  return months[month.toLowerCase()] || month;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string | undefined, rules: InvoiceParsingRules): number {
  if (!amountStr) return 0;
  
  let cleaned = amountStr.trim();
  
  // Remove currency symbols
  cleaned = cleaned.replace(/[$€£¥₹₽AWG|XCG|ANG|USD|EUR]/gi, "");
  
  // Handle negative formats: (1234.56) or -1234.56
  const isNegative = cleaned.includes("(") || cleaned.startsWith("-");
  cleaned = cleaned.replace(/[()]/g, "").replace(/^-/, "");
  
  // Handle thousands/decimal separators
  if (rules.thousandsSeparator === "." && rules.decimalSeparator === ",") {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (rules.thousandsSeparator === ",") {
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Auto-detect
    if (cleaned.indexOf(",") > cleaned.indexOf(".") && cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  
  // Remove any remaining non-numeric chars
  cleaned = cleaned.replace(/[^\d.-]/g, "");
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : (isNegative ? -num : num);
}

// ============================================
// SAVE PARSING RULES
// ============================================

export async function saveInvoiceParsingRules(
  rules: Omit<InvoiceParsingRules, "id" | "createdAt">
): Promise<string> {
  const docRef = await db.collection("invoice_parsing_rules").add({
    ...rules,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getInvoiceParsingRules(rulesId: string): Promise<InvoiceParsingRules | null> {
  const doc = await db.collection("invoice_parsing_rules").doc(rulesId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as InvoiceParsingRules;
}
