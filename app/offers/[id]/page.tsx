"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Offer } from "@/types/offer";

interface OfferResponse {
  success?: boolean;
  data?: Offer;
  error?: string;
}

export default function OfferDetailPage() {
  const params = useParams<{ id: string }>();
  const offerId = typeof params.id === "string" ? params.id : "";

  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffer() {
      if (!offerId) {
        setError("Invalid offer");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch(`/api/offer/${offerId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as OfferResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error ?? "Failed to fetch offer");
          return;
        }

        setOffer(payload.data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to fetch offer";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOffer();
  }, [offerId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Offer</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Offer Details</h1>
          </div>
          <Link
            href="/offers"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Offers
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading offer...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {offer ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Name</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{offer.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Discount</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{offer.discountPercentage}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Available On</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{offer.availableOn}</p>
            </div>
            <Link
              href={`/offers/${offer.discountId}/coupons`}
              className="rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-emerald-300"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Coupons</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">Total: {offer.coupons.length}</p>
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
