"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { VendorBill } from "@/types/vendorBill";

interface VendorBillResponse {
  success?: boolean;
  data?: VendorBill;
  error?: string;
}

interface PaymentBillsResponse {
  success?: boolean;
  data?: Array<{ paymentBillId: string }>;
  error?: string;
}

interface CreatePaymentBillResponse {
  success?: boolean;
  data?: {
    paymentBillId: string;
    payId: string;
    vendorBillId: string;
  };
  error?: string;
}

function toCurrencyInput(value: number): string {
  return value.toFixed(2);
}

function getTodayDateInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BillPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vendorBillId = typeof params.id === "string" ? params.id : "";

  const [vendorBill, setVendorBill] = useState<VendorBill | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [nextPayIdPreview, setNextPayIdPreview] = useState("PAY/0001");
  const [paymentDate] = useState(getTodayDateInputValue());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!vendorBillId) {
      setIsError(true);
      setMessage("Invalid vendor bill id");
      setIsLoading(false);
      return;
    }

    async function loadData() {
      setIsLoading(true);
      setIsError(false);
      setMessage(null);

      try {
        const token = await getCurrentIdToken();
        const [vendorBillResponse, paymentBillsResponse] = await Promise.all([
          fetch(`/api/vendor-bill/${vendorBillId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/payment-bill", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const vendorBillPayload = (await vendorBillResponse.json()) as VendorBillResponse;
        const paymentBillsPayload = (await paymentBillsResponse.json()) as PaymentBillsResponse;

        if (!vendorBillResponse.ok || !vendorBillPayload.success || !vendorBillPayload.data) {
          setIsError(true);
          setMessage(vendorBillPayload.error ?? "Failed to fetch vendor bill");
          return;
        }

        if (!paymentBillsResponse.ok || !paymentBillsPayload.success) {
          setIsError(true);
          setMessage(paymentBillsPayload.error ?? "Failed to fetch payments");
          return;
        }

        const allPayments = Array.isArray(paymentBillsPayload.data)
          ? paymentBillsPayload.data
          : [];

        const nextSequence = allPayments.length + 1;
        const preview = `PAY/${nextSequence.toString().padStart(4, "0")}`;

        setVendorBill(vendorBillPayload.data);
        setPartnerName(vendorBillPayload.data.customerName);
        setAmount(toCurrencyInput(vendorBillPayload.data.amountDue));
        setNextPayIdPreview(preview);
      } catch (fetchError) {
        const fallback = fetchError instanceof Error ? fetchError.message : "Failed to load payment data";
        setIsError(true);
        setMessage(fallback);
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [vendorBillId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!vendorBill) {
      setIsError(true);
      setMessage("Vendor bill not loaded");
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setIsError(true);
      setMessage("Amount must be greater than 0");
      return;
    }

    if (parsedAmount > vendorBill.amountDue) {
      setIsError(true);
      setMessage("Amount cannot be greater than unpaid amount");
      return;
    }

    setIsSubmitting(true);
    setIsError(false);
    setMessage(null);

    try {
      const token = await getCurrentIdToken();
      const response = await fetch("/api/payment-bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorBillId: vendorBill.vendorBillId,
          paymentType: "send",
          partnerType: "vendor",
          partnerName,
          amount: parsedAmount,
        }),
      });

      const payload = (await response.json()) as CreatePaymentBillResponse;

      if (!response.ok || !payload.success) {
        setIsError(true);
        setMessage(payload.error ?? "Failed to create payment");
        return;
      }

      router.push(`/vendor-bill/${vendorBill.vendorBillId}`);
    } catch {
      setIsError(true);
      setMessage("Failed to create payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Bill Payment</h1>
          </div>
          <Link
            href={vendorBill ? `/vendor-bill/${vendorBill.vendorBillId}` : "/vendor-bill"}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading payment form...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Payment Type</p>
                <div className="mt-2 flex gap-4 text-sm text-zinc-800">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked readOnly />
                    Send
                  </label>
                  <label className="inline-flex items-center gap-2 opacity-50">
                    <input type="radio" disabled />
                    Receive
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Partner Type</p>
                <div className="mt-2 flex gap-4 text-sm text-zinc-800">
                  <label className="inline-flex items-center gap-2 opacity-50">
                    <input type="radio" disabled />
                    Customer
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked readOnly />
                    Vendor
                  </label>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Partner</span>
                <input
                  value={partnerName}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Pay ID</span>
                <input
                  value={nextPayIdPreview}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
              </label>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Payment Date</span>
                <input
                  value={paymentDate}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
              </label>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Amount</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={vendorBill ? vendorBill.amountDue : undefined}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                  required
                />
                {vendorBill ? (
                  <p className="text-xs text-zinc-600">Unpaid amount: ₹{vendorBill.amountDue.toFixed(2)}</p>
                ) : null}
              </label>
            </div>

            {message ? (
              <p className={`rounded-xl px-4 py-3 text-sm ${isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                {message}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || (vendorBill ? vendorBill.amountDue <= 0 : true)}
                className="h-11 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Processing..." : "Pay"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
