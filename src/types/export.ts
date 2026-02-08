// Export template types

export interface ExportColumn {
  sourceField: string;    // Our field name: "date", "description", "amount", etc.
  exportHeader: string;   // User's header name: "Transaction Date", "Memo", etc.
  included: boolean;      // Whether to include in export
}

export interface ExportTemplate {
  id: string;
  userId: string;
  name: string;
  columns: ExportColumn[];
  format: 'csv' | 'xlsx';
  createdAt: Date;
  lastUsedAt: Date;
  usageCount: number;
}

// Available fields from our transaction data
export const AVAILABLE_FIELDS = [
  { field: 'date', label: 'Date', description: 'Transaction date' },
  { field: 'description', label: 'Description', description: 'Transaction description/memo' },
  { field: 'amount', label: 'Amount', description: 'Transaction amount (+/-)' },
  { field: 'balance', label: 'Balance', description: 'Running balance' },
  { field: 'category', label: 'Category', description: 'Transaction category' },
  { field: 'vendor', label: 'Vendor', description: 'Vendor/payee name' },
  { field: 'reference', label: 'Reference', description: 'Reference number' },
  { field: 'bankName', label: 'Bank Name', description: 'Bank account name' },
  { field: 'accountNumber', label: 'Account Number', description: 'Account number' },
  { field: 'currency', label: 'Currency', description: 'Currency code' },
  { field: 'type', label: 'Type', description: 'Credit or Debit' },
] as const;

export type AvailableField = typeof AVAILABLE_FIELDS[number]['field'];

