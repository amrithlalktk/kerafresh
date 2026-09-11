"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBillNumber, formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import Card from "@/components/Card";
import SummaryCard from "@/components/SummaryCard";
import { downloadReportCsv, downloadReportPdf } from "@/lib/reportExport";
import { useDefaultDateRange } from "@/lib/reportHelpers";
import type { Sale } from "@/lib/types";

type ProfitRow = {
  billNumber: number;
  date: string;
  partyName: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
};

const HEADER = ["Bill #", "Date", "Party", "Revenue", "Cost", "Profit", "Margin %"];
function csvRows(rows: ProfitRow[]) {
  return rows.map((r) => [
    formatBillNumber(r.billNumber),
    formatDate(r.date),
    r.partyName,
    (r.revenueCents / 100).toFixed(2),
    (r.costCents / 100).toFixed(2),
    (r.profitCents / 100).toFixed(2),
    r.revenueCents > 0 ? ((r.profitCents / r.revenueCents) * 100).toFixed(1) : "0.0",
  ]);
}

export default function BillWiseProfitPage() {
  const { from, to, setFrom, setTo, ready } = useDefaultDateRange();
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedBy, setGeneratedBy] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d) => setGeneratedBy(d.name ?? ""));
  }, []);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    const res = await fetch(`/api/sales?from=${from}&to=${to}&pageSize=1000`);
    const data = await res.json();
    const sales = data.sales as Sale[];

    const computed: ProfitRow[] = sales
      .map((s) => {
        const revenueCents = s.items.reduce((sum, l) => sum + l.lineTotalCents, 0);
        const costCents = s.items.reduce(
          (sum, l) => sum + l.item.purchasePriceCents * l.quantity,
          0
        );
        return {
          billNumber: s.billNumber,
          date: s.date,
          partyName: s.party?.name ?? "Cash sale",
          revenueCents,
          costCents,
          profitCents: revenueCents - costCents,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setRows(computed);
    setLoading(false);
  }, [from, to, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenueCents, 0);
  const totalCost = rows.reduce((sum, r) => sum + r.costCents, 0);
  const totalProfit = rows.reduce((sum, r) => sum + r.profitCents, 0);

  function handleExportCsv() {
    if (rows.length === 0) return;
    downloadReportCsv({
      filename: `bill_wise_profit_${from}_to_${to}.csv`,
      title: `Bill Wise Profit (${from} to ${to})`,
      header: HEADER,
      rows: csvRows(rows),
      generatedBy,
    });
  }
  function handleExportPdf() {
    if (rows.length === 0) return;
    downloadReportPdf({
      filename: `bill_wise_profit_${from}_to_${to}.pdf`,
      title: `Bill Wise Profit (${from} to ${to})`,
      header: HEADER,
      rows: csvRows(rows),
      generatedBy,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Bill Wise Profit</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Profit per sale = sale price minus the item&apos;s current purchase price. Uses
          today&apos;s cost, not the actual historical purchase price for that stock.
        </p>
      </div>

      <Card className="print:hidden">
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
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPdf}
              disabled={rows.length === 0}
              className="rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
            >
              Export PDF
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
            >
              Print
            </button>
          </div>
        </div>
      </Card>
      <p className="hidden text-sm text-black/60 print:block">
        {from} to {to}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total revenue" value={formatCents(totalRevenue)} />
        <SummaryCard label="Total cost" value={formatCents(totalCost)} tone="negative" />
        <SummaryCard label="Total profit" value={formatCents(totalProfit)} tone="positive" />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="px-4 py-3">Bill #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.billNumber} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-4 py-3 whitespace-nowrap">#{formatBillNumber(r.billNumber)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">{r.partyName}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatCents(r.revenueCents)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatCents(r.costCents)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right whitespace-nowrap ${
                      r.profitCents >= 0 ? "text-[#0ca30c]" : "text-[#d03b3b]"
                    }`}
                  >
                    {formatCents(r.profitCents)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.revenueCents > 0 ? `${((r.profitCents / r.revenueCents) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    No sales in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
