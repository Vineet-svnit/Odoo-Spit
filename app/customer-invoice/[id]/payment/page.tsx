"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { CreateCustomerPaymentRequestBody } from "@/types/customerPayment";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { PaymentTerm } from "@/types/paymentTerm";
import type { SaleOrder } from "@/types/saleOrder";

interface CustomerInvoiceResponse {
  success?: boolean;
  data?: CustomerInvoice;
  error?: string;
}

interface SaleOrderResponse {
  success?: boolean;
  data?: SaleOrder;
  error?: string;
}

interface PaymentTermsResponse {
  success?: boolean;
  data?: PaymentTerm[];
  error?: string;
}

interface CustomerPaymentResponse {
  success?: boolean;
  data?: {
    customerPaymentId: string;
    payId: string;
    customerInvoiceId: string;
  };
  error?: string;
}

function getTodayDateInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    preview = `Discount ${term.discount_percentage ?? 0}% applied: ₹${discountAmount.toFixed(2)}`;
  } else if (!preview.includes("₹")) {
    preview = `${preview} (Discount: ₹${discountAmount.toFixed(2)}, Payable: ₹${payableAmount.toFixed(2)})`;
  }

  return preview;
}

export default function CustomerInvoicePaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerInvoiceId = typeof params.id === "string" ? params.id : "";

  const [customerInvoice, setCustomerInvoice] = useState<CustomerInvoice | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null);
  const [nextPayIdPreview, setNextPayIdPreview] = useState("RCV/0001");
  const [paymentDate] = useState(getTodayDateInputValue());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!customerInvoiceId) {
      setIsError(true);
      setMessage("Invalid customer invoice id");
      setIsLoading(false);
      return;
    }

    async function loadData() {
      setIsLoading(true);
      setIsError(false);
      setMessage(null);

      try {
        const token = await getCurrentIdToken();
        const [customerInvoiceResponse, customerPaymentsResponse] = await Promise.all([
          fetch(`/api/customer-invoice/${customerInvoiceId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/customer-payment", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const customerInvoicePayload = (await customerInvoiceResponse.json()) as CustomerInvoiceResponse;
        const customerPaymentsPayload = (await customerPaymentsResponse.json()) as { success?: boolean; data?: Array<{ customerPaymentId: string }>; error?: string };

        if (!customerInvoiceResponse.ok || !customerInvoicePayload.success || !customerInvoicePayload.data) {
          setIsError(true);
          setMessage(customerInvoicePayload.error ?? "Failed to fetch customer invoice");
          return;
        }

        if (!customerPaymentsResponse.ok || !customerPaymentsPayload.success) {
          setIsError(true);
          setMessage(customerPaymentsPayload.error ?? "Failed to fetch payments");
          return;
        }

        const [saleOrderResponse, paymentTermsResponse] = await Promise.all([
          fetch(`/api/sale-order/${customerInvoicePayload.data.saleOrderId}`, {
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

        const saleOrderPayload = (await saleOrderResponse.json()) as SaleOrderResponse;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as PaymentTermsResponse;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          setIsError(true);
          setMessage(saleOrderPayload.error ?? "Failed to fetch sales order");
          return;
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          setIsError(true);
          setMessage(paymentTermsPayload.error ?? "Failed to fetch payment terms");
          return;
        }

        const allPayments = Array.isArray(customerPaymentsPayload.data) ? customerPaymentsPayload.data : [];
        const nextSequence = allPayments.length + 1;
        const preview = `RCV/${nextSequence.toString().padStart(4, "0")}`;

        const terms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
        const term = terms.find((item) => item.termId === customerInvoicePayload.data?.paymentTermId) ?? null;

        setCustomerInvoice(customerInvoicePayload.data);
        setSaleOrder(saleOrderPayload.data);
        setPaymentTerm(term);
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
  }, [customerInvoiceId]);

  const paymentComputation = useMemo(() => {
    if (!customerInvoice) {
      return {
        termDiscountAmount: 0,
        payableAmount: 0,
        previewText: "",
      };
    }

    if (!paymentTerm || !paymentTerm.early_payment_discount || !paymentTerm.discount_percentage) {
      return {
        termDiscountAmount: 0,
        payableAmount: customerInvoice.amountDue,
        previewText: "",
      };
    }

    const discountPercent = paymentTerm.discount_percentage;
    const baseAmount = paymentTerm.early_pay_discount_computation === "base_amount"
      ? Math.max(0, customerInvoice.subtotalUntaxed - customerInvoice.couponDiscountTotal)
      : customerInvoice.amountDue;

    const termDiscountAmount = (baseAmount * discountPercent) / 100;
    const payableAmount = Math.max(0, customerInvoice.amountDue - termDiscountAmount);

    return {
      termDiscountAmount,
      payableAmount,
      previewText: buildPaymentTermPreview(paymentTerm, baseAmount, termDiscountAmount, payableAmount),
    };
  }, [customerInvoice, paymentTerm]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerInvoice) {
      setIsError(true);
      setMessage("Customer invoice not loaded");
      return;
    }

    if (paymentComputation.payableAmount <= 0) {
      setIsError(true);
      setMessage("Payable amount must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    setIsError(false);
    setMessage(null);

    try {
      const token = await getCurrentIdToken();
      const payload: CreateCustomerPaymentRequestBody = {
        customerInvoiceId: customerInvoice.customerInvoiceId,
        paymentType: "receive",
        partnerType: "customer",
        partnerName: customerInvoice.customerName,
        amount: paymentComputation.payableAmount,
      };

      const response = await fetch("/api/customer-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as CustomerPaymentResponse;

      if (!response.ok || !responsePayload.success) {
        setIsError(true);
        setMessage(responsePayload.error ?? "Failed to create payment");
        return;
      }

      router.push(`/customer-invoice/${customerInvoice.customerInvoiceId}`);
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Sales</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Customer Payment</h1>
          </div>
          <Link
            href={customerInvoice ? `/customer-invoice/${customerInvoice.customerInvoiceId}` : "/customer-invoice"}
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
                  <label className="inline-flex items-center gap-2 opacity-50">
                    <input type="radio" disabled />
                    Send
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked readOnly />
                    Receive
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Partner Type</p>
                <div className="mt-2 flex gap-4 text-sm text-zinc-800">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked readOnly />
                    Customer
                  </label>
                  <label className="inline-flex items-center gap-2 opacity-50">
                    <input type="radio" disabled />
                    Vendor
                  </label>
                </div>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Partner</span>
                <input
                  value={customerInvoice?.customerName ?? ""}
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

              {paymentTerm && paymentComputation.termDiscountAmount > 0 ? (
                <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">Payment Term Discount</p>
                  <p className="mt-1">{paymentComputation.previewText}</p>
                  <p className="mt-1 font-medium">Discount Applied: ₹{paymentComputation.termDiscountAmount.toFixed(2)}</p>
                </div>
              ) : null}

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Amount</span>
                <input
                  value={paymentComputation.payableAmount.toFixed(2)}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
                {customerInvoice ? (
                  <p className="text-xs text-zinc-600">Invoice amount due: ₹{customerInvoice.amountDue.toFixed(2)}</p>
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
                disabled={isSubmitting || !customerInvoice || customerInvoice.amountDue <= 0}
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
