"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { Coupon } from "@/types/coupon";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { Offer } from "@/types/offer";
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

interface CouponPrintRow {
  key: string;
  offerName: string;
  couponCode: string;
  discountPercentage: number;
  discountAmount: number;
}

export default function PortalSaleOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { isLoading: isAuthLoading } = useRequireAuth();

  const saleOrderId = typeof params.id === "string" ? params.id : "";

  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<CustomerInvoice | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | null>(null);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offerById, setOfferById] = useState<Record<string, Offer>>({});
  const [couponById, setCouponById] = useState<Record<string, Coupon>>({});

  useEffect(() => {
    async function loadData() {
      if (!saleOrderId) {
        setError("Invalid sale order id");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();

        const [saleOrderResponse, userResponse, invoicesResponse, paymentTermsResponse, productsResponse, offersResponse] = await Promise.all([
          fetch(`/api/sale-order/${saleOrderId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/users?current=true", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/customer-invoice", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/payment-terms", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/product", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/offer", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const saleOrderPayload = (await saleOrderResponse.json()) as ApiResponse<SaleOrder>;
        const userPayload = (await userResponse.json()) as ApiResponse<User>;
        const invoicesPayload = (await invoicesResponse.json()) as ApiResponse<CustomerInvoice[]>;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as ApiResponse<PaymentTerm[]>;
        const productsPayload = (await productsResponse.json()) as ApiResponse<ProductSummary[]>;
        const offersPayload = (await offersResponse.json()) as ApiResponse<Offer[]>;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          throw new Error(saleOrderPayload.error ?? "Failed to load sale order");
        }

        if (!userResponse.ok || !userPayload.success || !userPayload.data) {
          throw new Error(userPayload.error ?? "Failed to load profile");
        }

        if (!invoicesResponse.ok || !invoicesPayload.success) {
          throw new Error(invoicesPayload.error ?? "Failed to load invoices");
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          throw new Error(paymentTermsPayload.error ?? "Failed to load payment terms");
        }

        if (!productsResponse.ok || !productsPayload.success) {
          throw new Error(productsPayload.error ?? "Failed to load products");
        }

        if (!offersResponse.ok || !offersPayload.success) {
          throw new Error(offersPayload.error ?? "Failed to load offers");
        }

        const saleOrderData = saleOrderPayload.data;
        const invoices = Array.isArray(invoicesPayload.data) ? invoicesPayload.data : [];
        const paymentTerms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
        const products = Array.isArray(productsPayload.data) ? productsPayload.data : [];
        const offers = Array.isArray(offersPayload.data) ? offersPayload.data : [];

        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        const nextOfferById = offers.reduce<Record<string, Offer>>((accumulator, offer) => {
          accumulator[offer.discountId] = offer;
          return accumulator;
        }, {});

        const couponIds = Array.from(new Set(offers.flatMap((offer) => offer.coupons.map((coupon) => coupon.couponId))));
        let nextCouponById: Record<string, Coupon> = {};

        if (couponIds.length > 0) {
          const couponsResponse = await fetch(`/api/coupon?ids=${couponIds.join(",")}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const couponsPayload = (await couponsResponse.json()) as ApiResponse<Coupon[]>;
          if (couponsResponse.ok && couponsPayload.success) {
            const coupons = Array.isArray(couponsPayload.data) ? couponsPayload.data : [];
            nextCouponById = coupons.reduce<Record<string, Coupon>>((accumulator, coupon) => {
              accumulator[coupon.couponId] = coupon;
              return accumulator;
            }, {});
          }
        }

        setCurrentUser(userPayload.data);
        setSaleOrder(saleOrderData);
        setLinkedInvoice(invoices.find((invoice) => invoice.saleOrderId === saleOrderData.saleOrderId) ?? null);
        setPaymentTerm(paymentTerms.find((term) => term.termId === saleOrderData.paymentTermId) ?? null);
        setProductNameById(productMap);
        setOfferById(nextOfferById);
        setCouponById(nextCouponById);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load sale order");
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [saleOrderId]);

  const couponRows = useMemo<CouponPrintRow[]>(() => {
    if (!saleOrder) {
      return [];
    }

    return (saleOrder.selectedCoupons || []).map((selectedCoupon) => {
      const offer = offerById[selectedCoupon.offerId];
      const coupon = couponById[selectedCoupon.couponId];
      const discountPercentage = offer?.discountPercentage ?? 0;
      const discountAmount = (saleOrder.totalUntaxed * discountPercentage) / 100;

      return {
        key: `${selectedCoupon.offerId}-${selectedCoupon.couponId}`,
        offerName: offer?.name ?? selectedCoupon.offerId,
        couponCode: coupon?.code ?? selectedCoupon.couponId,
        discountPercentage,
        discountAmount,
      };
    });
  }, [couponById, offerById, saleOrder]);

  const totalTax = saleOrder ? saleOrder.totalTaxed - saleOrder.totalUntaxed : 0;
  const invoiceStatus = linkedInvoice ? (linkedInvoice.amountDue <= 0 ? "Paid" : "Unpaid") : "Unpaid";

  function handlePrint() {
    if (!saleOrder) {
      return;
    }

    document.title = saleOrder.soNumber || "sale-order";
    window.print();
  }

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <section className="mx-auto max-w-6xl rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">Sale Order View</h1>
              <p className="mt-1 text-sm text-zinc-600">Detailed order, invoice reference and itemized lines.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Print
              </button>
              <Link
                href="/portal/sale-order"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Back to Orders
              </Link>
            </div>
          </div>

          {isAuthLoading || isLoading ? <p className="text-sm text-zinc-600">Loading sale order...</p> : null}
          {error ? <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {!isAuthLoading && !isLoading && !error && saleOrder ? (
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
                  <p><span className="font-semibold text-zinc-800">SO Number:</span> {saleOrder.soNumber}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Order Date:</span> {formatFirebaseDate(saleOrder.soDate)}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Invoice:</span> {linkedInvoice ? "Yes" : "No"}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Invoice Number:</span> {linkedInvoice?.invoiceNumber ?? "-"}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Invoice Date:</span> {linkedInvoice ? formatFirebaseDate(linkedInvoice.invoiceDate) : "-"}</p>
                  <p className="mt-1"><span className="font-semibold text-zinc-800">Status:</span> {invoiceStatus}</p>
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

                    {couponRows.map((couponLine) => (
                      <tr key={couponLine.key} className="bg-amber-50/50">
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
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Total Untaxed</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{saleOrder.totalUntaxed.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Tax</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{totalTax.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>Total</td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900">₹{saleOrder.totalTaxed.toFixed(2)}</td>
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
