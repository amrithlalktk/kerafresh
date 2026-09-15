"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
  Receipt,
  BarChart2,
  Tags,
  UserCog,
  Upload,
  Table2,
  AtSign,
} from "lucide-react";
import type { SessionPayload } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, adminOnly: false },
  { href: "/parties", label: "Parties", icon: Users, adminOnly: false },
  { href: "/items", label: "Items", icon: Package, adminOnly: false },
  { href: "/sale", label: "Sale", icon: ShoppingCart, adminOnly: false },
  { href: "/purchase", label: "Purchase", icon: Truck, adminOnly: false },
  { href: "/payments", label: "Payments", icon: Wallet, adminOnly: false },
  { href: "/expenses", label: "Expenses", icon: Receipt, adminOnly: false },
  { href: "/reports", label: "Reports", icon: BarChart2, adminOnly: false },
  { href: "/notes", label: "Notes", icon: Table2, adminOnly: false },
  { href: "/email-contacts", label: "Email Contacts", icon: AtSign, adminOnly: false },
  { href: "/import", label: "Import", icon: Upload, adminOnly: true },
  { href: "/categories", label: "Categories", icon: Tags, adminOnly: true },
  { href: "/users", label: "Users", icon: UserCog, adminOnly: true },
];

export default function Sidebar({ session }: { session: SessionPayload }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-black/10 bg-[#f2f0eb]/70 text-black/70 shadow-[8px_0_30px_rgba(0,0,0,0.06)] backdrop-blur-xl print:hidden"
    >
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {LINKS.filter((l) => !l.adminOnly || isAdminRole(session.role)).map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm backdrop-blur-sm transition-colors ${
                active
                  ? "bg-[#1baf7a]/85 font-medium text-white"
                  : "hover:bg-black/5 hover:text-black"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/10 px-5 py-4 text-xs">
        <span className="text-black">{session.name}</span>
        <div className="text-black/40">{session.role}</div>
        <div className="mt-2 flex gap-3">
          <Link
            href="/account"
            className={`underline-offset-2 hover:underline ${
              pathname.startsWith("/account") ? "text-black" : "text-black/40"
            }`}
          >
            Account
          </Link>
          <Link
            href="/about"
            className={`underline-offset-2 hover:underline ${
              pathname.startsWith("/about") ? "text-black" : "text-black/40"
            }`}
          >
            About
          </Link>
        </div>
      </div>
    </aside>
  );
}
