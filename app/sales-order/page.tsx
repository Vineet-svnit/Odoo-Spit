"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";
import type { SaleOrder } from "@/types/saleOrder";

interface SaleOrdersResponse {
  success?: boolean;
  data?: SaleOrder[];
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
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

function formatDate(value: unknown): string {
  const millis = getTimestampMillis(value);

  if (millis === null) {
    return "-";
  }

  return new Date(millis).toLocaleDateString();
}

export default function SalesOrderPage() {
  const [salesOrders, setSalesOrders] = useState<SaleOrder[]>([]);
  const [contactNameById, setContactNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const [salesOrdersResponse, contactsResponse] = await Promise.all([
          fetch("/api/sale-order", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/contacts", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const salesOrdersPayload = (await salesOrdersResponse.json()) as SaleOrdersResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;

        if (!salesOrdersResponse.ok || !salesOrdersPayload.success) {
          setError(salesOrdersPayload.error ?? "Failed to fetch sales orders");
          setSalesOrders([]);
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          setSalesOrders([]);
          return;
        }

        const contacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];
        const names = contacts.reduce<Record<string, string>>((accumulator, contact) => {
          accumulator[contact.contactId] = contact.name;
          return accumulator;
        }, {});

        setContactNameById(names);
        setSalesOrders(Array.isArray(salesOrdersPayload.data) ? salesOrdersPayload.data : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch sales orders";
        setError(message);
        setSalesOrders([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  const currentMonthCount = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return salesOrders.filter((saleOrder) => {
      const millis = getTimestampMillis(saleOrder.soDate);

      if (millis === null) {
        return false;
      }

      const date = new Date(millis);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [salesOrders]);

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#ffe3bf_0%,transparent_34%),radial-gradient(circle_at_88%_14%,#cbefe2_0%,transparent_35%),linear-gradient(145deg,#f8f3e8,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Sales</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Sales Orders</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Total sales orders this month: <span className="font-semibold text-zinc-900">{currentMonthCount}</span>
            </p>
          </div>

          <Link
            href="/orders-invoices-bills"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading sales orders...</p> : null}

        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          salesOrders.length === 0 ? (
            <p className="text-sm text-zinc-600">No sales orders found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">SO Number</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total Untaxed</th>
                    <th className="px-4 py-3 text-right">Total Taxed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {salesOrders.map((saleOrder) => (
                    <tr key={saleOrder.saleOrderId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/sales-order/${saleOrder.saleOrderId}`} className="hover:text-emerald-700">
                          {saleOrder.soNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {contactNameById[saleOrder.customerId] ?? "Unknown Customer"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(saleOrder.soDate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">₹{saleOrder.totalUntaxed.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{saleOrder.totalTaxed.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
    </main>
    </>
  );
}
