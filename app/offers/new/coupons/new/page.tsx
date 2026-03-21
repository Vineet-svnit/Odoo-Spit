"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import { appendDraftCouponIds } from "@/lib/offerDraft";
import type { Contact } from "@/types/contact";
import type { CreateCouponRequestBody, CouponTarget } from "@/types/coupon";

interface CouponCreateResponse {
  success?: boolean;
  data?: {
    count?: number;
    couponIds?: string[];
  };
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
  error?: string;
}

interface CouponFormState {
  target: CouponTarget;
  quantity: string;
  validUntilDays: string;
}

const INITIAL_STATE: CouponFormState = {
  target: "anonymous",
  quantity: "",
  validUntilDays: "",
};

export default function NewCouponPage() {
  const router = useRouter();

  const [form, setForm] = useState<CouponFormState>(INITIAL_STATE);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (form.target !== "selected") {
      return;
    }

    async function loadContacts() {
      setIsLoadingContacts(true);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch("/api/contacts", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as ContactsResponse;

        if (!response.ok || !payload.success) {
          setIsError(true);
          setMessage(payload.error ?? "Failed to load contacts");
          return;
        }

        setContacts(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        const text = loadError instanceof Error ? loadError.message : "Failed to load contacts";
        setIsError(true);
        setMessage(text);
      } finally {
        setIsLoadingContacts(false);
      }
    }

    void loadContacts();
  }, [form.target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const validUntilDays = Number(form.validUntilDays);
      const validUntilMillis = validUntilDays * 24 * 60 * 60 * 1000;

      const payload: CreateCouponRequestBody = {
        for: form.target,
        validUntil: validUntilMillis,
      };

      if (!Number.isFinite(validUntilDays) || validUntilDays <= 0) {
        setIsError(true);
        setMessage("Enter valid coupon validity in days");
        return;
      }

      if (form.target === "anonymous") {
        const quantity = Number(form.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          setIsError(true);
          setMessage("Enter valid quantity for anonymous coupons");
          return;
        }

        payload.quantity = quantity;
      } else {
        payload.contacts = selectedContactIds;
      }

      const token = await getCurrentIdToken();
      const response = await fetch("/api/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as CouponCreateResponse;

      if (!response.ok || !responsePayload.success) {
        setIsError(true);
        setMessage(responsePayload.error ?? "Failed to generate coupons");
        return;
      }

      const createdIds = Array.isArray(responsePayload.data?.couponIds)
        ? responsePayload.data?.couponIds
        : [];

      appendDraftCouponIds(createdIds);
      setMessage(`Generated ${createdIds.length} coupons and added to offer draft`);
      router.push("/offers/new");
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "Failed to generate coupons";
      setIsError(true);
      setMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,#ffd9b1_0%,transparent_34%),radial-gradient(circle_at_86%_12%,#bfeedd_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Generate Coupons</h1>
          <Link
            href="/offers/new"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Offer
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Coupon Target</span>
            <select
              value={form.target}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  target: event.target.value as CouponTarget,
                }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="anonymous">Anonymous</option>
              <option value="selected">Selected Contacts (all contacts by default)</option>
            </select>
          </label>

          {form.target === "selected" ? (
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Contacts (multi-select)</span>
              <select
                multiple
                value={selectedContactIds}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map(
                    (option) => option.value,
                  );
                  setSelectedContactIds(values);
                }}
                className="min-h-32 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600"
                disabled={isLoadingContacts}
              >
                {contacts.map((contact) => (
                  <option key={contact.contactId} value={contact.contactId}>
                    {contact.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">
                Leave empty to generate for all contacts in DB.
              </span>
            </label>
          ) : null}

          {form.target === "anonymous" ? (
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700">Quantity</span>
              <input
                required
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              />
            </label>
          ) : null}

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Validity (days)</span>
            <input
              required
              type="number"
              min="1"
              value={form.validUntilDays}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, validUntilDays: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isSubmitting ? "Generating..." : "Generate Coupons"}
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
