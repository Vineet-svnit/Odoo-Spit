"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PaymentTerm } from "@/types/paymentTerm";

interface PaymentTermsResponse {
  success?: boolean;
  data?: PaymentTerm[];
  error?: string;
}

export default function PaymentTermsPage() {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTerms() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch("/api/payment-terms", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as PaymentTermsResponse;

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Failed to fetch payment terms");
          return;
        }

        setTerms(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Failed to fetch payment terms";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadTerms();
  }, []);

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Billing</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Payment Terms</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/payment-offers"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back
            </Link>
            <Link
              href="/payment-terms/new"
              className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              + New Payment Term
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading payment terms...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          terms.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Early Payment Discount</th>
                    <th className="px-4 py-3">Discount %</th>
                    <th className="px-4 py-3">Discount Days</th>
                    <th className="px-4 py-3">Computation</th>
                    <th className="px-4 py-3">Example Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((term) => (
                    <tr key={term.termId} className="border-t border-zinc-200 text-zinc-800">
                      <td className="px-4 py-3 font-medium">{term.name}</td>
                      <td className="px-4 py-3">{term.early_payment_discount ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">
                        {term.early_payment_discount && term.discount_percentage !== null
                          ? term.discount_percentage
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {term.early_payment_discount && term.discount_days !== null
                          ? term.discount_days
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {term.early_payment_discount && term.early_pay_discount_computation
                          ? term.early_pay_discount_computation
                          : "-"}
                      </td>
                      <td className="px-4 py-3">{term.example_preview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No payment terms available.</p>
          )
        ) : null}
      </section>
    </main>
    </>
  );
}
