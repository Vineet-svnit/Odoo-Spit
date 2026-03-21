"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { PaymentBill } from "@/types/paymentBill";
import type { Product } from "@/types/product";
import type { PurchaseOrder } from "@/types/purchaseOrder";
import type { VendorBill } from "@/types/vendorBill";

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

interface ProductResponse {
  success?: boolean;
  data?: Product[];
  error?: string;
}

interface PaymentBillsResponse {
  success?: boolean;
  data?: PaymentBill[];
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

export default function VendorBillDetailPage() {
  const params = useParams<{ id: string }>();
  const vendorBillId = typeof params.id === "string" ? params.id : "";

  const [vendorBill, setVendorBill] = useState<VendorBill | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [linkedPayment, setLinkedPayment] = useState<PaymentBill | null>(null);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    if (!vendorBill) return;
    document.title = `${vendorBill.billNumber || "vendor-bill"}`;
    window.print();
  };

  useEffect(() => {
    if (!vendorBillId) {
      setError("Invalid vendor bill id");
      setIsLoading(false);
      return;
    }

    async function loadVendorBill() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch(`/api/vendor-bill/${vendorBillId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as VendorBillResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setVendorBill(null);
          setPurchaseOrder(null);
          setError(payload.error ?? "Failed to fetch vendor bill");
          return;
        }

        setVendorBill(payload.data);

        const [purchaseOrderResponse, productsResponse] = await Promise.all([
          fetch(`/api/purchaseorder/${payload.data.purchaseOrder}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/product", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const purchaseOrderPayload =
          (await purchaseOrderResponse.json()) as PurchaseOrderResponse;
        const productsPayload = (await productsResponse.json()) as ProductResponse;

        if (!purchaseOrderResponse.ok || !purchaseOrderPayload.success || !purchaseOrderPayload.data) {
          setPurchaseOrder(null);
          setError(purchaseOrderPayload.error ?? "Failed to fetch purchase order");
          return;
        }

        if (!productsResponse.ok || !productsPayload.success) {
          setPurchaseOrder(null);
          setError(productsPayload.error ?? "Failed to fetch products");
          return;
        }

        const products = Array.isArray(productsPayload.data) ? productsPayload.data : [];
        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        setProductNameById(productMap);
        setPurchaseOrder(purchaseOrderPayload.data);

        const paymentResponse = await fetch(
          `/api/payment-bill?vendorBillId=${payload.data.vendorBillId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const paymentPayload = (await paymentResponse.json()) as PaymentBillsResponse;

        if (paymentResponse.ok && paymentPayload.success) {
          const payments = Array.isArray(paymentPayload.data) ? paymentPayload.data : [];
          setLinkedPayment(payments.length > 0 ? payments[0] : null);
        } else {
          setLinkedPayment(null);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch vendor bill";
        setVendorBill(null);
        setPurchaseOrder(null);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadVendorBill();
  }, [vendorBillId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Vendor Bill Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download
            </button>
            <Link
              href="/vendor-bill"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Vendor Bills
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading vendor bill...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {vendorBill ? (
          <>
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Bill Number</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{vendorBill.billNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer Name</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{vendorBill.customerName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Purchase Order</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{purchaseOrder?.poNumber ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{linkedPayment?.payId ?? "-"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/purchase-order/${vendorBill.purchaseOrder}`}
                className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Order
              </Link>
              {linkedPayment ? (
                <Link
                  href={`/vendor-payment/${linkedPayment.paymentBillId}`}
                  className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  Payment
                </Link>
              ) : null}
              {vendorBill.amountDue > 0 ? (
                <Link
                  href={`/vendor-bill/${vendorBill.vendorBillId}/payment`}
                  className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Pay
                </Link>
              ) : null}
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Untaxed Amount</th>
                    <th className="px-4 py-3 text-right">Tax (%)</th>
                    <th className="px-4 py-3 text-right">Tax Amount</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(purchaseOrder?.order ?? []).map((item, index) => {
                    const untaxedAmount = item.qty * item.unitPrice;

                    return (
                      <tr key={`${item.product}-${index}`}>
                        <td className="px-4 py-3 text-zinc-800">
                          {productNameById[item.product] ?? item.product}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-800">{item.qty}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{untaxedAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">{item.tax.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{item.taxAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{item.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={5}>
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      Untaxed: ₹{(purchaseOrder?.totalUntaxed ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      Taxed: ₹{(purchaseOrder?.totalTaxed ?? 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">
                Previous Payments
              </p>

              {vendorBill.paidOn.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">No payments recorded yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {vendorBill.paidOn.map((payment, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-zinc-700">{formatDate(payment.date)}</td>
                          <td className="px-4 py-3 text-right font-medium text-zinc-900">₹{payment.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Bill Date</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(vendorBill.billDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Due Date</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(vendorBill.billDue)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount Due</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">₹{vendorBill.amountDue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
