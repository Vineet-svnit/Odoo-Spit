"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PaymentBill } from "@/types/paymentBill";

interface PaymentBillsResponse {
  success?: boolean;
  data?: PaymentBill[];
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

export default function VendorPaymentsPage() {
  const [payments, setPayments] = useState<PaymentBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayments() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch("/api/payment-bill?partnerType=vendor", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as PaymentBillsResponse;

        if (!response.ok || !payload.success) {
          setPayments([]);
          setError(payload.error ?? "Failed to fetch vendor payments");
          return;
        }

        setPayments(Array.isArray(payload.data) ? payload.data : []);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch vendor payments";
        setPayments([]);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPayments();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Vendor Payments</h1>
            <p className="mt-2 text-sm text-zinc-600">All previous vendor transactions.</p>
          </div>

          <Link
            href="/orders-invoices-bills"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading vendor payments...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          payments.length === 0 ? (
            <p className="text-sm text-zinc-600">No vendor payments found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Pay ID</th>
                    <th className="px-4 py-3">Partner</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {payments.map((payment) => (
                    <tr key={payment.paymentBillId} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={`/vendor-payment/${payment.paymentBillId}`} className="hover:text-emerald-700">
                          {payment.payId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{payment.partnerName}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {formatDate(payment.paymentDate ?? payment.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{payment.amount.toFixed(2)}</td>
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
