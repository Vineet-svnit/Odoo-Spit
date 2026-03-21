"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InternalNavbar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Products", href: "/products" },
    { label: "Billing & Payments", href: "/orders-invoices-bills" },
    { label: "Payment Terms & Offers", href: "/payment-terms" },
    { label: "Users & Contacts", href: "/people" },
    { label: "Reports", href: "/reports" },
  ];

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700">
              <span className="text-sm font-bold text-white">OS</span>
            </div>
            <span className="text-lg font-semibold text-zinc-900">Odoo Spit</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  isActive(item.href)
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
