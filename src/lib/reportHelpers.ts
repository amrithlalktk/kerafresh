import { useEffect, useState } from "react";
import { formatBillNumber } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { accountName, type Account, type Expense, type PaymentLine } from "@/lib/types";

// Joins whatever explanatory notes a bill's payments carry (e.g. the
// "X paid — Y applied as advance to next bill" / "From X overpayment on
// Bill #Y" notes set in the sales/purchases payments routes and the advance
// sweep) into one cell, so reports carry the same split explanation the
// on-screen payment history shows.
export function paymentRemarks(payments: PaymentLine[]) {
  return payments
    .map((p) => p.notes)
    .filter((n): n is string => Boolean(n))
    .join(" | ");
}

export type TxType = "SALE" | "PURCHASE";
export type TxRowItem = { name: string; quantity: number; priceCents: number };
export type TxRow = {
  id: string;
  type: TxType;
  billNumber: number;
  date: string;
  partyName: string;
  items: TxRowItem[];
  totalCents: number;
  paidCents: number;
  taxCents: number;
  remarks: string;
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
export function expenseRows(expenses: Expense[], accounts: Pick<Account, "id" | "name">[]) {
  return expenses.map((e) => [
    formatDate(e.date),
    e.description,
    e.category.name,
    (e.amountCents / 100).toFixed(2),
    e.paymentMethod ? accountName(accounts, e.paymentMethod) : "",
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
  "Weight",
  "Price",
  "Item Amount",
  "Total",
  "Paid",
  "Balance",
  "Remarks",
];
// One row per item line (not per bill) — a bill with 3 items becomes 3 rows,
// each repeating the bill's own reference/party/date so the item they
// belong to is unambiguous. The bill-level Total/Paid/Balance/Remarks only
// appear on that bill's first item row (blank after) so summing the column
// in a spreadsheet doesn't double-count a multi-item bill. A bill with no
// items (shouldn't normally happen) still gets one row so it isn't dropped.
export function txCsvRows(rows: TxRow[]) {
  return rows.flatMap((r) => {
    const items = r.items.length > 0 ? r.items : [{ name: "", quantity: 0, priceCents: 0 }];
    return items.map((item, i) => [
      i === 0 ? r.type : "",
      i === 0 ? formatBillNumber(r.billNumber) : "",
      i === 0 ? formatDate(r.date) : "",
      i === 0 ? r.partyName : "",
      item.name,
      item.name ? String(item.quantity) : "",
      item.name ? (item.priceCents / 100).toFixed(2) : "",
      item.name ? ((item.quantity * item.priceCents) / 100).toFixed(2) : "",
      i === 0 ? (r.totalCents / 100).toFixed(2) : "",
      i === 0 ? (r.paidCents / 100).toFixed(2) : "",
      i === 0 ? ((r.totalCents - r.paidCents) / 100).toFixed(2) : "",
      i === 0 ? r.remarks : "",
    ]);
  });
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
