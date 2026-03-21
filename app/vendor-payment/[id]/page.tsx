"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PaymentBill } from "@/types/paymentBill";
import type { PurchaseOrder } from "@/types/purchaseOrder";
import type { VendorBill } from "@/types/vendorBill";

interface PaymentBillResponse {
  success?: boolean;
  data?: PaymentBill;
  error?: string;
}

interface VendorBillResponse {
  success?: boolean;
  data?: VendorBill;
  error?: string;
}

interface PurchaseOrderResponse {
  success?: boolean;
  data?: PurchaseOrder;
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

export default function VendorPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const paymentBillId = typeof params.id === "string" ? params.id : "";

  const [paymentBill, setPaymentBill] = useState<PaymentBill | null>(null);
  const [vendorBill, setVendorBill] = useState<VendorBill | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    if (!paymentBill) return;
    document.title = `${paymentBill.payId || "vendor-payment"}`;
    window.print();
  };

  useEffect(() => {
    if (!paymentBillId) {
      setError("Invalid payment id");
      setIsLoading(false);
      return;
    }

    async function loadPayment() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const paymentResponse = await fetch(`/api/payment-bill/${paymentBillId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const paymentPayload = (await paymentResponse.json()) as PaymentBillResponse;

        if (!paymentResponse.ok || !paymentPayload.success || !paymentPayload.data) {
          setPaymentBill(null);
          setVendorBill(null);
          setPurchaseOrder(null);
          setError(paymentPayload.error ?? "Failed to fetch payment details");
          return;
        }

        setPaymentBill(paymentPayload.data);

        const vendorBillResponse = await fetch(`/api/vendor-bill/${paymentPayload.data.vendorBillId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const vendorBillPayload = (await vendorBillResponse.json()) as VendorBillResponse;

        if (!vendorBillResponse.ok || !vendorBillPayload.success || !vendorBillPayload.data) {
          setVendorBill(null);
          setPurchaseOrder(null);
          setError(vendorBillPayload.error ?? "Failed to fetch vendor bill");
          return;
        }

        setVendorBill(vendorBillPayload.data);

        const purchaseOrderResponse = await fetch(
          `/api/purchaseorder/${vendorBillPayload.data.purchaseOrder}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const purchaseOrderPayload =
          (await purchaseOrderResponse.json()) as PurchaseOrderResponse;

        if (!purchaseOrderResponse.ok || !purchaseOrderPayload.success || !purchaseOrderPayload.data) {
          setPurchaseOrder(null);
          return;
        }

        setPurchaseOrder(purchaseOrderPayload.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch payment details";
        setPaymentBill(null);
        setVendorBill(null);
        setPurchaseOrder(null);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPayment();
  }, [paymentBillId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Vendor Payment Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download
            </button>
            <Link
              href="/vendor-payment"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Vendor Payments
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading payment details...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {paymentBill ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pay ID</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{paymentBill.payId}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{paymentBill.paymentType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Partner Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{paymentBill.partnerType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Partner</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{paymentBill.partnerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Date</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {formatDate(paymentBill.paymentDate ?? paymentBill.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">₹{paymentBill.amount.toFixed(2)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Vendor Bill</p>
              {vendorBill ? (
                <Link
                  href={`/vendor-bill/${vendorBill.vendorBillId}`}
                  className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline"
                >
                  {vendorBill.billNumber}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-zinc-700">-</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Purchase Order</p>
              {vendorBill && purchaseOrder ? (
                <Link
                  href={`/purchase-order/${vendorBill.purchaseOrder}`}
                  className="mt-1 inline-flex text-sm font-medium text-emerald-700 hover:underline"
                >
                  {purchaseOrder.poNumber}
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
