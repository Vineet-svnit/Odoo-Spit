"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { CustomerPayment } from "@/types/customerPayment";
import type { PaymentTerm } from "@/types/paymentTerm";
import type { SaleOrder } from "@/types/saleOrder";
import type { User } from "@/types/user";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

interface ProductSummary {
  productId: string;
  productName: string;
}

export default function PortalInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { isLoading: isAuthLoading } = useRequireAuth();

  const customerInvoiceId = typeof params.id === "string" ? params.id : "";

  const [customerInvoice, setCustomerInvoice] = useState<CustomerInvoice | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [linkedPayment, setLinkedPayment] = useState<CustomerPayment | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoiceDetails() {
      if (!customerInvoiceId) {
        setError("Invalid customer invoice id");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();

        const [invoiceResponse, userResponse, paymentTermsResponse, productsResponse, paymentsResponse] = await Promise.all([
          fetch(`/api/customer-invoice/${customerInvoiceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/users?current=true", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/payment-terms", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/product", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/customer-payment?customerInvoiceId=${customerInvoiceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const invoicePayload = (await invoiceResponse.json()) as ApiResponse<CustomerInvoice>;
        const userPayload = (await userResponse.json()) as ApiResponse<User>;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as ApiResponse<PaymentTerm[]>;
        const productsPayload = (await productsResponse.json()) as ApiResponse<ProductSummary[]>;
        const paymentsPayload = (await paymentsResponse.json()) as ApiResponse<CustomerPayment[]>;

        if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data) {
          throw new Error(invoicePayload.error ?? "Failed to load customer invoice");
        }

        if (!userResponse.ok || !userPayload.success || !userPayload.data) {
          throw new Error(userPayload.error ?? "Failed to load profile");
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          throw new Error(paymentTermsPayload.error ?? "Failed to load payment terms");
        }

        if (!productsResponse.ok || !productsPayload.success) {
          throw new Error(productsPayload.error ?? "Failed to load products");
        }

        if (!paymentsResponse.ok || !paymentsPayload.success) {
          throw new Error(paymentsPayload.error ?? "Failed to load payment receipt data");
        }

        const invoiceData = invoicePayload.data;

        const saleOrderResponse = await fetch(`/api/sale-order/${invoiceData.saleOrderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const saleOrderPayload = (await saleOrderResponse.json()) as ApiResponse<SaleOrder>;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          throw new Error(saleOrderPayload.error ?? "Failed to load sale order");
        }

        const terms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
        const products = Array.isArray(productsPayload.data) ? productsPayload.data : [];

        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        setCurrentUser(userPayload.data);
        setCustomerInvoice(invoiceData);
        setSaleOrder(saleOrderPayload.data);
        const payments = Array.isArray(paymentsPayload.data) ? paymentsPayload.data : [];
        setLinkedPayment(payments.length > 0 ? payments[0] : null);
        setPaymentTerm(terms.find((term) => term.termId === invoiceData.paymentTermId) ?? null);
        setProductNameById(productMap);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load customer invoice");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvoiceDetails();
  }, [customerInvoiceId]);

  const invoiceStatus = useMemo(() => {
    if (!customerInvoice) {
      return "Unpaid";
    }

    return customerInvoice.amountDue <= 0 ? "Paid" : "Unpaid";
  }, [customerInvoice]);

  function handlePrint() {
    if (!customerInvoice) {
      return;
    }

    document.title = customerInvoice.invoiceNumber || "invoice";
    window.print();
  }

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen app-shell px-6 py-10">
        <section className="app-surface mx-auto max-w-6xl rounded-2xl border border-zinc-200 p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Invoice View</h1>
              <p className="mt-1 text-sm text-zinc-600">Detailed invoice, sales order reference and itemized lines.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Print
              </button>
              {linkedPayment ? (
                <Link
                  href={`/portal/customer-payment/${linkedPayment.customerPaymentId}`}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Payment Receipt
                </Link>
              ) : null}
              {customerInvoice && customerInvoice.amountDue > 0 ? (
                <Link
                  href={`/portal/invoice/${customerInvoice.customerInvoiceId}/payment`}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Pay
                </Link>
              ) : null}
              <Link
                href="/portal/invoice"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Back to Invoices
              </Link>
            </div>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading invoice...</p> : null}
          {error ? <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && !error && customerInvoice && saleOrder ? (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Customer Details</p>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{currentUser?.name ?? "-"}</p>
                  <p className="mt-1 text-sm text-zinc-700">{currentUser?.email ?? "-"}</p>
                  <p className="mt-1 text-sm text-zinc-700">{currentUser?.mobile ?? "-"}</p>
                  <p className="mt-1 text-sm text-zinc-700">
                    {[currentUser?.address.city, currentUser?.address.state, currentUser?.address.pincode]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                  <p><span className="font-semibold text-zinc-800">Invoice Number:</span> {customerInvoice.invoiceNumber}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Invoice Date:</span> {formatFirebaseDate(customerInvoice.invoiceDate)}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Due Date:</span> {formatFirebaseDate(customerInvoice.invoiceDue)}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Status:</span> {invoiceStatus}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">SO Number:</span> {saleOrder.soNumber}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Order Date:</span> {formatFirebaseDate(saleOrder.soDate)}</p>
                </div>
              </div>

              <hr className="my-6 border-zinc-200" />

              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200 text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.12em] text-zinc-600">
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
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {saleOrder.order.map((item, index) => {
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
                      <tr key={`${couponLine.offerId}-${couponLine.couponId}`} className="bg-amber-50/50">
                        <td className="px-4 py-3 text-zinc-800">{couponLine.offerName} ({couponLine.couponCode})</td>
                        <td className="px-4 py-3 text-right text-zinc-700">1</td>
                        <td className="px-4 py-3 text-right text-zinc-700">-{couponLine.discountPercentage.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-medium text-red-700">-₹{couponLine.discountAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-zinc-500">-</td>
                        <td className="px-4 py-3 text-right text-zinc-500">-</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{couponLine.discountAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50">
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Subtotal Untaxed</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{customerInvoice.subtotalUntaxed.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Subtotal Taxed</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{customerInvoice.subtotalTaxed.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Coupon Discounts</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{customerInvoice.couponDiscountTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Amount Due</td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900">₹{customerInvoice.amountDue.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-700">
                  <span className="font-semibold text-zinc-900">Payment Terms:</span> {paymentTerm?.name ?? "-"}
                </p>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}
