"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import type { ChargeType, Item, Party, Sale } from "@/lib/types";
import Card from "@/components/Card";
import SalePurchaseForm from "@/components/SalePurchaseForm";
import PaymentHistory from "@/components/PaymentHistory";
import SearchInput from "@/components/SearchInput";

export default function SalePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [chargeTypes, setChargeTypes] = useState<ChargeType[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Sale | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    const [partiesRes, itemsRes, chargeTypesRes] = await Promise.all([
      fetch("/api/parties"),
      fetch("/api/items"),
      fetch("/api/charge-types"),
    ]);
    setParties(await partiesRes.json());
    setItems(await itemsRes.json());
    setChargeTypes(await chargeTypesRes.json());
  }, []);

  const loadSales = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/sales?${params.toString()}`);
    const data = await res.json();
    setSales(data.sales);
    setTotalPages(data.totalPages);
  }, [page, search]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(undefined);
      formRef.current?.scrollIntoView({ behavior: "smooth" });
      router.replace("/sale");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openEdit(sale: Sale) {
    setEditing(sale);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSaved() {
    const wasEditing = Boolean(editing);
    setEditing(undefined);
    if (!wasEditing) setPage(1);
    loadSales();
  }

  async function handleDelete(sale: Sale) {
    if (!confirm("Delete this sale? This can't be undone.")) return;
    const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    if (res.ok) loadSales();
    else {
      const data = await res.json();
      alert(data.error ?? "Could not delete sale");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Sale</h1>
        <SearchInput
          value={search}
          onChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          placeholder="Search party or item…"
        />
      </div>

      <div ref={formRef}>
        <Card title={editing ? "Editing sale" : "Add sale"}>
          <SalePurchaseForm
            key={editing?.id ?? "new"}
            mode="SALE"
            parties={parties}
            items={items}
            chargeTypes={chargeTypes}
            initial={editing}
            onSaved={handleSaved}
            onCancelEdit={() => setEditing(undefined)}
          />
        </Card>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const balance = sale.totalCents - sale.paidCents;
                return (
                  <Fragment key={sale.id}>
                  <tr className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(sale.date)}</td>
                    <td className="px-4 py-3">{sale.party?.name ?? "Cash sale"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {sale.items.map((l) => (
                          <span key={l.id}>
                            {l.item.name} × {l.quantity}
                          </span>
                        ))}
                        {sale.charges.map((c) => (
                          <span key={c.id} className="text-black/50 dark:text-white/50">
                            + {c.label} ({formatCents(c.amountCents)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatCents(sale.totalCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right whitespace-nowrap ${
                        balance > 0 ? "text-[#d03b3b]" : "text-[#0ca30c]"
                      }`}
                    >
                      {balance > 0 ? formatCents(balance) : "Paid"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                        className="mr-2 underline underline-offset-4"
                      >
                        Payments
                      </button>
                      <button onClick={() => openEdit(sale)} className="mr-2 underline underline-offset-4">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(sale)} className="text-[#d03b3b] underline underline-offset-4">
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === sale.id && (
                    <tr className="border-t border-black/5 dark:border-white/5">
                      <td colSpan={6} className="p-3">
                        <PaymentHistory
                          apiBase={`/api/sales/${sale.id}`}
                          payments={sale.payments}
                          totalCents={sale.totalCents}
                          paidCents={sale.paidCents}
                          onChange={loadSales}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    {search ? "No sales match your search." : "No sales recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-black/15 px-2 py-1 disabled:opacity-40 dark:border-white/15"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
