"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { CustomerPayment } from "@/types/customerPayment";
import type { SaleOrder } from "@/types/saleOrder";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export default function PortalCustomerPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const { isLoading: isAuthLoading } = useRequireAuth();

  const customerPaymentId = typeof params.id === "string" ? params.id : "";

  const [customerPayment, setCustomerPayment] = useState<CustomerPayment | null>(null);
  const [customerInvoice, setCustomerInvoice] = useState<CustomerInvoice | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayment() {
      if (!customerPaymentId) {
        setError("Invalid payment id");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();

        const paymentResponse = await fetch(`/api/customer-payment/${customerPaymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const paymentPayload = (await paymentResponse.json()) as ApiResponse<CustomerPayment>;

        if (!paymentResponse.ok || !paymentPayload.success || !paymentPayload.data) {
          throw new Error(paymentPayload.error ?? "Failed to load payment details");
        }

        const invoiceResponse = await fetch(`/api/customer-invoice/${paymentPayload.data.customerInvoiceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const invoicePayload = (await invoiceResponse.json()) as ApiResponse<CustomerInvoice>;

        if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data) {
          throw new Error(invoicePayload.error ?? "Failed to load invoice details");
        }

        const saleOrderResponse = await fetch(`/api/sale-order/${invoicePayload.data.saleOrderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const saleOrderPayload = (await saleOrderResponse.json()) as ApiResponse<SaleOrder>;

        setCustomerPayment(paymentPayload.data);
        setCustomerInvoice(invoicePayload.data);
        setSaleOrder(saleOrderResponse.ok && saleOrderPayload.success ? saleOrderPayload.data ?? null : null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load payment details");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPayment();
  }, [customerPaymentId]);

  function handlePrint() {
    if (!customerPayment) {
      return;
    }

    document.title = customerPayment.payId || "payment-receipt";
    window.print();
  }

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen app-shell px-6 py-10">
        <section className="app-surface mx-auto max-w-4xl rounded-2xl border border-zinc-200 p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Payment Receipt</h1>
              <p className="mt-1 text-sm text-zinc-600">Customer payment details and linked invoice/order.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Print
              </button>
              <Link
                href={customerInvoice ? `/portal/invoice/${customerInvoice.customerInvoiceId}` : "/portal/invoice"}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Back to Invoice
              </Link>
            </div>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading payment receipt...</p> : null}
          {error ? <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && !error && customerPayment ? (
            <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pay ID</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{customerPayment.payId}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Date</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{formatFirebaseDate(customerPayment.paymentDate ?? customerPayment.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Partner</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{customerPayment.partnerName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">₹{customerPayment.amount.toFixed(2)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Invoice</p>
                {customerInvoice ? (
                  <Link href={`/portal/invoice/${customerInvoice.customerInvoiceId}`} className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline">
                    {customerInvoice.invoiceNumber}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-zinc-700">-</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sales Order</p>
                {customerInvoice && saleOrder ? (
                  <Link href={`/portal/sale-order/${customerInvoice.saleOrderId}`} className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline">
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
    </>
  );
}
