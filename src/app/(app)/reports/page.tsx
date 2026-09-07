"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import SummaryCard from "@/components/SummaryCard";
import Card from "@/components/Card";
import SearchInput from "@/components/SearchInput";
import CategoryBreakdownChart from "@/components/CategoryBreakdownChart";
import type { Category, Expense, PaymentMethod } from "@/lib/types";

type ReportData = {
  totalExpenseCents: number;
  byCategory: { categoryId: string; name: string; totalCents: number }[];
  expenses: Expense[];
};

function defaultFrom() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(expenses: Expense[]) {
  const header = ["Date", "Description", "Category", "Amount", "Payment Method", "Recorded By", "Notes"];
  const rows = expenses.map((e) => [
    formatDate(e.date),
    e.description,
    e.category.name,
    (e.amountCents / 100).toFixed(2),
    e.paymentMethod ?? "",
    e.recordedBy.name,
    e.notes ?? "",
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map((v) => escape(String(v))).join(",")).join("\n");
}

export default function ReportsPage() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then(setCategories);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (categoryId) params.set("categoryId", categoryId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/reports?${params.toString()}`);
    setData(await res.json());
    setLoading(false);
  }, [from, to, categoryId, paymentMethod, search]);

  useEffect(() => {
    load();
  }, [load]);

  function handleExport() {
    if (!data) return;
    const csv = toCsv(data.expenses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const hasExtraFilters = Boolean(categoryId || paymentMethod || search);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Expense reporting — see Sale/Purchase for their own totals.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
              className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
            >
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">Search</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Description…" />
          </div>
          {hasExtraFilters && (
            <button
              onClick={() => {
                setCategoryId("");
                setPaymentMethod("");
                setSearch("");
              }}
              className="text-sm underline underline-offset-4"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={!data || data.expenses.length === 0}
            className="ml-auto rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
          >
            Export CSV
          </button>
        </div>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label="Total expenses" value={formatCents(data.totalExpenseCents)} tone="negative" />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Totals by category</h2>
            <Card>
              {data.byCategory.length > 0 ? (
                <CategoryBreakdownChart
                  data={data.byCategory.map((c) => ({ name: c.name, totalCents: c.totalCents }))}
                />
              ) : (
                <p className="text-sm text-black/50 dark:text-white/50">
                  No expenses match these filters.
                </p>
              )}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Expenses in range ({data.expenses.length})</h2>
            <Card className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-black/60 dark:text-white/60">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((e) => (
                      <tr key={e.id} className="border-t border-black/5 dark:border-white/5">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-3">{e.description}</td>
                        <td className="px-4 py-3">{e.category.name}</td>
                        <td className="px-4 py-3">{e.paymentMethod === "BANK" ? "Bank" : "Cash"}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-[#d03b3b]">
                          -{formatCents(e.amountCents)}
                        </td>
                      </tr>
                    ))}
                    {data.expenses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                          No expenses match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
      {loading && !data && <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>}
    </div>
  );
}
