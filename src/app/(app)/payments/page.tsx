"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBillNumber, formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  isAdminRole,
  paymentMethodLabel,
  type CombinedPayment,
  type Party,
  type PartyPaymentDirection,
  type PaymentMethod,
  type Purchase,
  type Sale,
} from "@/lib/types";
import { useViewerRole } from "@/lib/useViewerRole";
import Card from "@/components/Card";

type PayType = "SALE" | "PURCHASE" | "ADVANCE";

const inputClass =
  "rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-transparent";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function billLabel(bill: Sale | Purchase) {
  const balance = bill.totalCents - bill.paidCents;
  return `Bill #${formatBillNumber(bill.billNumber)} — ${bill.party?.name ?? "Cash"} — balance ${formatCents(balance)}`;
}

export default function PaymentsPage() {
  const viewerRole = useViewerRole();
  const canDelete = viewerRole !== null && isAdminRole(viewerRole);

  // --- "Record a payment" form ---
  const [payType, setPayType] = useState<PayType>("SALE");
  const [billQuery, setBillQuery] = useState("");
  const [billResults, setBillResults] = useState<(Sale | Purchase)[]>([]);
  const [selectedBill, setSelectedBill] = useState<Sale | Purchase | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState("");
  const [direction, setDirection] = useState<PartyPaymentDirection>("RECEIVED");
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- Editing an existing advance payment ---
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);

  // --- "All payments" history ---
  const [payments, setPayments] = useState<CombinedPayment[]>([]);
  const [filterType, setFilterType] = useState<PayType | "">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetch("/api/parties")
      .then((res) => res.json())
      .then(setParties);
  }, []);

  const loadHistory = useCallback(async () => {
    const params = new URLSearchParams({ page: String(historyPage) });
    if (filterType) params.set("type", filterType);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    const res = await fetch(`/api/payments?${params.toString()}`);
    const data = await res.json();
    setPayments(data.payments);
    setTotalPages(data.totalPages);
  }, [historyPage, filterType, filterFrom, filterTo]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function resetForm() {
    setBillQuery("");
    setBillResults([]);
    setSelectedBill(null);
    setPartyId("");
    setDirection("RECEIVED");
    setDate(todayStr());
    setAmount("");
    setPaymentMethod("CASH");
    setNotes("");
    setEditingAdvanceId(null);
  }

  function switchPayType(t: PayType) {
    setPayType(t);
    resetForm();
    setFormError(null);
    setSuccessMsg(null);
  }

  async function searchBills(q: string) {
    setBillQuery(q);
    setSelectedBill(null);
    if (!q.trim()) {
      setBillResults([]);
      return;
    }
    const endpoint = payType === "SALE" ? "/api/sales" : "/api/purchases";
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}&pageSize=8`);
    const data = await res.json();
    setBillResults(payType === "SALE" ? data.sales : data.purchases);
  }

  function selectBill(bill: Sale | Purchase) {
    setSelectedBill(bill);
    setBillQuery(billLabel(bill));
    setBillResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if ((payType === "SALE" || payType === "PURCHASE") && !selectedBill) {
      setFormError("Search for and select a bill to pay first");
      return;
    }
    if (payType === "ADVANCE" && !partyId) {
      setFormError("Select a party first");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFormError("Enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      let url: string;
      let method: "POST" | "PATCH" = "POST";
      const body: Record<string, unknown> = {
        date,
        amount: Number(amount),
        paymentMethod,
        notes: notes || null,
      };

      if (payType === "SALE") {
        url = `/api/sales/${selectedBill!.id}/payments`;
      } else if (payType === "PURCHASE") {
        url = `/api/purchases/${selectedBill!.id}/payments`;
      } else {
        body.direction = direction;
        if (editingAdvanceId) {
          url = `/api/parties/${partyId}/payments/${editingAdvanceId}`;
          method = "PATCH";
        } else {
          url = `/api/parties/${partyId}/payments`;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong");
        return;
      }
      setSuccessMsg(editingAdvanceId ? "Advance payment updated." : "Payment recorded.");
      resetForm();
      setHistoryPage(1);
      loadHistory();
    } finally {
      setSubmitting(false);
    }
  }

  function openEditAdvance(p: CombinedPayment) {
    setPayType("ADVANCE");
    setFormError(null);
    setSuccessMsg(null);
    setPartyId(p.partyId ?? "");
    setDirection(p.direction ?? "RECEIVED");
    setDate(p.date.slice(0, 10));
    setAmount((p.amountCents / 100).toString());
    setPaymentMethod(p.paymentMethod);
    setNotes(p.notes ?? "");
    setEditingAdvanceId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeletePayment(p: CombinedPayment) {
    if (!confirm("Remove this payment? This can't be undone.")) return;
    const url =
      p.kind === "SALE"
        ? `/api/sales/${p.refId}/payments/${p.id}`
        : p.kind === "PURCHASE"
          ? `/api/purchases/${p.refId}/payments/${p.id}`
          : `/api/parties/${p.refId}/payments/${p.id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      loadHistory();
    } else {
      const data = await res.json();
      alert(data.error ?? "Could not remove payment");
    }
  }

  const kindLabel: Record<PayType, string> = {
    SALE: "Sale",
    PURCHASE: "Purchase",
    ADVANCE: "Advance",
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Payments</h1>

      <Card title={editingAdvanceId ? "Editing advance payment" : "Record a payment"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(["SALE", "PURCHASE", "ADVANCE"] as PayType[]).map((t) => (
              <button
                key={t}
                type="button"
                disabled={Boolean(editingAdvanceId)}
                onClick={() => switchPayType(t)}
                className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${
                  payType === t
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/15 dark:border-white/15"
                }`}
              >
                {kindLabel[t]}
              </button>
            ))}
          </div>

          {(payType === "SALE" || payType === "PURCHASE") && (
            <div className="relative flex flex-col gap-1">
              <label className="text-xs text-black/60 dark:text-white/60">
                Search {payType === "SALE" ? "sale" : "purchase"} by party or bill #
              </label>
              <input
                value={billQuery}
                onChange={(e) => searchBills(e.target.value)}
                placeholder="Type a party name…"
                className={inputClass}
              />
              {billResults.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-md border border-black/10 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-[#1e2231]">
                  {billResults.map((bill) => (
                    <li key={bill.id}>
                      <button
                        type="button"
                        onClick={() => selectBill(bill)}
                        className="block w-full px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {billLabel(bill)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {payType === "ADVANCE" && (
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-black/60 dark:text-white/60">Party</label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  disabled={Boolean(editingAdvanceId)}
                  className={`${inputClass} disabled:opacity-50`}
                >
                  <option value="">Select party</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-black/60 dark:text-white/60">Direction</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as PartyPaymentDirection)}
                  className={inputClass}
                >
                  <option value="RECEIVED">Received from party</option>
                  <option value="PAID">Paid to party</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-black/60 dark:text-white/60">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-black/60 dark:text-white/60">Amount</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} w-32`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-black/60 dark:text-white/60">Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className={inputClass}
              >
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs text-black/60 dark:text-white/60">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "Saving…" : editingAdvanceId ? "Save changes" : "Record payment"}
            </button>
            {editingAdvanceId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15"
              >
                Cancel
              </button>
            )}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {successMsg && <p className="text-sm text-[#0ca30c]">{successMsg}</p>}
        </form>
      </Card>

      <Card title="All payments" className="p-0">
        <div className="flex flex-wrap items-end gap-2 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">Type</label>
            <select
              value={filterType}
              onChange={(e) => {
                setHistoryPage(1);
                setFilterType(e.target.value as PayType | "");
              }}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="SALE">Sale</option>
              <option value="PURCHASE">Purchase</option>
              <option value="ADVANCE">Advance</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => {
                setHistoryPage(1);
                setFilterFrom(e.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-black/60 dark:text-white/60">To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => {
                setHistoryPage(1);
                setFilterTo(e.target.value);
              }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Party</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={`${p.kind}-${p.id}`} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(p.date)}</td>
                  <td className="px-4 py-2">{kindLabel[p.kind]}</td>
                  <td className="px-4 py-2">{p.partyName}</td>
                  <td className="px-4 py-2">
                    {p.kind === "ADVANCE"
                      ? p.direction === "RECEIVED"
                        ? "Advance received"
                        : "Advance paid"
                      : `Bill #${formatBillNumber(p.billNumber ?? 0)}`}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatCents(p.amountCents)}</td>
                  <td className="px-4 py-2">{paymentMethodLabel(p.paymentMethod)}</td>
                  <td className="px-4 py-2 text-black/60 dark:text-white/60">{p.notes ?? ""}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {p.kind === "ADVANCE" && (
                      <button
                        onClick={() => openEditAdvance(p)}
                        className="mr-2 underline underline-offset-4"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeletePayment(p)}
                        className="text-[#d03b3b] underline underline-offset-4"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 text-sm">
            <button
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((p) => p - 1)}
              className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40 dark:border-white/15"
            >
              Previous
            </button>
            <span>
              Page {historyPage} of {totalPages}
            </span>
            <button
              disabled={historyPage >= totalPages}
              onClick={() => setHistoryPage((p) => p + 1)}
              className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40 dark:border-white/15"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
