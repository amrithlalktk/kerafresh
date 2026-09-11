"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatBillNumber, formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import type { Party, PartyPayment, Purchase, Sale } from "@/lib/types";
import Card from "@/components/Card";

type LedgerEntry = {
  date: string;
  type: string;
  ref: string;
  note?: string;
  amountCents: number;
};

// One combined, chronological account of every event that moved this
// party's balance — sales/purchases (full invoice amount) plus each
// payment against them, plus advances taken/given outside any invoice.
// A Sale/Purchase's own paidCents already reflects payments regardless of
// source, but a payment settled from advance credit (source: "ADVANCE")
// contributes $0 here — that reduction already happened when the advance
// itself was received/paid, so counting it again would double it (see
// getPartyBalanceMap, which this mirrors exactly).
function buildLedger(sales: Sale[], purchases: Purchase[], advances: PartyPayment[]) {
  const entries: LedgerEntry[] = [];

  for (const s of sales) {
    entries.push({
      date: s.date,
      type: "Sale",
      ref: `Sale #${formatBillNumber(s.billNumber)}`,
      amountCents: s.totalCents,
    });
    for (const p of s.payments) {
      if (p.source === "ADVANCE") {
        entries.push({
          date: p.date,
          type: "Advance applied",
          ref: `Sale #${formatBillNumber(s.billNumber)}`,
          note: "settled from advance credit — no balance change",
          amountCents: 0,
        });
      } else {
        entries.push({
          date: p.date,
          type: "Payment received",
          ref: `Sale #${formatBillNumber(s.billNumber)}`,
          amountCents: -p.amountCents,
        });
      }
    }
  }

  for (const p of purchases) {
    entries.push({
      date: p.date,
      type: "Purchase",
      ref: `Purchase #${formatBillNumber(p.billNumber)}`,
      amountCents: -p.totalCents,
    });
    for (const pay of p.payments) {
      entries.push({
        date: pay.date,
        type: "Payment made",
        ref: `Purchase #${formatBillNumber(p.billNumber)}`,
        amountCents: pay.amountCents,
      });
    }
  }

  for (const a of advances) {
    entries.push({
      date: a.date,
      type: a.direction === "RECEIVED" ? "Advance received" : "Advance paid",
      ref: a.notes || "—",
      amountCents: a.direction === "RECEIVED" ? -a.amountCents : a.amountCents,
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}

export default function PartyStatementPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [party, setParty] = useState<Party | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [advances, setAdvances] = useState<PartyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [partyRes, salesRes, purchasesRes, advancesRes] = await Promise.all([
        fetch(`/api/parties/${params.id}`),
        fetch(`/api/sales?partyId=${params.id}&pageSize=1000`),
        fetch(`/api/purchases?partyId=${params.id}&pageSize=1000`),
        fetch(`/api/parties/${params.id}/payments`),
      ]);
      if (!partyRes.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setParty(await partyRes.json());
      setSales((await salesRes.json()).sales);
      setPurchases((await purchasesRes.json()).purchases);
      setAdvances(await advancesRes.json());
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) return null;
  if (notFound || !party) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-black/60 dark:text-white/60">Party not found.</p>
        <button
          onClick={() => router.push("/parties")}
          className="self-start text-sm underline underline-offset-4"
        >
          Back to parties
        </button>
      </div>
    );
  }

  const ledger = buildLedger(sales, purchases, advances);
  const runningBalances = ledger.reduce<number[]>((acc, entry) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : party.openingBalanceCents;
    acc.push(prev + entry.amountCents);
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/parties")}
          className="flex items-center gap-1.5 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
        >
          <ArrowLeft size={16} />
          Parties
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{party.name}</h1>
          <p className="text-sm capitalize text-black/60 dark:text-white/60">
            {party.type.toLowerCase()}
            {party.phone && ` · ${party.phone}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-black/50 dark:text-white/50">Balance</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              party.balanceCents > 0
                ? "text-[#0ca30c]"
                : party.balanceCents < 0
                  ? "text-[#d03b3b]"
                  : ""
            }`}
          >
            {party.balanceCents === 0
              ? formatCents(0)
              : `${party.balanceCents > 0 ? "Receive " : "Pay "}${formatCents(
                  Math.abs(party.balanceCents)
                )}`}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-black/50 dark:text-white/50">Advance available</p>
          <p className="mt-1 text-xl font-semibold text-[#0ca30c]">
            {formatCents(party.availableAdvanceCents)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-black/50 dark:text-white/50">Opening balance</p>
          <p className="mt-1 text-xl font-semibold">{formatCents(party.openingBalanceCents)}</p>
        </Card>
      </div>

      <Card title="Statement" className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {party.openingBalanceCents !== 0 && (
                <tr className="border-t border-black/5 dark:border-white/5">
                  <td className="px-4 py-3 text-black/50 dark:text-white/50" colSpan={3}>
                    Opening balance
                  </td>
                  <td className="px-4 py-3 text-right text-black/50 dark:text-white/50">—</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCents(party.openingBalanceCents)}
                  </td>
                </tr>
              )}
              {ledger.map((entry, index) => {
                return (
                  <tr key={index} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3">{entry.type}</td>
                    <td className="px-4 py-3">
                      {entry.ref}
                      {entry.note && (
                        <span className="block text-xs text-black/50 dark:text-white/50">
                          {entry.note}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right whitespace-nowrap ${
                        entry.amountCents > 0
                          ? "text-[#0ca30c]"
                          : entry.amountCents < 0
                            ? "text-[#d03b3b]"
                            : "text-black/40 dark:text-white/40"
                      }`}
                    >
                      {entry.amountCents === 0
                        ? "—"
                        : `${entry.amountCents > 0 ? "+" : "-"}${formatCents(
                            Math.abs(entry.amountCents)
                          )}`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      {formatCents(runningBalances[index])}
                    </td>
                  </tr>
                );
              })}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    No sales, purchases, or advances recorded for this party yet.
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
