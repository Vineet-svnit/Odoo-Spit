"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { SaleOrder } from "@/types/saleOrder";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export default function PortalSaleOrderPage() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();
        const response = await fetch("/api/sale-order", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = (await response.json()) as ApiResponse<SaleOrder[]>;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to load orders");
        }

        setOrders(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load orders");
      } finally {
        setIsLoading(false);
      }
    }

    void loadOrders();
  }, []);

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen app-shell px-6 py-10">
        <section className="app-surface mx-auto max-w-6xl rounded-2xl border border-zinc-200 p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Your Sale Orders</h1>
              <p className="mt-1 text-sm text-zinc-600">SOnumber, Order Date and Total for all your previous orders.</p>
            </div>
            <Link
              href="/my-account"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Back to My Account
            </Link>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading orders...</p> : null}
          {error ? <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && !error ? (
            orders.length === 0 ? (
              <p className="text-sm text-zinc-600">No sale orders found.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.12em] text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">SO Number</th>
                      <th className="px-4 py-3">Order Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {orders.map((order) => (
                      <tr key={order.saleOrderId} className="hover:bg-emerald-50/50">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          <Link href={`/portal/sale-order/${order.saleOrderId}`} className="hover:text-emerald-700">
                            {order.soNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{formatFirebaseDate(order.soDate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{order.totalTaxed.toFixed(2)}</td>
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
