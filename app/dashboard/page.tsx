"use client";

import Link from "next/link";

import InternalNavbar from "@/components/InternalNavbar";

const dashboardItems = [
  {
    title: "Products",
    description: "Manage catalog, stock visibility, and product details.",
    href: "/products",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    title: "Billing & Payments",
    description: "Track orders, invoices, bills, and payment activity.",
    href: "/orders-invoices-bills",
    accent: "from-blue-500 to-indigo-600",
  },
  {
    title: "Payment Terms & Offers",
    description: "Configure discount rules, terms, and promotional offers.",
    href: "/payment-offers",
    accent: "from-amber-500 to-orange-600",
  },
  {
    title: "Users & Contacts",
    description: "Maintain customer contacts and user account records.",
    href: "/people",
    accent: "from-violet-500 to-purple-600",
  },
  {
    title: "Reports",
    description: "Review business snapshots and operational insights.",
    href: "/reports",
    accent: "from-rose-500 to-pink-600",
  },
] as const;

export default function DashboardPage() {
  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd6a8_0%,transparent_32%),radial-gradient(circle_at_85%_10%,#b6f0d8_0%,transparent_36%),linear-gradient(145deg,#f8f3ec,#edf7f1)] px-6 py-10">
        <section className="mx-auto w-full max-w-7xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Internal Workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-600">Quick access to every section available in the internal navigation.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
              >
                <span className={`inline-flex rounded-full bg-linear-to-r px-3 py-1 text-xs font-semibold text-white ${item.accent}`}>
                  Module
                </span>
                <h2 className="mt-3 text-lg font-semibold text-zinc-900 group-hover:text-emerald-700">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Open section {">"}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
