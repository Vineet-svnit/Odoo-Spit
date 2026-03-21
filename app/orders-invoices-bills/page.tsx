"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PurchaseOrder } from "@/types/purchaseOrder";

type SummaryCard = {
  title: string;
  line1: string;
  line2?: string;
  href?: string;
};

interface PurchaseOrdersResponse {
  success?: boolean;
  data?: PurchaseOrder[];
  error?: string;
}

function getTimestampMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const withToMillis = value as { toMillis?: () => number };

  if (typeof withToMillis.toMillis === "function") {
    return withToMillis.toMillis();
  }

  const withSeconds = value as { _seconds?: number; seconds?: number };
  const seconds = withSeconds._seconds ?? withSeconds.seconds;

  if (typeof seconds === "number") {
    return seconds * 1000;
  }

  return null;
}

const salesCards: SummaryCard[] = [
  {
    title: "Sales Orders",
    line1: "Total orders of current month",
    line2: "Pending orders to invoice",
  },
  {
    title: "Customer Invoices",
    line1: "Unpaid invoices",
    line2: "Overdue",
  },
  {
    title: "Customer Payments",
    line1: "Payment summary",
  },
];

const purchaseCards: SummaryCard[] = [
  {
    title: "Purchase Orders",
    line1: "Total orders of current month",
    line2: "Purchase orders to bill",
  },
  {
    title: "Vendor Bills",
    line1: "Unpaid bills",
    line2: "Overdue",
  },
  {
    title: "Vendor Payments",
    line1: "Payment summary",
  },
];

function DashboardCard({ title, line1, line2, href }: SummaryCard) {
  const card = (
    <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/90 p-5 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_26px_70px_-34px_rgba(15,23,42,0.48)]">
      <div className="pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full bg-teal-100/70 blur-2xl" />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Overview</p>
      <h2 className="relative mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      <p className="relative mt-5 text-sm text-zinc-700">{line1}</p>
      {line2 ? <p className="relative mt-1 text-sm font-medium text-zinc-900">{line2}</p> : null}
    </article>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="block">
      {card}
    </Link>
  );
}

export default function OrdersInvoicesBillsPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    async function loadPurchaseOrders() {
      try {
        const token = await getCurrentIdToken();
        const response = await fetch("/api/purchaseorder", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as PurchaseOrdersResponse;

        if (!response.ok || !payload.success) {
          setPurchaseOrders([]);
          return;
        }

        setPurchaseOrders(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        setPurchaseOrders([]);
      }
    }

    void loadPurchaseOrders();
  }, []);

  const purchaseOrdersCurrentMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return purchaseOrders.filter((purchaseOrder) => {
      const millis = getTimestampMillis(purchaseOrder.poDate);

      if (millis === null) {
        return false;
      }

      const date = new Date(millis);

      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [purchaseOrders]);

  const purchaseCards: SummaryCard[] = [
    {
      title: "Purchase Orders",
      line1: `Total orders of current month: ${purchaseOrdersCurrentMonth}`,
      line2: "Purchase orders to bill",
      href: "/purchase-order",
    },
    {
      title: "Vendor Bills",
      line1: "Unpaid bills",
      line2: "Overdue",
    },
    {
      title: "Vendor Payments",
      line1: "Payment summary",
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#ffe3bf_0%,transparent_34%),radial-gradient(circle_at_88%_14%,#cbefe2_0%,transparent_35%),linear-gradient(145deg,#f8f3e8,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur md:p-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Finance</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
            Orders, Invoices, and Bills
          </h1>
          <p className="mt-2 text-sm text-zinc-600">Overview page for sales and purchase operations.</p>
        </header>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">Sales</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {salesCards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">Purchase</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchaseCards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
