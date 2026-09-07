export type TransactionType = "INCOME" | "EXPENSE";
export type PartyType = "CUSTOMER" | "SUPPLIER" | "BOTH";
export type PaymentMethod = "CASH" | "BANK";

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
  item: { name: string; unit: string };
  quantity: number;
  priceCents: number;
  lineTotalCents: number;
};

export type ChargeLine = {
  id: string;
  chargeTypeId: string | null;
  label: string;
  amountCents: number;
};

export type PaymentLine = {
  id: string;
  date: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  notes: string | null;
};

export type Sale = {
  id: string;
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
};

export type Purchase = {
  id: string;
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
