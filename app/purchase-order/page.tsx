"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PurchaseOrder } from "@/types/purchaseOrder";

interface PurchaseOrdersResponse {
  success?: boolean;
  data?: PurchaseOrder[];
  error?: string;
}

interface ContactRow {
  contactId: string;
  name: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: ContactRow[];
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

export default function PurchaseOrderPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [contactNameById, setContactNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const [purchaseOrdersResponse, contactsResponse] = await Promise.all([
          fetch("/api/purchaseorder", {
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

        const purchaseOrdersPayload = (await purchaseOrdersResponse.json()) as PurchaseOrdersResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;

        if (!purchaseOrdersResponse.ok || !purchaseOrdersPayload.success) {
          setError(purchaseOrdersPayload.error ?? "Failed to fetch purchase orders");
          setPurchaseOrders([]);
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          setPurchaseOrders([]);
          return;
        }

        const contacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];
        const names = contacts.reduce<Record<string, string>>((accumulator, contact) => {
          accumulator[contact.contactId] = contact.name;
          return accumulator;
        }, {});

        setContactNameById(names);
        setPurchaseOrders(Array.isArray(purchaseOrdersPayload.data) ? purchaseOrdersPayload.data : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch purchase orders";
        setError(message);
        setPurchaseOrders([]);
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

    return purchaseOrders.filter((purchaseOrder) => {
      const millis = getTimestampMillis(purchaseOrder.poDate);

      if (millis === null) {
        return false;
      }

      const date = new Date(millis);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [purchaseOrders]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#ffe3bf_0%,transparent_34%),radial-gradient(circle_at_88%_14%,#cbefe2_0%,transparent_35%),linear-gradient(145deg,#f8f3e8,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Purchase Orders</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Total purchase orders this month: <span className="font-semibold text-zinc-900">{currentMonthCount}</span>
            </p>
          </div>

          <Link
            href="/purchase-order/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            + New Purchase Order
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading purchase orders...</p> : null}

        {error ? (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        {!isLoading && !error ? (
          purchaseOrders.length === 0 ? (
            <p className="text-sm text-zinc-600">No purchase orders found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">PO Number</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total Untaxed</th>
                    <th className="px-4 py-3 text-right">Total Taxed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {purchaseOrders.map((purchaseOrder) => (
                    <tr key={purchaseOrder.purchaseOrderId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/purchase-order/${purchaseOrder.purchaseOrderId}`} className="hover:text-emerald-700">
                          {purchaseOrder.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {contactNameById[purchaseOrder.vendorId] ?? "Unknown Vendor"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(purchaseOrder.poDate)}</td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-800">₹{purchaseOrder.totalUntaxed.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{purchaseOrder.totalTaxed.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
    </main>
  );
}
