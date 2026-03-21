"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Product } from "@/types/product";
import type { PurchaseOrder } from "@/types/purchaseOrder";

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

interface ContactRow {
  contactId: string;
  name: string;
  type: "customer" | "vendor" | "both";
}

interface ContactsResponse {
  success?: boolean;
  data?: ContactRow[];
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

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const purchaseOrderId = typeof params.id === "string" ? params.id : "";

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [vendorNameById, setVendorNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseOrderId) {
      setError("Invalid purchase order id");
      setIsLoading(false);
      return;
    }

    async function loadPurchaseOrder() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const [purchaseOrderResponse, productResponse, contactsResponse] = await Promise.all([
          fetch(`/api/purchaseorder/${purchaseOrderId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/product", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/contacts", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const purchaseOrderPayload = (await purchaseOrderResponse.json()) as PurchaseOrderResponse;
        const productPayload = (await productResponse.json()) as ProductResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;

        if (!purchaseOrderResponse.ok || !purchaseOrderPayload.success || !purchaseOrderPayload.data) {
          setError(purchaseOrderPayload.error ?? "Failed to fetch purchase order");
          setPurchaseOrder(null);
          return;
        }

        if (!productResponse.ok || !productPayload.success) {
          setError(productPayload.error ?? "Failed to fetch products");
          setPurchaseOrder(null);
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          setPurchaseOrder(null);
          return;
        }

        const products = Array.isArray(productPayload.data) ? productPayload.data : [];
        const contacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];

        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        const vendorMap = contacts.reduce<Record<string, string>>((accumulator, contact) => {
          accumulator[contact.contactId] = contact.name;
          return accumulator;
        }, {});

        setProductNameById(productMap);
        setVendorNameById(vendorMap);
        setPurchaseOrder(purchaseOrderPayload.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch purchase order";
        setError(message);
        setPurchaseOrder(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadPurchaseOrder();
  }, [purchaseOrderId]);

  const vendorName = useMemo(() => {
    if (!purchaseOrder) {
      return "-";
    }

    return vendorNameById[purchaseOrder.vendorId] ?? "Unknown Vendor";
  }, [purchaseOrder, vendorNameById]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Purchase Order Detail</h1>
          </div>
          <Link
            href="/purchase-order"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Purchase Orders
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading purchase order...</p> : null}

        {error ? (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        {purchaseOrder ? (
          <>
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">PO Number</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{purchaseOrder.poNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">PO Date</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(purchaseOrder.poDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Vendor</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{vendorName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Vendor ID</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{purchaseOrder.vendorId}</p>
              </div>
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
                  {purchaseOrder.order.map((item, index) => {
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
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">Untaxed: ₹{purchaseOrder.totalUntaxed.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">Taxed: ₹{purchaseOrder.totalTaxed.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
