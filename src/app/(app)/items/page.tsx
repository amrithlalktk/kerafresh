"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import type { Item } from "@/lib/types";
import Modal from "@/components/Modal";
import Card from "@/components/Card";
import ItemForm from "@/components/ItemForm";
import SearchInput from "@/components/SearchInput";

export default function ItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | undefined>(undefined);

  const load = useCallback(async () => {
    const res = await fetch("/api/items");
    setItems(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openAdd();
      router.replace("/items");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openAdd() {
    setEditing(undefined);
    setModalOpen(true);
  }
  function openEdit(item: Item) {
    setEditing(item);
    setModalOpen(true);
  }
  function handleSaved() {
    setModalOpen(false);
    load();
  }

  async function handleDelete(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const data = await res.json();
      alert(data.error ?? "Could not delete item");
    }
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Items</h1>
        <div className="flex flex-1 items-center justify-end gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search items…" />
          <button
            onClick={openAdd}
            className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            + Add item
          </button>
        </div>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-black/60 dark:text-white/60">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Sale price</th>
                <th className="px-4 py-3 text-right">Purchase price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const low =
                  item.lowStockThreshold != null &&
                  item.currentStockQty <= item.lowStockThreshold;
                return (
                  <tr key={item.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3 text-right">{formatCents(item.salePriceCents)}</td>
                    <td className="px-4 py-3 text-right">{formatCents(item.purchasePriceCents)}</td>
                    <td className={`px-4 py-3 text-right ${low ? "text-[#d03b3b] font-medium" : ""}`}>
                      {item.currentStockQty} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(item)} className="mr-2 underline underline-offset-4">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item)} className="text-[#d03b3b] underline underline-offset-4">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-black/50 dark:text-white/50">
                    {items.length === 0 ? "No items yet." : "No items match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <Modal title={editing ? "Edit item" : "Add item"} onClose={() => setModalOpen(false)}>
          <ItemForm initial={editing} onSaved={handleSaved} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
