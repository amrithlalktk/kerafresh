"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import type { ChargeType, Item, Party, Purchase } from "@/lib/types";
import Card from "@/components/Card";
import SalePurchaseForm from "@/components/SalePurchaseForm";
import PaymentHistory from "@/components/PaymentHistory";
import SearchInput from "@/components/SearchInput";

export default function PurchasePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [chargeTypes, setChargeTypes] = useState<ChargeType[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Purchase | undefined>(undefined);
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

  const loadPurchases = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/purchases?${params.toString()}`);
    const data = await res.json();
    setPurchases(data.purchases);
    setTotalPages(data.totalPages);
  }, [page, search]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(undefined);
      formRef.current?.scrollIntoView({ behavior: "smooth" });
      router.replace("/purchase");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openEdit(purchase: Purchase) {
    setEditing(purchase);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSaved() {
    const wasEditing = Boolean(editing);
    setEditing(undefined);
    if (!wasEditing) setPage(1);
    loadPurchases();
  }

  async function handleDelete(purchase: Purchase) {
    if (!confirm("Delete this purchase? This can't be undone.")) return;
    const res = await fetch(`/api/purchases/${purchase.id}`, { method: "DELETE" });
    if (res.ok) loadPurchases();
    else {
      const data = await res.json();
      alert(data.error ?? "Could not delete purchase");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Purchase</h1>
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
        <Card title={editing ? "Editing purchase" : "Add purchase"}>
          <SalePurchaseForm
            key={editing?.id ?? "new"}
            mode="PURCHASE"
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
              {purchases.map((purchase) => {
                const balance = purchase.totalCents - purchase.paidCents;
                return (
                  <Fragment key={purchase.id}>
                  <tr className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(purchase.date)}</td>
                    <td className="px-4 py-3">{purchase.party?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {purchase.items.map((l) => (
                          <span key={l.id}>
                            {l.item.name} × {l.quantity}
                          </span>
                        ))}
                        {purchase.charges.map((c) => (
                          <span key={c.id} className="text-black/50 dark:text-white/50">
                            + {c.label} ({formatCents(c.amountCents)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatCents(purchase.totalCents)}
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
                        onClick={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                        className="mr-2 underline underline-offset-4"
                      >
                        Payments
                      </button>
                      <button onClick={() => openEdit(purchase)} className="mr-2 underline underline-offset-4">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(purchase)} className="text-[#d03b3b] underline underline-offset-4">
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === purchase.id && (
                    <tr className="border-t border-black/5 dark:border-white/5">
                      <td colSpan={6} className="p-3">
                        <PaymentHistory
                          apiBase={`/api/purchases/${purchase.id}`}
                          payments={purchase.payments}
                          totalCents={purchase.totalCents}
                          paidCents={purchase.paidCents}
                          onChange={loadPurchases}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    {search ? "No purchases match your search." : "No purchases recorded yet."}
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
