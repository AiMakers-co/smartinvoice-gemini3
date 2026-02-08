/**
 * CSV Parsing Rules System
 * 
 * Smart CSV parsing that:
 * 1. Uses AI to analyze first 10 rows and generate parsing rules
 * 2. Stores rules per bank type for reuse
 * 3. Applies rules programmatically (fast, no AI needed)
 * 4. Normalizes bank names to avoid duplicates
 */

import { db, Timestamp } from "../config/firebase";
import { Timestamp as TimestampType } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// ============================================
// BANK NAME NORMALIZATION
// ============================================

/**
 * Known bank name variations mapped to canonical names
 * Add new banks as they're discovered
 */
const BANK_NAME_MAPPINGS: Record<string, string[]> = {
  // Caribbean banks
  "Maduro & Curiel's Bank": [
    "Maduro Curiels Bank",
    "Maduro and Curiels Bank",
    "Maduro & Curiel's Bank",
    "Maduro and Curiel's Bank",
    "Maduro & Curiels Bank",
    "MCB Bank",
    "MCB",
    "MCBBANK",
  ],
  "RBC Royal Bank": [
    "RBC",
    "Royal Bank of Canada",
    "RBC Royal Bank",
    "RBC Bank",
    "RBCROYALBANK",
  ],
  "Scotiabank": [
    "Scotia Bank",
    "Bank of Nova Scotia",
    "BNS",
    "SCOTIABANK",
  ],
  "FirstCaribbean": [
    "First Caribbean",
    "FirstCaribbean International Bank",
    "FCIB",
    "CIBC FirstCaribbean",
  ],
  "Orco Bank": [
    "ORCO",
    "Orco Bank N.V.",
    "ORCOBANK",
  ],
  
  // US banks
  "Chase": [
    "JPMorgan Chase",
    "JP Morgan Chase",
    "Chase Bank",
    "CHASE",
  ],
  "Bank of America": [
    "BofA",
    "BOA",
    "Bank of America N.A.",
    "BANKOFAMERICA",
  ],
  "Wells Fargo": [
    "WellsFargo",
    "Wells Fargo Bank",
    "WELLSFARGO",
  ],
  "Citibank": [
    "Citi",
    "Citigroup",
    "CITIBANK",
  ],
  
  // European banks
  "HSBC": [
    "HSBC Bank",
    "Hong Kong Shanghai Bank",
    "HSBCBANK",
  ],
  "Barclays": [
    "Barclays Bank",
    "BARCLAYS",
  ],
  "ING": [
    "ING Bank",
    "ING Direct",
    "INGBANK",
  ],
  
  // Payment processors (often appear in CSVs)
  "Stripe": [
    "Stripe Inc",
    "Stripe Payments",
    "STRIPE",
  ],
  "PayPal": [
    "PayPal Inc",
    "PAYPAL",
  ],
  "Wise": [
    "TransferWise",
    "Wise Payments",
    "WISE",
  ],
};

/**
 * Normalize a bank name to its canonical form
 * Returns the canonical name if found, otherwise returns cleaned version of input
 */
