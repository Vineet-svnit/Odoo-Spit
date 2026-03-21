"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";
import type { Coupon } from "@/types/coupon";
import type { Offer } from "@/types/offer";

interface OfferResponse {
  success?: boolean;
  data?: Offer;
  error?: string;
}

interface CouponsResponse {
  success?: boolean;
  data?: Coupon[];
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
  error?: string;
}

interface CouponTableRow {
  couponId: string;
  code: string;
  expirationDate: unknown;
  program: string;
  status: string;
  customer: string;
}

type CouponExpiryFilter = "all" | "active" | "expired";

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

export default function OfferCouponsPage() {
  const params = useParams<{ id: string }>();
  const offerId = typeof params.id === "string" ? params.id : "";

  const [offer, setOffer] = useState<Offer | null>(null);
  const [rows, setRows] = useState<CouponTableRow[]>([]);
  const [filter, setFilter] = useState<CouponExpiryFilter>("all");
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

        const offerData = payload.data;
        setOffer(offerData);

        const couponIds = offerData.coupons.map((entry) => entry.couponId);

        const [couponsResponse, contactsResponse] = await Promise.all([
          couponIds.length > 0
            ? fetch(`/api/coupon?ids=${couponIds.join(",")}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })
            : Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })),
          fetch("/api/contacts", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const couponsPayload = (await couponsResponse.json()) as CouponsResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;

        if (!couponsResponse.ok || !couponsPayload.success) {
          setError(couponsPayload.error ?? "Failed to fetch coupons");
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          return;
        }

        const coupons = Array.isArray(couponsPayload.data) ? couponsPayload.data : [];
        const contacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];

        const couponById = new Map(coupons.map((coupon) => [coupon.couponId, coupon]));
        const contactNameById = new Map(contacts.map((contact) => [contact.contactId, contact.name]));

        const nextRows = offerData.coupons.map((entry) => {
          const coupon = couponById.get(entry.couponId);
          const contactName = coupon?.contactId
            ? (contactNameById.get(coupon.contactId) ?? "-")
            : "-";

          return {
            couponId: entry.couponId,
            code: coupon?.code ?? "-",
            expirationDate: entry.expirationDate,
            program: offerData.name,
            status: coupon?.status ?? "-",
            customer: contactName,
          };
        });

        setRows(nextRows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to fetch offer";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadOffer();
  }, [offerId]);

  const filteredRows = useMemo(() => {
    if (!offer) {
      return [];
    }

    const now = Date.now();

    return rows.filter((row) => {
      const expiry = getTimestampMillis(row.expirationDate);

      if (expiry === null) {
        return filter === "all";
      }

      if (filter === "active") {
        return expiry >= now;
      }

      if (filter === "expired") {
        return expiry < now;
      }

      return true;
    });
  }, [offer, rows, filter]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Offer Coupons</h1>
          <Link
            href={`/offers/${offerId}`}
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Offer
          </Link>
        </div>

        <div className="mb-5 max-w-xs">
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Expiry</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as CouponExpiryFilter)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </label>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading coupons...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          filteredRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Coupon Code</th>
                    <th className="px-4 py-3">Expiration Date</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const expiry = getTimestampMillis(row.expirationDate);
                    return (
                      <tr key={row.couponId} className="border-t border-zinc-200 text-zinc-800">
                        <td className="px-4 py-3 font-medium">{row.code}</td>
                        <td className="px-4 py-3">
                          {expiry ? new Date(expiry).toLocaleString() : "-"}
                        </td>
                        <td className="px-4 py-3">{row.program}</td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">{row.customer}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No coupons found.</p>
          )
        ) : null}
      </section>
    </main>
  );
}
