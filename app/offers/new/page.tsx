"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import { clearDraftCouponIds, readDraftCouponIds } from "@/lib/offerDraft";
import type { CreateOfferRequestBody, OfferAvailability } from "@/types/offer";

interface CreateOfferResponse {
  success?: boolean;
  data?: { discountId: string };
  error?: string;
}

interface OfferFormState {
  name: string;
  discountPercentage: string;
  startDate: string;
  endDate: string;
  availableOn: OfferAvailability;
}

const INITIAL_STATE: OfferFormState = {
  name: "",
  discountPercentage: "",
  startDate: "",
  endDate: "",
  availableOn: "sales",
};

export default function NewOfferPage() {
  const router = useRouter();

  const [form, setForm] = useState<OfferFormState>(INITIAL_STATE);
  const [couponIds, setCouponIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setCouponIds(readDraftCouponIds());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      if (couponIds.length === 0) {
        setIsError(true);
        setMessage("Generate coupons before creating an offer");
        return;
      }

      const startMillis = new Date(form.startDate).getTime();
      const endMillis = new Date(form.endDate).getTime();

      const payload: CreateOfferRequestBody = {
        name: form.name.trim(),
        discountPercentage: Number(form.discountPercentage),
        startDate: startMillis,
        endDate: endMillis,
        availableOn: form.availableOn,
        couponIds,
      };

      if (
        !payload.name ||
        !Number.isFinite(payload.discountPercentage) ||
        payload.discountPercentage <= 0 ||
        payload.discountPercentage > 100 ||
        !Number.isFinite(payload.startDate) ||
        !Number.isFinite(payload.endDate) ||
        payload.endDate <= payload.startDate
      ) {
        setIsError(true);
        setMessage("Please fill valid offer details");
        return;
      }

      const token = await getCurrentIdToken();
      const response = await fetch("/api/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as CreateOfferResponse;

      if (!response.ok || !responsePayload.success || !responsePayload.data) {
        setIsError(true);
        setMessage(responsePayload.error ?? "Failed to create offer");
        return;
      }

      clearDraftCouponIds();
      router.push(`/offers/${responsePayload.data.discountId}`);
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "Failed to create offer";
      setIsError(true);
      setMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Offers</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Create Offer</h1>
          </div>
          <Link
            href="/offers"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Offers
          </Link>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/offers/new/coupons/new"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold text-zinc-800 transition hover:border-emerald-300 hover:shadow-lg"
          >
            Generate Coupon
          </Link>
          <Link
            href="/offers/new/coupons"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-emerald-300 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">Coupons</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{couponIds.length}</p>
            <p className="text-sm text-zinc-600">Total coupons</p>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Offer Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Discount Percentage</span>
            <input
              required
              type="number"
              min="1"
              max="100"
              step="0.01"
              value={form.discountPercentage}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, discountPercentage: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Available On</span>
            <select
              value={form.availableOn}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, availableOn: event.target.value as OfferAvailability }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="sales">Sales</option>
              <option value="website">Website</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Start Date</span>
            <input
              required
              type="datetime-local"
              value={form.startDate}
              onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">End Date</span>
            <input
              required
              type="datetime-local"
              value={form.endDate}
              onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
          >
            {isSubmitting ? "Creating offer..." : "Create Offer"}
          </button>
        </form>

        {message ? (
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
