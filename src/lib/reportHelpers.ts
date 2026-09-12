import { useEffect, useState } from "react";
import { formatBillNumber } from "@/lib/money";
import { formatDate } from "@/lib/date";
import type { Expense } from "@/lib/types";

export type TxType = "SALE" | "PURCHASE";
export type TxRowItem = { name: string; quantity: number; priceCents: number };
export type TxRow = {
  type: TxType;
  billNumber: number;
  date: string;
  partyName: string;
  items: TxRowItem[];
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

// `new Date()` can't be called during the render used for SSR/hydration —
// the server and the browser evaluate it at genuinely different instants,
// producing a text mismatch. Start blank (identical on server and first
// client render) and fill in today's real range only after mount; `ready`
// tells callers to hold off fetching until then.
export function useDefaultDateRange() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    setFrom(defaultFrom());
    setTo(defaultTo());
  }, []);
  return { from, to, setFrom, setTo, ready: from !== "" && to !== "" };
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

export const TX_HEADER = [
  "Type",
  "Bill #",
  "Date",
  "Party",
  "Item",
  "KG",
  "Price",
  "Total",
  "Paid",
  "Balance",
];
export function txCsvRows(rows: TxRow[]) {
  return rows.map((r) => [
    r.type,
    formatBillNumber(r.billNumber),
    formatDate(r.date),
    r.partyName,
    r.items.map((i) => i.name).join("; "),
    r.items.map((i) => i.quantity).join("; "),
    r.items.map((i) => (i.priceCents / 100).toFixed(2)).join("; "),
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
