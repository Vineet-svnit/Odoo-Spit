"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { CustomerPayment } from "@/types/customerPayment";
import type { SaleOrder } from "@/types/saleOrder";

interface CustomerPaymentResponse {
  success?: boolean;
  data?: CustomerPayment;
  error?: string;
}

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

function formatDate(value: unknown): string {
  const millis = getTimestampMillis(value);

  if (millis === null) {
    return "-";
  }

  return new Date(millis).toLocaleDateString();
}

export default function CustomerPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const customerPaymentId = typeof params.id === "string" ? params.id : "";

  const [customerPayment, setCustomerPayment] = useState<CustomerPayment | null>(null);
  const [customerInvoice, setCustomerInvoice] = useState<CustomerInvoice | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    if (!customerPayment) return;
    document.title = `${customerPayment.payId || "customer-payment"}`;
    window.print();
  };

  useEffect(() => {
    if (!customerPaymentId) {
      setError("Invalid payment id");
      setIsLoading(false);
      return;
    }

    async function loadPayment() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const paymentResponse = await fetch(`/api/customer-payment/${customerPaymentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const paymentPayload = (await paymentResponse.json()) as CustomerPaymentResponse;

        if (!paymentResponse.ok || !paymentPayload.success || !paymentPayload.data) {
          setCustomerPayment(null);
          setCustomerInvoice(null);
          setSaleOrder(null);
          setError(paymentPayload.error ?? "Failed to fetch payment details");
          return;
        }

        setCustomerPayment(paymentPayload.data);

        const invoiceResponse = await fetch(`/api/customer-invoice/${paymentPayload.data.customerInvoiceId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const invoicePayload = (await invoiceResponse.json()) as CustomerInvoiceResponse;

        if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data) {
          setCustomerInvoice(null);
          setSaleOrder(null);
          setError(invoicePayload.error ?? "Failed to fetch customer invoice");
          return;
        }

        setCustomerInvoice(invoicePayload.data);

        const saleOrderResponse = await fetch(`/api/sale-order/${invoicePayload.data.saleOrderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const saleOrderPayload = (await saleOrderResponse.json()) as SaleOrderResponse;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          setSaleOrder(null);
          return;
        }

        setSaleOrder(saleOrderPayload.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch payment details";
        setCustomerPayment(null);
        setCustomerInvoice(null);
        setSaleOrder(null);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPayment();
  }, [customerPaymentId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Sales</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Customer Payment Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download
            </button>
            <Link
              href="/customer-payment"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Customer Payments
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading payment details...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {customerPayment ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pay ID</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{customerPayment.payId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{customerPayment.paymentType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Partner Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{customerPayment.partnerType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Partner</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{customerPayment.partnerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Date</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(customerPayment.paymentDate ?? customerPayment.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">₹{customerPayment.amount.toFixed(2)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer Invoice</p>
              {customerInvoice ? (
                <Link
                  href={`/customer-invoice/${customerInvoice.customerInvoiceId}`}
                  className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline"
                >
                  {customerInvoice.invoiceNumber}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-zinc-700">-</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sales Order</p>
              {customerInvoice && saleOrder ? (
                <Link
                  href={`/sales-order/${customerInvoice.saleOrderId}`}
                  className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline"
                >
                  {saleOrder.soNumber}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-zinc-700">-</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
