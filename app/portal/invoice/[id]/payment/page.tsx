"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { CreateCustomerPaymentRequestBody } from "@/types/customerPayment";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { PaymentTerm } from "@/types/paymentTerm";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

function getTodayDateInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTimestampMillis(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
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

  return 0;
}

function buildPaymentTermPreview(term: PaymentTerm, baseAmount: number, discountAmount: number, payableAmount: number): string {
  let preview = term.example_preview || "";

  const replacements: Record<string, string> = {
    "{discount_percentage}": String(term.discount_percentage ?? 0),
    "{discount_days}": String(term.discount_days ?? 0),
    "{base_amount}": baseAmount.toFixed(2),
    "{discount_amount}": discountAmount.toFixed(2),
    "{payable_amount}": payableAmount.toFixed(2),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    preview = preview.replaceAll(placeholder, value);
  }

  if (!preview.trim()) {
    preview = `Discount ${term.discount_percentage ?? 0}%: ₹${discountAmount.toFixed(2)}`;
  }

  return preview;
}

export default function PortalInvoicePaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoading: isAuthLoading } = useRequireAuth();

  const customerInvoiceId = typeof params.id === "string" ? params.id : "";

  const [invoice, setInvoice] = useState<CustomerInvoice | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null);
  const [nextPayIdPreview, setNextPayIdPreview] = useState("RCV/0001");
  const [paymentDate] = useState(getTodayDateInputValue());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!customerInvoiceId) {
        setError("Invalid customer invoice id");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();

        const [invoiceResponse, paymentTermsResponse, paymentsResponse] = await Promise.all([
          fetch(`/api/customer-invoice/${customerInvoiceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/payment-terms", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/customer-payment", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const invoicePayload = (await invoiceResponse.json()) as ApiResponse<CustomerInvoice>;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as ApiResponse<PaymentTerm[]>;
        const paymentsPayload = (await paymentsResponse.json()) as ApiResponse<Array<{ customerPaymentId: string }>>;

        if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data) {
          throw new Error(invoicePayload.error ?? "Failed to load invoice");
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          throw new Error(paymentTermsPayload.error ?? "Failed to load payment terms");
        }

        if (!paymentsResponse.ok || !paymentsPayload.success) {
          throw new Error(paymentsPayload.error ?? "Failed to load payment records");
        }

        const terms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
        const allPayments = Array.isArray(paymentsPayload.data) ? paymentsPayload.data : [];
        const nextSequence = allPayments.length + 1;

        setInvoice(invoicePayload.data);
        setPaymentTerm(terms.find((term) => term.termId === invoicePayload.data?.paymentTermId) ?? null);
        setNextPayIdPreview(`RCV/${nextSequence.toString().padStart(4, "0")}`);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load payment form");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [customerInvoiceId]);

  const paymentComputation = useMemo(() => {
    if (!invoice) {
      return {
        eligibleForDiscount: false,
        discountAmount: 0,
        payableAmount: 0,
        infoText: "",
      };
    }

    if (!paymentTerm || paymentTerm.name.trim().toLowerCase() === "immediate payment") {
      return {
        eligibleForDiscount: false,
        discountAmount: 0,
        payableAmount: invoice.amountDue,
        infoText: "Immediate payment term. No early discount.",
      };
    }

    const hasEarlyDiscountConfig =
      paymentTerm.early_payment_discount &&
      !!paymentTerm.discount_percentage &&
      !!paymentTerm.discount_days &&
      !!paymentTerm.early_pay_discount_computation;

    if (!hasEarlyDiscountConfig) {
      return {
        eligibleForDiscount: false,
        discountAmount: 0,
        payableAmount: invoice.amountDue,
        infoText: paymentTerm.example_preview || "No early discount configured for this payment term.",
      };
    }

    const invoiceDateMs = getTimestampMillis(invoice.invoiceDate);
    const discountDeadline = invoiceDateMs + (paymentTerm.discount_days as number) * 24 * 60 * 60 * 1000;
    const eligibleForDiscount = Date.now() <= discountDeadline;

    const baseAmount =
      paymentTerm.early_pay_discount_computation === "base_amount"
        ? Math.max(0, invoice.subtotalUntaxed - invoice.couponDiscountTotal)
        : invoice.amountDue;

    const discountAmount = eligibleForDiscount
      ? (baseAmount * (paymentTerm.discount_percentage as number)) / 100
      : 0;

    const payableAmount = Math.max(0, invoice.amountDue - discountAmount);

    return {
      eligibleForDiscount,
      discountAmount,
      payableAmount,
      infoText: buildPaymentTermPreview(paymentTerm, baseAmount, discountAmount, payableAmount),
    };
  }, [invoice, paymentTerm]);

  async function handlePay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invoice) {
      setError("Invoice not loaded");
      return;
    }

    if (paymentComputation.payableAmount <= 0) {
      setError("Payable amount must be greater than 0");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const token = await getCurrentIdToken();
      const payload: CreateCustomerPaymentRequestBody = {
        customerInvoiceId: invoice.customerInvoiceId,
        paymentType: "receive",
        partnerType: "customer",
        partnerName: invoice.customerName,
        amount: Number(paymentComputation.payableAmount.toFixed(2)),
      };

      const response = await fetch("/api/customer-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as ApiResponse<{ customerPaymentId: string }>;

      if (!response.ok || !responsePayload.success) {
        throw new Error(responsePayload.error ?? "Failed to create payment");
      }

      router.push(`/portal/invoice/${invoice.customerInvoiceId}`);
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Failed to create payment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen app-shell px-6 py-10">
        <section className="app-surface mx-auto max-w-3xl rounded-2xl border border-zinc-200 p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Invoice Payment</h1>
              <p className="mt-1 text-sm text-zinc-600">Single full payment for this invoice.</p>
            </div>
            <Link
              href={invoice ? `/portal/invoice/${invoice.customerInvoiceId}` : "/portal/invoice"}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Back
            </Link>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading payment form...</p> : null}
          {error ? <p className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && invoice ? (
            <form onSubmit={handlePay} className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Partner</span>
                  <input value={invoice.customerName} readOnly className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Pay ID</span>
                  <input value={nextPayIdPreview} readOnly className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Invoice Number</span>
                  <input value={invoice.invoiceNumber} readOnly className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Payment Date</span>
                  <input value={paymentDate} readOnly className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700" />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Invoice Date</span>
                  <input value={formatFirebaseDate(invoice.invoiceDate)} readOnly className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700" />
                </label>

                {paymentTerm && paymentTerm.name.trim().toLowerCase() !== "immediate payment" ? (
                  <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <p className="font-semibold">Payment Term Note</p>
                    <p className="mt-1">{paymentComputation.infoText}</p>
                    <p className="mt-1">
                      Discount Applied: ₹{paymentComputation.discountAmount.toFixed(2)}
                      {paymentComputation.eligibleForDiscount ? "" : " (condition not fulfilled)"}
                    </p>
                  </div>
                ) : null}

                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Amount (Auto-filled)</span>
                  <input
                    value={paymentComputation.payableAmount.toFixed(2)}
                    readOnly
                    className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm font-semibold text-zinc-900"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-zinc-400"
              >
                {isSubmitting ? "Processing..." : "Pay"}
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </>
  );
}
