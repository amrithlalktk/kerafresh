import { formatBillNumber } from "@/lib/money";
import { formatDate } from "@/lib/date";
import type { Expense } from "@/lib/types";

export type TxType = "SALE" | "PURCHASE";
export type TxRow = {
  type: TxType;
  billNumber: number;
  date: string;
  partyName: string;
  itemsLabel: string;
  totalCents: number;
  paidCents: number;
  taxCents: number;
};

// One row per taxed item line (not per bill) — a single bill can mix items
// at different tax rates, so this is the level of detail that actually
// answers "how much tax on this item".
export type TaxLineRow = {
  type: TxType;
  billNumber: number;
  date: string;
  partyName: string;
  itemName: string;
  quantity: number;
  taxPercent: number;
  taxCents: number;
};

export function defaultFrom() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
export function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export const EXPENSE_HEADER = [
  "Date",
  "Description",
  "Category",
  "Amount",
  "Payment Method",
  "Recorded By",
  "Notes",
];
export function expenseRows(expenses: Expense[]) {
  return expenses.map((e) => [
    formatDate(e.date),
    e.description,
    e.category.name,
    (e.amountCents / 100).toFixed(2),
    e.paymentMethod ?? "",
    e.recordedBy.name,
    e.notes ?? "",
  ]);
}

export const TX_HEADER = ["Type", "Bill #", "Date", "Party", "Items", "Total", "Paid", "Balance"];
export function txCsvRows(rows: TxRow[]) {
  return rows.map((r) => [
    r.type,
    formatBillNumber(r.billNumber),
    formatDate(r.date),
    r.partyName,
    r.itemsLabel,
    (r.totalCents / 100).toFixed(2),
    (r.paidCents / 100).toFixed(2),
    ((r.totalCents - r.paidCents) / 100).toFixed(2),
  ]);
}

export const TX_TAX_HEADER = ["Type", "Bill #", "Date", "Party", "Item", "Qty", "Tax %", "Tax Amount"];
export function taxLineCsvRows(rows: TaxLineRow[]) {
  return rows.map((r) => [
    r.type,
    formatBillNumber(r.billNumber),
    formatDate(r.date),
    r.partyName,
    r.itemName,
    String(r.quantity),
    String(r.taxPercent),
    (r.taxCents / 100).toFixed(2),
  ]);
}