export function normalizeBankName(bankName: string): string {
  if (!bankName) return "Unknown Bank";
  
  // Clean the input: lowercase, remove extra spaces, remove special chars
  const cleaned = bankName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // Check against known mappings
  for (const [canonical, variations] of Object.entries(BANK_NAME_MAPPINGS)) {
    const normalizedVariations = variations.map(v => 
      v.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
    );
    
    if (normalizedVariations.includes(cleaned)) {
      return canonical;
    }
    
    // Also check if canonical name matches
    const normalizedCanonical = canonical
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    
    if (normalizedCanonical === cleaned) {
      return canonical;
    }
  }
  
  // If no match found, return title-cased version of input
  return bankName
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generate a unique bank identifier from bank name
 * Used for matching parsing rules
 */
export function getBankIdentifier(bankName: string): string {
  const normalized = normalizeBankName(bankName);
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// ============================================
// CSV PARSING RULES
// ============================================

export interface CSVParsingRules {
  id?: string;
  bankIdentifier: string;      // Normalized bank identifier
  bankDisplayName: string;     // Human-readable bank name
  
  // Structure
  headerRow: number;           // 0-indexed row number containing headers
  dataStartRow: number;        // 0-indexed row where data starts
  skipFooterRows?: number;     // Number of footer rows to skip
  delimiter?: string;          // CSV delimiter (default: comma)
  
  // Column mappings (can be column name string OR 0-indexed number)
  dateColumn: string | number;
  dateFormat: string;          // e.g., "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"
  descriptionColumn: string | number;
  
  // Amount can be single column or split debit/credit
  amountColumn?: string | number;       // Single amount column (negative = debit)
  debitColumn?: string | number;        // Separate debit column
  creditColumn?: string | number;       // Separate credit column
  amountFormat?: "sign" | "absolute";   // Whether amounts have signs or are always positive
  
  // Optional columns
  balanceColumn?: string | number;
  referenceColumn?: string | number;
  categoryColumn?: string | number;
  
  // Amount parsing
  thousandsSeparator?: string;   // "," or "." or " "
  decimalSeparator?: string;     // "." or ","
  currencySymbol?: string;       // "$", "€", etc. (to strip)
  
  // Type detection for single amount column
  typeDetection?: "sign" | "keyword" | "column";  // How to determine debit/credit
  debitKeywords?: string[];      // Keywords indicating debit
  creditKeywords?: string[];     // Keywords indicating credit
  
  // Metadata
  createdBy: string;            // userId who created
  createdAt: TimestampType;
  confirmedAt?: TimestampType;      // When user confirmed
  usageCount: number;           // How many times used
  lastUsedAt?: TimestampType;
  
  // Sample data for reference
  sampleHeaders?: string[];
  sampleRow?: string[];
}

/**
 * Find existing parsing rules for a bank
 */
export async function findParsingRules(
  userId: string,
  bankName: string
): Promise<CSVParsingRules | null> {
  const bankId = getBankIdentifier(bankName);
  
  // First check user's own rules
  const userRulesQuery = await db.collection("csv_parsing_rules")
    .where("bankIdentifier", "==", bankId)
    .where("createdBy", "==", userId)
    .where("confirmedAt", "!=", null)
    .limit(1)
    .get();
  
  if (!userRulesQuery.empty) {
    const doc = userRulesQuery.docs[0];
    return { id: doc.id, ...doc.data() } as CSVParsingRules;
  }
  
  // Fall back to any confirmed rules for this bank (from other users)
  const globalRulesQuery = await db.collection("csv_parsing_rules")
    .where("bankIdentifier", "==", bankId)
    .where("confirmedAt", "!=", null)
    .orderBy("usageCount", "desc")
    .limit(1)
    .get();
  
  if (!globalRulesQuery.empty) {
    const doc = globalRulesQuery.docs[0];
    return { id: doc.id, ...doc.data() } as CSVParsingRules;
  }
  
  return null;
}

/**
 * Save new parsing rules (unconfirmed)
 */
export async function saveParsingRules(
  rules: Omit<CSVParsingRules, "id" | "createdAt" | "usageCount">
): Promise<string> {
  const docRef = await db.collection("csv_parsing_rules").add({
    ...rules,
    createdAt: Timestamp.now(),
    usageCount: 0,
  });
  return docRef.id;
}

/**
 * Confirm parsing rules (user approved)
 */
export async function confirmParsingRules(rulesId: string): Promise<void> {
  await db.collection("csv_parsing_rules").doc(rulesId).update({
    confirmedAt: Timestamp.now(),
  });
}

/**
 * Increment usage count for rules
 */
export async function incrementRulesUsage(rulesId: string): Promise<void> {
  await db.collection("csv_parsing_rules").doc(rulesId).update({
    usageCount: (await db.collection("csv_parsing_rules").doc(rulesId).get()).data()?.usageCount + 1 || 1,
    lastUsedAt: Timestamp.now(),
  });
}

// ============================================
// CSV PARSING ENGINE
// ============================================

export interface ParsedTransaction {
  date: string;           // YYYY-MM-DD
  description: string;
  amount: number;
  type: "credit" | "debit";
  balance?: number;
  reference?: string;
  category?: string;
  rawRow: string[];       // Original row for debugging
}

/**
 * Parse a CSV file using the provided rules
 * This is the fast, programmatic parser - no AI needed
 */
export function parseCSVWithRules(
  csvContent: string,
  rules: CSVParsingRules
): { transactions: ParsedTransaction[]; warnings: string[] } {
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];
  let debugCount = 0;
  
  // Split into lines
  const delimiter = rules.delimiter || ",";
  const lines = csvContent.split("\n").map(line => line.trim()).filter(Boolean);
  
  if (lines.length === 0) {
    return { transactions: [], warnings: ["Empty CSV file"] };
  }
  
  // Parse headers
  const headerLine = lines[rules.headerRow] || lines[0];
  const headers = parseCSVLine(headerLine, delimiter);
  
  // Determine column indices (getColumnIndex handles null/undefined)
  const dateIdx = getColumnIndex(rules.dateColumn, headers);
  const descIdx = getColumnIndex(rules.descriptionColumn, headers);
  const amountIdx = getColumnIndex(rules.amountColumn, headers);
  const debitIdx = getColumnIndex(rules.debitColumn, headers);
  const creditIdx = getColumnIndex(rules.creditColumn, headers);
  const balanceIdx = getColumnIndex(rules.balanceColumn, headers);
  const refIdx = getColumnIndex(rules.referenceColumn, headers);
  
  // Debug logging
  console.log("=== CSV PARSING DEBUG ===");
  console.log("Total lines:", lines.length);
  console.log("Headers:", JSON.stringify(headers));
  console.log("Rules dateColumn:", rules.dateColumn, "-> index:", dateIdx);
  console.log("Rules descColumn:", rules.descriptionColumn, "-> index:", descIdx);
  console.log("Rules amountColumn:", rules.amountColumn, "-> index:", amountIdx);
  console.log("Rules debitColumn:", rules.debitColumn, "-> index:", debitIdx);
  console.log("Rules creditColumn:", rules.creditColumn, "-> index:", creditIdx);
  console.log("Rules balanceColumn:", rules.balanceColumn, "-> index:", balanceIdx);
  console.log("Rules headerRow:", rules.headerRow, "dataStartRow:", rules.dataStartRow);
  console.log("=========================");
  
  // Validate required columns
  if (dateIdx === -1) {
    warnings.push(`Date column "${rules.dateColumn}" not found`);
  }
  if (descIdx === -1) {
    warnings.push(`Description column "${rules.descriptionColumn}" not found`);
  }
  if (amountIdx === -1 && debitIdx === -1 && creditIdx === -1) {
    warnings.push("No amount column found");
  }
  
  // Parse data rows
  const dataStart = rules.dataStartRow ?? (rules.headerRow !== undefined ? rules.headerRow + 1 : 1);
  const dataEnd = rules.skipFooterRows ? lines.length - rules.skipFooterRows : lines.length;
  
  console.log(`Parsing rows ${dataStart} to ${dataEnd} (${dataEnd - dataStart} rows)`);
  
  // Log first data row for debugging
  if (lines[dataStart]) {
    const firstRow = parseCSVLine(lines[dataStart], delimiter);
    console.log("First data row:", JSON.stringify(firstRow.slice(0, 8)));
  }
  
  for (let i = dataStart; i < dataEnd; i++) {
    const line = lines[i];
    if (!line || line.trim().length === 0) continue;
    
    try {
      const row = parseCSVLine(line, delimiter);
      
      // Skip if row doesn't have enough columns
      if (row.length < Math.max(dateIdx, descIdx, amountIdx, debitIdx, creditIdx) + 1) {
        continue;
      }
      
      // Parse date
      const dateStr = row[dateIdx] || "";
      const parsedDate = parseDate(dateStr, rules.dateFormat || "auto");
      if (!parsedDate) {
        if (debugCount < 3) console.log(`SKIP row ${i + 1}: Invalid date "${dateStr}" (format: ${rules.dateFormat})`);
        warnings.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
        debugCount++;
        continue;
      }
      
      // Parse description
      const description = (row[descIdx] || "").trim();
      if (!description) {
        if (debugCount < 3) console.log(`SKIP row ${i + 1}: No description at index ${descIdx}`);
        debugCount++;
        continue; // Skip rows without description
      }
      
      // Parse amount
      let amount = 0;
      let type: "credit" | "debit" = "debit";
      
      if (amountIdx !== -1) {
        // Single amount column
        amount = parseAmount(row[amountIdx], rules);
        
        if (rules.amountFormat === "sign" || rules.typeDetection === "sign") {
          // Negative = debit, positive = credit
          type = amount < 0 ? "debit" : "credit";
          amount = Math.abs(amount);
        } else if (rules.typeDetection === "keyword") {
          // Check keywords in description
          const descLower = description.toLowerCase();
          const isDebit = rules.debitKeywords?.some(kw => descLower.includes(kw.toLowerCase()));
          type = isDebit ? "debit" : "credit";
        }
      } else {
        // Separate debit/credit columns
        const debitAmt = debitIdx !== -1 ? parseAmount(row[debitIdx], rules) : 0;
        const creditAmt = creditIdx !== -1 ? parseAmount(row[creditIdx], rules) : 0;
        
        if (debugCount < 3) console.log(`Row ${i + 1}: debit[${debitIdx}]="${row[debitIdx]}" (${debitAmt}), credit[${creditIdx}]="${row[creditIdx]}" (${creditAmt})`);
        
        if (debitAmt > 0) {
          amount = debitAmt;
          type = "debit";
        } else if (creditAmt > 0) {
          amount = creditAmt;
          type = "credit";
        } else {
          if (debugCount < 3) console.log(`SKIP row ${i + 1}: No amount`);
          debugCount++;
          continue; // No amount
        }
      }
      
      if (amount === 0) {
        if (debugCount < 3) console.log(`SKIP row ${i + 1}: Amount is 0`);
        debugCount++;
        continue;
      }
      
      // Parse optional fields
      const balance = balanceIdx !== -1 ? parseAmount(row[balanceIdx], rules) : undefined;
      const reference = refIdx !== -1 ? (row[refIdx] || "").trim() : undefined;
      
      transactions.push({
        date: parsedDate,
        description,
        amount,
        type,
        balance: balance || undefined,
        reference: reference || undefined,
        rawRow: row,
      });
    } catch (err) {
      warnings.push(`Row ${i + 1}: Parse error - ${err}`);
    }
  }
  
  return { transactions, warnings };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse a single CSV line respecting quoted fields
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
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
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
 * Get column index from column name or index
 */
function getColumnIndex(column: string | number | null | undefined, headers: string[]): number {
  if (column === null || column === undefined) {
    return -1;
  }
  
  if (typeof column === "number") {
    return column;
  }
  
  const colLower = column.toLowerCase();
  
  // Try exact match first
  const exactIdx = headers.findIndex(h => h && h.toLowerCase() === colLower);
  if (exactIdx !== -1) return exactIdx;
  
  // Try partial match
  const partialIdx = headers.findIndex(h => 
    h && (h.toLowerCase().includes(colLower) || colLower.includes(h.toLowerCase()))
  );
  return partialIdx;
}

/**
 * Parse a date string according to the specified format
 */
function parseDate(dateStr: string, format: string): string | null {
  if (!dateStr) return null;
  
  const cleaned = dateStr.trim().replace(/['"]/g, "");
  if (!cleaned) return null;
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }
  
  const parts = cleaned.split(/[-/.\s]+/);
  if (parts.length < 3) return null;
  
  let year: string, month: string, day: string;
  const fmt = (format || "").toUpperCase();
  
  // Parse based on format
  if (fmt.startsWith("YYYY")) {
    [year, month, day] = parts;
  } else if (fmt.startsWith("DD")) {
    [day, month, year] = parts;
  } else if (fmt.startsWith("MM")) {
    [month, day, year] = parts;
  } else {
    // Auto-detect: if first part is 4 digits, assume YYYY-MM-DD
    if (parts[0].length === 4) {
      [year, month, day] = parts;
    } else {
      [day, month, year] = parts;
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
 * Parse an amount string to number
 */
function parseAmount(amountStr: string, rules: CSVParsingRules): number {
  if (!amountStr) return 0;
  
  let cleaned = amountStr.trim();
  
  // Remove currency symbol
  if (rules.currencySymbol) {
    cleaned = cleaned.replace(new RegExp(`\\${rules.currencySymbol}`, "g"), "");
  }
  // Remove common currency symbols anyway
  cleaned = cleaned.replace(/[$€£¥₹₽ANG]/g, "");
  
  // Handle negative formats: (1234.56) or -1234.56
  const isNegative = cleaned.includes("(") || cleaned.startsWith("-");
  cleaned = cleaned.replace(/[()]/g, "").replace(/^-/, "");
  
  // Handle thousands/decimal separators
  if (rules.thousandsSeparator === "." && rules.decimalSeparator === ",") {
    // European format: 1.234,56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (rules.thousandsSeparator === ",") {
    // US format: 1,234.56
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Auto-detect
    // If there's a comma after a dot, it's European
    if (cleaned.indexOf(",") > cleaned.indexOf(".") && cleaned.includes(",")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }
  
  // Remove any remaining non-numeric chars except . and -
  cleaned = cleaned.replace(/[^\d.-]/g, "");
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : (isNegative ? -num : num);
}

// ============================================
// CLOUD FUNCTIONS
// ============================================

/**
 * Confirm CSV parsing rules
 * Called after user reviews and approves the AI-generated rules
 */
export const confirmCSVParsingRules = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }
    
    const { rulesId } = request.data;
    if (!rulesId) {
      throw new HttpsError("invalid-argument", "Rules ID required");
    }
    
    const userId = request.auth.uid;
    
    // Get the rules
    const rulesDoc = await db.collection("csv_parsing_rules").doc(rulesId).get();
    if (!rulesDoc.exists) {
      throw new HttpsError("not-found", "Parsing rules not found");
    }
    
    const rules = rulesDoc.data();
    
    // Verify ownership
    if (rules?.createdBy !== userId) {
      throw new HttpsError("permission-denied", "You can only confirm your own parsing rules");
    }
    
    // Confirm the rules
    await confirmParsingRules(rulesId);
    
    return { 
      success: true, 
      message: `Parsing rules confirmed for ${rules?.bankDisplayName}` 
    };
  }
);

/**
 * Get parsing rules for a bank
 */
export const getCSVParsingRules = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }
    
    const { bankName } = request.data;
    if (!bankName) {
      throw new HttpsError("invalid-argument", "Bank name required");
    }
    
    const userId = request.auth.uid;
    const rules = await findParsingRules(userId, bankName);
    
    if (!rules) {
      return { found: false };
    }
    
    return { 
      found: true,
      rules 
    };
  }
);

/**
 * Update parsing rules (allows user to edit before confirming)
 */
export const updateCSVParsingRules = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }
    
    const { rulesId, updates } = request.data;
    if (!rulesId) {
      throw new HttpsError("invalid-argument", "Rules ID required");
    }
    
    const userId = request.auth.uid;
    
    // Get the rules
    const rulesDoc = await db.collection("csv_parsing_rules").doc(rulesId).get();
    if (!rulesDoc.exists) {
      throw new HttpsError("not-found", "Parsing rules not found");
    }
    
    const rules = rulesDoc.data();
    
    // Verify ownership
    if (rules?.createdBy !== userId) {
      throw new HttpsError("permission-denied", "You can only update your own parsing rules");
    }
    
    // Don't allow updates to confirmed rules
    if (rules?.confirmedAt) {
      throw new HttpsError("failed-precondition", "Cannot update confirmed rules");
    }
    
    // Allowed fields to update
    const allowedUpdates = [
      "headerRow", "dataStartRow", "skipFooterRows", "delimiter",
      "dateColumn", "dateFormat", "descriptionColumn",
      "amountColumn", "debitColumn", "creditColumn", "balanceColumn", "referenceColumn",
      "amountFormat", "typeDetection", "thousandsSeparator", "decimalSeparator",
    ];
    
    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key];
      }
    }
    
    await db.collection("csv_parsing_rules").doc(rulesId).update(sanitizedUpdates);
    
    return { success: true };
  }
);
