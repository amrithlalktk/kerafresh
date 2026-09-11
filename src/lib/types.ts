export type TransactionType = "INCOME" | "EXPENSE";
export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";
export type PaymentMethod = "CASH" | "BANK";
export type Role = "SUPER_ADMIN" | "ADMIN" | "STAFF";

// Super Admin has every Admin permission everywhere in the app — the only
// difference is Admins can't see or manage Super Admin accounts themselves
// (see GET/PATCH /api/users). So any "must be admin" check should pass for
// both roles; use this instead of comparing against "ADMIN" directly.
export function isAdminRole(role: Role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK: "Bank",
};

export function paymentMethodLabel(method: PaymentMethod) {
  return PAYMENT_METHOD_LABELS[method];
}

// Free Fatty Acid quality grade, offered on a Sale/Purchase line when the
// item is marked `ffaGraded` (e.g. copra/oil where FFA% affects grading).
export const FFA_GRADES = [
  "FFA-1",
  "FFA-2",
  "FFA-3",
  "FFA-4",
  "FFA-5",
  "FFA-6",
  "FFA-7",
  "FFA-8",
  "FFA-9",
  "FFA-10",
] as const;
export type FfaGrade = (typeof FFA_GRADES)[number];

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
};

// Expense — categories are expense-only, income is tracked via Sale.
export type Expense = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  categoryId: string;
  category: Category;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  recordedBy: { name: string };
};

export type Party = {
  id: string;
  name: string;
  type: PartyType;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
  openingBalanceCents: number;
  balanceCents: number;
  // Unapplied "RECEIVED" advance credit (see PartyPayment) still available
  // to settle a future sale.
  availableAdvanceCents: number;
};

export type PartyPaymentDirection = "RECEIVED" | "PAID";

// An advance payment with a party, outside of any specific Sale/Purchase.
export type PartyPayment = {
  id: string;
  partyId: string;
  date: string;
  direction: PartyPaymentDirection;
  amountCents: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
};

export type Item = {
  id: string;
  name: string;
  unit: string;
  salePriceCents: number;
  purchasePriceCents: number;
  openingStockQty: number;
  lowStockThreshold: number | null;
  currentStockQty: number;
  ffaGraded: boolean;
};

// Additional charges (lorry rent, packing charge, coolie, etc.) added on
// top of a Sale/Purchase's item total.
export type ChargeType = {
  id: string;
  name: string;
};

export type SaleItemLine = {
  id: string;
  itemId: string;
  item: { name: string; unit: string; purchasePriceCents: number };
  quantity: number;
  priceCents: number;
  lineTotalCents: number;
  taxPercent: number;
  taxCents: number;
  ffaGrade: FfaGrade | null;
};

export type ChargeLine = {
  id: string;
  chargeTypeId: string | null;
  label: string;
  amountCents: number;
};

export type PaymentSource = "CASH" | "ADVANCE";

export type PaymentLine = {
  id: string;
  date: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  source: PaymentSource;
  notes: string | null;
};

export type Sale = {
  id: string;
  billNumber: number;
  date: string;
  partyId: string | null;
  party: { name: string } | null;
  items: SaleItemLine[];
  charges: ChargeLine[];
  payments: PaymentLine[];
  totalCents: number;
  paidCents: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
  recordedBy: { name: string };
};

export type PurchaseItemLine = {
  id: string;
  itemId: string;
  item: { name: string; unit: string };
  quantity: number;
  priceCents: number;
  lineTotalCents: number;
  taxPercent: number;
  taxCents: number;
  ffaGrade: FfaGrade | null;
};

export type Purchase = {
  id: string;
  billNumber: number;
  date: string;
  partyId: string | null;
  party: { name: string } | null;
  items: PurchaseItemLine[];
  charges: ChargeLine[];
  payments: PaymentLine[];
  totalCents: number;
  paidCents: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
  recordedBy: { name: string };
};
