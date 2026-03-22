"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export default function PortalInvoicePage() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoices() {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();
        const response = await fetch("/api/customer-invoice", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = (await response.json()) as ApiResponse<CustomerInvoice[]>;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to load invoices");
        }

        setInvoices(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load invoices");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvoices();
  }, []);

  const unpaidCount = useMemo(() => invoices.filter((invoice) => invoice.amountDue > 0).length, [invoices]);

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <section className="mx-auto max-w-6xl rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Your Invoices</h1>
              <p className="mt-1 text-sm text-zinc-600">All previous invoices with payment status.</p>
              <p className="mt-1 text-sm text-zinc-600">Unpaid: <span className="font-semibold text-zinc-900">{unpaidCount}</span></p>
            </div>
            <Link
              href="/my-account"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Back to My Account
            </Link>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading invoices...</p> : null}
          {error ? <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && !error ? (
            invoices.length === 0 ? (
              <p className="text-sm text-zinc-600">No invoices found.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.12em] text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Invoice Date</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {invoices.map((invoice) => {
                      const status = invoice.amountDue <= 0 ? "Paid" : "Unpaid";

                      return (
                        <tr key={invoice.customerInvoiceId} className="hover:bg-emerald-50/50">
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            <Link
                              href={`/portal/invoice/${invoice.customerInvoiceId}`}
                              className="text-emerald-700 underline-offset-2 transition hover:text-emerald-800 hover:underline"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{formatFirebaseDate(invoice.invoiceDate)}</td>
                          <td className="px-4 py-3 text-zinc-700">{formatFirebaseDate(invoice.invoiceDue)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{invoice.amountDue.toFixed(2)}</td>
                        </tr>
                      );
                    })}
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
