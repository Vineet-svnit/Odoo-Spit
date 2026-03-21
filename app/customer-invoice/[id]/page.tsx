"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { CustomerPayment } from "@/types/customerPayment";
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

interface CustomerPaymentsResponse {
  success?: boolean;
  data?: CustomerPayment[];
  error?: string;
}

interface PaymentTermsResponse {
  success?: boolean;
  data?: PaymentTerm[];
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

export default function CustomerInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const customerInvoiceId = typeof params.id === "string" ? params.id : "";

  const [customerInvoice, setCustomerInvoice] = useState<CustomerInvoice | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [linkedPayment, setLinkedPayment] = useState<CustomerPayment | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    if (!customerInvoice) return;
    document.title = `${customerInvoice.invoiceNumber || "customer-invoice"}`;
    window.print();
  };

  useEffect(() => {
    if (!customerInvoiceId) {
      setError("Invalid customer invoice id");
      setIsLoading(false);
      return;
    }

    async function loadCustomerInvoice() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch(`/api/customer-invoice/${customerInvoiceId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as CustomerInvoiceResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setCustomerInvoice(null);
          setSaleOrder(null);
          setError(payload.error ?? "Failed to fetch customer invoice");
          return;
        }

        setCustomerInvoice(payload.data);

        const [saleOrderResponse, productsResponse, paymentResponse, paymentTermsResponse] = await Promise.all([
          fetch(`/api/sale-order/${payload.data.saleOrderId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/product", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`/api/customer-payment?customerInvoiceId=${payload.data.customerInvoiceId}`, {
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
        const productsPayload = (await productsResponse.json()) as { success?: boolean; data?: Array<{ productId: string; productName: string }>; error?: string };
        const paymentPayload = (await paymentResponse.json()) as CustomerPaymentsResponse;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as PaymentTermsResponse;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          setSaleOrder(null);
          setError(saleOrderPayload.error ?? "Failed to fetch sales order");
          return;
        }

        if (!productsResponse.ok || !productsPayload.success) {
          setSaleOrder(null);
          setError(productsPayload.error ?? "Failed to fetch products");
          return;
        }

        if (paymentResponse.ok && paymentPayload.success) {
          const payments = Array.isArray(paymentPayload.data) ? paymentPayload.data : [];
          setLinkedPayment(payments.length > 0 ? payments[0] : null);
        } else {
          setLinkedPayment(null);
        }

        if (paymentTermsResponse.ok && paymentTermsPayload.success) {
          const terms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
          setPaymentTerm(terms.find((term) => term.termId === payload.data?.paymentTermId) ?? null);
        } else {
          setPaymentTerm(null);
        }

        const products = Array.isArray(productsPayload.data) ? productsPayload.data : [];
        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        setProductNameById(productMap);
        setSaleOrder(saleOrderPayload.data);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch customer invoice";
        setCustomerInvoice(null);
        setSaleOrder(null);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadCustomerInvoice();
  }, [customerInvoiceId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Sales</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Customer Invoice Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download
            </button>
            <Link
              href="/customer-invoice"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Customer Invoices
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading customer invoice...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {customerInvoice ? (
          <>
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Invoice Number</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{customerInvoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer Name</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{customerInvoice.customerName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sales Order</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{saleOrder?.soNumber ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{linkedPayment?.payId ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Payment Term</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{paymentTerm?.name ?? "-"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/sales-order/${customerInvoice.saleOrderId}`}
                className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Order
              </Link>
              {linkedPayment ? (
                <Link
                  href={`/customer-payment/${linkedPayment.customerPaymentId}`}
                  className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  Payment
                </Link>
              ) : null}
              {customerInvoice.amountDue > 0 ? (
                <Link
                  href={`/customer-invoice/${customerInvoice.customerInvoiceId}/payment`}
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
                  {(saleOrder?.order ?? []).map((item, index) => {
                    const untaxedAmount = item.qty * item.unitPrice;

                    return (
                      <tr key={`${item.product}-${index}`}>
                        <td className="px-4 py-3 text-zinc-800">{productNameById[item.product] ?? item.product}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">{item.qty}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{untaxedAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">{item.tax.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-800">₹{item.taxAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{item.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}

                  {customerInvoice.couponLines.map((couponLine) => (
                    <tr key={`${couponLine.offerId}-${couponLine.couponId}`} className="bg-amber-50/40">
                      <td className="px-4 py-3 text-zinc-800">{couponLine.offerName}</td>
                      <td className="px-4 py-3 text-right text-zinc-800">1</td>
                      <td className="px-4 py-3 text-right text-zinc-800">-{couponLine.discountPercentage.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-medium text-red-700">-₹{couponLine.discountAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">-</td>
                      <td className="px-4 py-3 text-right text-zinc-500">-</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{couponLine.discountAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Total Taxed
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{customerInvoice.subtotalTaxed.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Coupon Discounts
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{customerInvoice.couponDiscountTotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Amount Due
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900">₹{customerInvoice.amountDue.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">Payment Summary</p>

              {!customerInvoice.paidOn ? (
                <p className="mt-3 text-sm text-zinc-600">No payment recorded yet.</p>
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
                      <tr>
                        <td className="px-4 py-3 text-zinc-700">{formatDate(customerInvoice.paidOn.date)}</td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">₹{customerInvoice.paidOn.amount.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Invoice Date</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(customerInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Due Date</p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(customerInvoice.invoiceDue)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Amount Due</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">₹{customerInvoice.amountDue.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
