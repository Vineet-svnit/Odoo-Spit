"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Offer } from "@/types/offer";
import type { PaymentTerm } from "@/types/paymentTerm";
import InternalNavbar from "@/components/InternalNavbar";

interface OffersResponse {
  success?: boolean;
  data?: Offer[];
  error?: string;
}

interface PaymentTermsResponse {
  success?: boolean;
  data?: PaymentTerm[];
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

function isOfferActive(offer: Offer, now: number): boolean {
  const startMillis = getTimestampMillis(offer.startDate);
  const endMillis = getTimestampMillis(offer.endDate);

  if (startMillis === null || endMillis === null) {
    return false;
  }

  return startMillis <= now && now <= endMillis;
}

export default function PaymentOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const [offersResponse, paymentTermsResponse] = await Promise.all([
          fetch("/api/offer", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/payment-terms", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const offersPayload = (await offersResponse.json()) as OffersResponse;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as PaymentTermsResponse;

        if (!offersResponse.ok || !offersPayload.success) {
          setError(offersPayload.error ?? "Failed to fetch offers");
          return;
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          setError(paymentTermsPayload.error ?? "Failed to fetch payment terms");
          return;
        }

        setOffers(Array.isArray(offersPayload.data) ? offersPayload.data : []);
        setPaymentTerms(Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : []);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to fetch offers";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOffers();
  }, []);

  const activeOffersCount = useMemo(() => {
    const now = Date.now();
    return offers.filter((offer) => isOfferActive(offer, now)).length;
  }, [offers]);

  return (
    <>
    <InternalNavbar/>
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Billing</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Payment Terms & Offers</h1>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/payment-terms"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">Payment Terms</p>
              <h2 className="mt-2 text-3xl font-semibold text-zinc-900">{paymentTerms.length}</h2>
              <p className="mt-1 text-sm text-zinc-600">Available payment terms</p>
            </Link>

            <Link
              href="/offers"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">Offers</p>
              <h2 className="mt-2 text-3xl font-semibold text-zinc-900">{activeOffersCount}</h2>
              <p className="mt-1 text-sm text-zinc-600">Active offers</p>
            </Link>
          </div>
        ) : null}
      </section>
    </main>
    </>
  );
}
