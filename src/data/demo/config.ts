/**
 * Demo Account Configuration
 * 
 * Business: Coastal Creative Agency
 * A mid-size creative/marketing agency based in San Francisco
 * Works with international clients, has contractors worldwide
 */

// Demo user ID - this will be used to identify demo data in Firestore
export const DEMO_USER_ID = "demo_coastal_creative_agency";
export const DEMO_ORG_ID = "demo_org_coastal_creative";

// Business profile
export const DEMO_BUSINESS = {
  name: "Coastal Creative Agency",
  email: "demo@coastalcreative.agency",
  address: "555 Market Street, Suite 400",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
  country: "USA",
  phone: "+1 (415) 555-0123",
  website: "https://coastalcreative.agency",
  taxId: "XX-XXXXXXX",
};

// Bank accounts configuration
export const DEMO_ACCOUNTS = [
  {
    id: `${DEMO_USER_ID}_chase_operating_usd`,
    bankName: "Chase Business",
    accountName: "Operating Account",
    accountNumber: "****4521",
    accountType: "checking" as const,
    currency: "USD",
    currentBalance: 127845.32,
    availableBalance: 125345.32,
    color: "#0A4D92", // Chase blue
  },
  {
    id: `${DEMO_USER_ID}_mercury_payments_usd`,
    bankName: "Mercury",
    accountName: "Client Payments",
    accountNumber: "****8834",
    accountType: "checking" as const,
    currency: "USD",
    currentBalance: 89234.15,
    availableBalance: 89234.15,
    color: "#5851DB", // Mercury purple
  },
  {
    id: `${DEMO_USER_ID}_wise_international_multi`,
    bankName: "Wise Business",
    accountName: "International",
    accountNumber: "****2290",
    accountType: "checking" as const,
    currency: "EUR",
    currentBalance: 34521.80,
    availableBalance: 34521.80,
    color: "#00B9A0", // Wise green
  },
  {
    id: `${DEMO_USER_ID}_amex_credit`,
    bankName: "American Express",
    accountName: "Business Platinum",
    accountNumber: "****1002",
    accountType: "credit" as const,
    currency: "USD",
    currentBalance: -12450.00,
    availableBalance: 87550.00,
    creditLimit: 100000,
    color: "#006FCF", // Amex blue
  },
];

// Client names for invoices (receivables)
export const DEMO_CLIENTS = [
  { name: "Meridian Tech Solutions", location: "Austin, TX", currency: "USD" },
  { name: "Northstar Media Group", location: "New York, NY", currency: "USD" },
  { name: "Pacific Retail Partners", location: "Los Angeles, CA", currency: "USD" },
  { name: "Eurozone Digital GmbH", location: "Berlin, Germany", currency: "EUR" },
  { name: "London Brand Co Ltd", location: "London, UK", currency: "GBP" },
  { name: "Skyline Ventures", location: "Seattle, WA", currency: "USD" },
  { name: "Summit Healthcare", location: "Denver, CO", currency: "USD" },
  { name: "Aurora Fintech", location: "Miami, FL", currency: "USD" },
  { name: "Nordic Design Studio", location: "Stockholm, Sweden", currency: "EUR" },
  { name: "Maple Leaf Marketing", location: "Toronto, Canada", currency: "CAD" },
];

// Vendor names for bills (payables)
export const DEMO_VENDORS = [
  { name: "Adobe Creative Cloud", category: "Software", currency: "USD" },
  { name: "Shutterstock, Inc.", category: "Stock Media", currency: "USD" },
  { name: "Amazon Web Services", category: "Cloud Services", currency: "USD" },
  { name: "Google Workspace", category: "Software", currency: "USD" },
  { name: "WeWork", category: "Office Space", currency: "USD" },
  { name: "Figma, Inc.", category: "Design Tools", currency: "USD" },
  { name: "Slack Technologies", category: "Communication", currency: "USD" },
  { name: "Marcus Chen (Freelancer)", category: "Contractor", currency: "USD" },
  { name: "Sofia Rodriguez Design", category: "Contractor", currency: "USD" },
  { name: "TypeKit Partners", category: "Typography", currency: "EUR" },
  { name: "London Print Services Ltd", category: "Printing", currency: "GBP" },
  { name: "Envato Elements", category: "Assets", currency: "USD" },
];

// Invoice line item templates
export const INVOICE_SERVICES = [
  { description: "Brand Strategy & Research", unitPrice: 5000 },
  { description: "Logo & Visual Identity Design", unitPrice: 8500 },
  { description: "Website Design & Development", unitPrice: 15000 },
  { description: "Monthly Retainer - Marketing", unitPrice: 7500 },
  { description: "Social Media Campaign", unitPrice: 4500 },
  { description: "Video Production", unitPrice: 12000 },
  { description: "Photography (per day)", unitPrice: 2500 },
  { description: "Copywriting & Content", unitPrice: 3000 },
  { description: "UI/UX Design", unitPrice: 6000 },
  { description: "Motion Graphics", unitPrice: 4000 },
  { description: "Consultation (hourly)", unitPrice: 250 },
  { description: "Project Management", unitPrice: 2000 },
];

// Transaction description patterns
export const TRANSACTION_PATTERNS = {
  income: [
    "Wire Transfer from {client}",
    "ACH Payment - {client}",
    "Check Deposit #{ref}",
    "Stripe Payout",
    "PayPal Transfer",
    "International Wire - {client}",
    "Bank Transfer from {client}",
  ],
  expense: [
    "ACH Debit - {vendor}",
    "Card Purchase - {vendor}",
    "Wire Transfer to {vendor}",
    "Subscription - {vendor}",
    "Bill Pay - {vendor}",
    "Payroll - {employee}",
    "Office Rent",
    "Insurance Premium",
    "Tax Payment",
    "Utilities",
  ],
};

// Realistic date ranges
export const DATE_CONFIG = {
  // Demo data spans last 6 months
  startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
};

// Currency exchange rates (approximate, for demo)
export const FX_RATES = {
  EUR_USD: 1.09,
  GBP_USD: 1.27,
  CAD_USD: 0.74,
  USD_EUR: 0.92,
  USD_GBP: 0.79,
};
