"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { VendorBill } from "@/types/vendorBill";

type VendorBillFilter = "all" | "completed" | "unpaid" | "overdue";

interface VendorBillsResponse {
  success?: boolean;
  data?: VendorBill[];
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

export default function VendorBillsPage() {
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [filter, setFilter] = useState<VendorBillFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVendorBills(activeFilter: VendorBillFilter) {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const query = activeFilter === "all" ? "" : `?filter=${activeFilter}`;

        const response = await fetch(`/api/vendor-bill${query}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as VendorBillsResponse;

        if (!response.ok || !payload.success) {
          setVendorBills([]);
          setError(payload.error ?? "Failed to fetch vendor bills");
          return;
        }

        setVendorBills(Array.isArray(payload.data) ? payload.data : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch vendor bills";
        setVendorBills([]);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadVendorBills(filter);
  }, [filter]);

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Vendor Bills</h1>
          </div>

          <Link
            href="/orders-invoices-bills"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back
          </Link>
        </div>

        <div className="mb-5 max-w-xs">
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Filter</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as VendorBillFilter)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading vendor bills...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          vendorBills.length === 0 ? (
            <p className="text-sm text-zinc-600">No vendor bills found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Bill Number</th>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Bill Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Amount Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {vendorBills.map((vendorBill) => (
                    <tr key={vendorBill.vendorBillId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/vendor-bill/${vendorBill.vendorBillId}`} className="hover:text-emerald-700">
                          {vendorBill.billNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{vendorBill.customerName}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(vendorBill.billDate)}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(vendorBill.billDue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{vendorBill.amountDue.toFixed(2)}</td>
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
