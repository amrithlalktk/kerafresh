"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatBillNumber, formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { isAdminRole, type ChargeType, type Item, type Party, type Purchase } from "@/lib/types";
import { useViewerRole } from "@/lib/useViewerRole";
import Card from "@/components/Card";
import SalePurchaseForm from "@/components/SalePurchaseForm";
import QuickEntryRow from "@/components/QuickEntryRow";
import PaymentHistory from "@/components/PaymentHistory";
import PaymentStatusIcon from "@/components/PaymentStatusIcon";
import SearchInput from "@/components/SearchInput";

export default function PurchasePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewerRole = useViewerRole();
  const canDelete = viewerRole !== null && isAdminRole(viewerRole);
  const formRef = useRef<HTMLDivElement>(null);

  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [chargeTypes, setChargeTypes] = useState<ChargeType[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "billNumber">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [editing, setEditing] = useState<Purchase | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    const params = new URLSearchParams({ page: String(page), sortBy, sortDir });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/purchases?${params.toString()}`);
    const data = await res.json();
    setPurchases(data.purchases);
    setTotalPages(data.totalPages);
  }, [page, search, sortBy, sortDir]);

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
    setAdvancedOpen(true);
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSaved() {
    const wasEditing = Boolean(editing);
    setEditing(undefined);
    setAdvancedOpen(false);
    if (!wasEditing) setPage(1);
    loadPurchases();
  }

  function handleQuickSaved() {
    setPage(1);
    loadPurchases();
  }

  function toggleSort(field: "date" | "billNumber") {
    setPage(1);
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
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
    <div className="flex flex-col gap-1">
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
        {editing || advancedOpen ? (
          <Card title={editing ? "Editing purchase" : "Advanced entry (multiple items, charges)"}>
            <SalePurchaseForm
              key={editing?.id ?? "new"}
              mode="PURCHASE"
              parties={parties}
              items={items}
              chargeTypes={chargeTypes}
              initial={editing}
              onSaved={handleSaved}
              onCancelEdit={() => {
                setEditing(undefined);
                setAdvancedOpen(false);
              }}
            />
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setAdvancedOpen(true)}
            className="self-start text-sm underline underline-offset-4"
          >
            Need multiple items or extra charges on one purchase? Use advanced entry
          </button>
        )}
      </div>

      <Card className="p-0">
          <table className="w-full table-fixed text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="w-14 px-2 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("billNumber")}
                    className="flex items-center gap-0.5 hover:text-black/90 dark:hover:text-white/90"
                  >
                    Bill # {sortBy === "billNumber" && (sortDir === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th className="w-32 px-2 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="flex items-center gap-0.5 hover:text-black/90 dark:hover:text-white/90"
                  >
                    Date {sortBy === "date" && (sortDir === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th className="w-36 px-2 py-3">Party</th>
                <th className="w-36 px-2 py-3">Item</th>
                <th className="w-20 px-2 py-3 text-center">KG</th>
                <th className="w-32 px-2 py-3">Price</th>
                <th className="w-16 px-2 py-3 text-center">FFA</th>
                <th className="w-16 px-2 py-3 text-center">Tax %</th>
                <th className="w-32 px-2 py-3 text-right">Total</th>
                <th className="w-56 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <QuickEntryRow
                mode="PURCHASE"
                parties={parties}
                items={items}
                onPartyCreated={(p) => setParties((prev) => [...prev, p])}
                onItemCreated={(i) => setItems((prev) => [...prev, i])}
                onSaved={handleQuickSaved}
              />
              <tr>
                <td
                  colSpan={10}
                  className="bg-black/[0.03] px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-black/40 dark:bg-white/[0.04] dark:text-white/40"
                >
                  Recorded purchases
                </td>
              </tr>
              {purchases.map((purchase) => {
                return (
                  <Fragment key={purchase.id}>
                  <tr className="border-t border-black/5 dark:border-white/5">
                    <td className="px-2 py-3 text-black/50 whitespace-nowrap dark:text-white/50">
                      #{formatBillNumber(purchase.billNumber)}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <PaymentStatusIcon
                          date={purchase.date}
                          totalCents={purchase.totalCents}
                          paidCents={purchase.paidCents}
                        />
                        {formatDate(purchase.date)}
                      </span>
                    </td>
                    <td className="px-2 py-3">{purchase.party?.name ?? "—"}</td>
                    <td className="px-2 py-3" colSpan={5}>
                      <div className="flex flex-col gap-0.5">
                        {purchase.items.map((l) => (
                          <span key={l.id}>
                            {l.item.name} × {l.quantity}
                            {l.ffaGrade && (
                              <span className="text-black/50 dark:text-white/50">
                                {" "}
                                ({l.ffaGrade})
                              </span>
                            )}
                            {l.taxPercent > 0 && (
                              <span className="text-black/50 dark:text-white/50">
                                {" "}
                                (+{l.taxPercent}% tax)
                              </span>
                            )}
                          </span>
                        ))}
                        {purchase.charges.map((c) => (
                          <span key={c.id} className="text-black/50 dark:text-white/50">
                            + {c.label} ({formatCents(c.amountCents)})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      {formatCents(purchase.totalCents)}
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/print/purchase/${purchase.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-2 underline underline-offset-4"
                      >
                        Print
                      </a>
                      <button
                        onClick={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                        className="mr-2 underline underline-offset-4"
                      >
                        Payments
                      </button>
                      <button onClick={() => openEdit(purchase)} className="mr-2 underline underline-offset-4">
                        Edit
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(purchase)}
                          className="text-[#d03b3b] underline underline-offset-4"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === purchase.id && (
                    <tr className="border-t border-black/5 dark:border-white/5">
                      <td colSpan={10} className="p-3">
                        <PaymentHistory
                          apiBase={`/api/purchases/${purchase.id}`}
                          payments={purchase.payments}
                          totalCents={purchase.totalCents}
                          paidCents={purchase.paidCents}
                          onChange={loadPurchases}
                          canDelete={canDelete}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    {search ? "No purchases match your search." : "No purchases recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
