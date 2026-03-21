"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type {
  CreatePaymentTermRequestBody,
  EarlyPayDiscountComputation,
} from "@/types/paymentTerm";

interface CreatePaymentTermResponse {
  success?: boolean;
  data?: { termId: string };
  error?: string;
}

interface PaymentTermFormState {
  name: string;
  early_payment_discount: boolean;
  discount_percentage: string;
  discount_days: string;
  early_pay_discount_computation: EarlyPayDiscountComputation;
}

const INITIAL_STATE: PaymentTermFormState = {
  name: "",
  early_payment_discount: false,
  discount_percentage: "",
  discount_days: "",
  early_pay_discount_computation: "base_amount",
};

function buildExamplePreview(form: PaymentTermFormState): string {
  const normalizedName = form.name.trim();

  if (form.early_payment_discount) {
    const percentage = form.discount_percentage.trim();
    const days = form.discount_days.trim();

    if (percentage && days) {
      return `Early Payment Discount: ${percentage}% if paid before ${days} days`;
    }

    return "Early Payment Discount: - if paid before - days";
  }

  if (normalizedName.toLowerCase() === "immediate payment") {
    return "Payment Terms: Immediate Payment";
  }

  if (normalizedName.length > 0) {
    return `Payment Terms: ${normalizedName}`;
  }

  return "Payment Terms: -";
}

export default function NewPaymentTermPage() {
  const router = useRouter();

  const [form, setForm] = useState<PaymentTermFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const payload: CreatePaymentTermRequestBody = {
        name: form.name.trim(),
        early_payment_discount: form.early_payment_discount,
      };

      if (!payload.name) {
        setIsError(true);
        setMessage("Name is required");
        return;
      }

      if (form.early_payment_discount) {
        const percentage = Number(form.discount_percentage);
        const days = Number(form.discount_days);

        if (
          !Number.isFinite(percentage) ||
          percentage <= 0 ||
          percentage > 100 ||
          !Number.isInteger(days) ||
          days <= 0
        ) {
          setIsError(true);
          setMessage("Provide valid discount percentage and discount days");
          return;
        }

        payload.discount_percentage = percentage;
        payload.discount_days = days;
        payload.early_pay_discount_computation = form.early_pay_discount_computation;
      }

      const token = await getCurrentIdToken();
      const response = await fetch("/api/payment-terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as CreatePaymentTermResponse;

      if (!response.ok || !responsePayload.success) {
        setIsError(true);
        setMessage(responsePayload.error ?? "Failed to create payment term");
        return;
      }

      router.push("/payment-terms");
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "Failed to create payment term";
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Billing</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Create Payment Term</h1>
          </div>
          <Link
            href="/payment-terms"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Payment Terms
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="sm:col-span-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.early_payment_discount}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, early_payment_discount: event.target.checked }))
              }
            />
            <span className="text-sm font-medium text-zinc-700">Early Payment Discount</span>
          </label>

          {form.early_payment_discount ? (
            <>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-700">Discount Percentage</span>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.discount_percentage}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, discount_percentage: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-700">Discount Days</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={form.discount_days}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, discount_days: event.target.value }))
                  }
                  className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                />
              </label>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-zinc-700">Early Pay Discount Computation</span>
                <select
                  value={form.early_pay_discount_computation}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      early_pay_discount_computation: event.target.value as EarlyPayDiscountComputation,
                    }))
                  }
                  className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                >
                  <option value="base_amount">Base Amount</option>
                  <option value="total_amount">Total Amount</option>
                </select>
              </label>
            </>
          ) : null}

          <div className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Example Preview (Auto)</span>
            <p className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              {buildExamplePreview(form)}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
          >
            {isSubmitting ? "Creating..." : "Create Payment Term"}
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
