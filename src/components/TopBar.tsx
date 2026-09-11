"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Plus, ChevronDown, LogOut } from "lucide-react";

export default function TopBar() {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/40 bg-white/50 px-6 py-3 backdrop-blur-xl print:hidden dark:border-white/5 dark:bg-[#161927]/60">
      <div className="flex max-w-xs flex-1 items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm text-black/40 dark:border-white/10 dark:text-white/40">
        <Search size={16} />
        <span>Search</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/sale?new=1")}
          className="flex items-center gap-1.5 rounded-full bg-[#1baf7a] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={16} /> Add Sale
        </button>
        <button
          onClick={() => router.push("/purchase?new=1")}
          className="flex items-center gap-1.5 rounded-full bg-[#2a78d6] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus size={16} /> Add Purchase
        </button>
        <div className="relative">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
            className="flex items-center gap-1.5 rounded-full border border-[#2a78d6] px-4 py-2 text-sm font-medium text-[#2a78d6] hover:bg-[#2a78d6]/5"
          >
            <Plus size={16} /> Add More <ChevronDown size={14} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-white/50 bg-white/80 py-1 text-sm shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#1e2231]/80">
              {[
                { label: "Expense", href: "/expenses?new=1" },
                { label: "Item", href: "/items?new=1" },
                { label: "Party", href: "/parties?new=1" },
              ].map((opt) => (
                <button
                  key={opt.href}
                  onClick={() => router.push(opt.href)}
                  className="block w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="ml-2 flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          title="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
