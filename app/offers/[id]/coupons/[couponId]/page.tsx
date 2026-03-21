"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Coupon } from "@/types/coupon";

interface CouponResponse {
  success?: boolean;
  data?: Coupon;
  error?: string;
}

export default function CouponDetailPage() {
  const params = useParams<{ id: string; couponId: string }>();
  const offerId = typeof params.id === "string" ? params.id : "";
  const couponId = typeof params.couponId === "string" ? params.couponId : "";

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoupon() {
      if (!couponId) {
        setError("Invalid coupon");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch(`/api/coupon/${couponId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as CouponResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error ?? "Failed to fetch coupon");
          return;
        }

        setCoupon(payload.data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to fetch coupon";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadCoupon();
  }, [couponId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Coupon Details</h1>
          <Link
            href={`/offers/${offerId}/coupons`}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Coupons
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading coupon...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {coupon ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Code</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{coupon.code}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Status</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{coupon.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Assigned</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{coupon.contactId ? "Yes" : "No"}</p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
