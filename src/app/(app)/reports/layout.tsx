"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Receipt,
  ShoppingCart,
  Truck,
  CalendarDays,
  BadgePercent,
  TrendingUp,
  Users,
  Landmark,
  Wallet,
  FileSpreadsheet,
} from "lucide-react";

const GROUPS = [
  {
    title: "Transaction reports",
    links: [
      { href: "/reports/sales-purchases", label: "Sale & Purchase", icon: ShoppingCart },
      { href: "/reports/day-book", label: "Day Book", icon: CalendarDays },
      { href: "/reports/expenses", label: "Expenses", icon: Receipt },
      { href: "/reports/bill-wise-profit", label: "Bill Wise Profit", icon: BadgePercent },
      { href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
    ],
  },
  {
    title: "Party reports",
    links: [{ href: "/parties", label: "Party Statement", icon: Users }],
  },
  {
    title: "Coming soon",
    links: [
      { href: "/reports/balance-sheet", label: "Balance Sheet", icon: Landmark },
      { href: "/reports/cash-flow", label: "Cash Flow", icon: Wallet },
      { href: "/reports/gst", label: "GST Returns", icon: FileSpreadsheet },
    ],
  },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 gap-4">
      <aside className="w-56 shrink-0 rounded-2xl border border-white/50 bg-white/55 p-3 backdrop-blur-xl print:hidden dark:border-white/10 dark:bg-[#1e2231]/60">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
              {group.title}
            </p>
            <nav className="flex flex-col gap-0.5">
              {group.links.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-[#1baf7a]/85 font-medium text-white"
                        : "text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10"
                    }`}
                  >
                    <Icon size={16} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
