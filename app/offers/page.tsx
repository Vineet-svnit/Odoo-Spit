"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Offer } from "@/types/offer";

interface OffersResponse {
  success?: boolean;
  data?: Offer[];
  error?: string;
}

type OfferFilter = "all" | "active" | "inactive";

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

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [filter, setFilter] = useState<OfferFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch("/api/offer", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as OffersResponse;

        if (!response.ok || !payload.success) {
          setError(payload.error ?? "Failed to fetch offers");
          return;
        }

        setOffers(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to fetch offers";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOffers();
  }, []);

  const filteredOffers = useMemo(() => {
    const now = Date.now();

    if (filter === "active") {
      return offers.filter((offer) => isOfferActive(offer, now));
    }

    if (filter === "inactive") {
      return offers.filter((offer) => !isOfferActive(offer, now));
    }

    return offers;
  }, [offers, filter]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Offers</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">All Offers</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/payment-offers"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back
            </Link>
            <Link
              href="/offers/new"
              className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              + New Offer
            </Link>
          </div>
        </div>

        <div className="mb-5 max-w-xs">
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Filter</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as OfferFilter)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading offers...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOffers.length > 0 ? (
              filteredOffers.map((offer) => (
                <Link
                  key={offer.discountId}
                  href={`/offers/${offer.discountId}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                >
                  <p className="text-lg font-semibold text-zinc-900">{offer.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">{offer.availableOn}</p>
                  <p className="mt-1 text-sm text-zinc-600">Discount: {offer.discountPercentage}%</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-600">No offers found.</p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
