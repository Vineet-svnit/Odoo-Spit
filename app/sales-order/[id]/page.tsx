"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";
import type { Coupon } from "@/types/coupon";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { Offer } from "@/types/offer";
import type { PaymentTerm } from "@/types/paymentTerm";
import type { SaleOrder, SelectedCoupon } from "@/types/saleOrder";

interface SaleOrderResponse {
  success?: boolean;
  data?: SaleOrder;
  error?: string;
}

interface ProductResponse {
  success?: boolean;
  data?: Array<{ productId: string; productName: string }>;
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
  error?: string;
}

interface PaymentTermsResponse {
  success?: boolean;
  data?: PaymentTerm[];
  error?: string;
}

interface OffersResponse {
  success?: boolean;
  data?: Offer[];
  error?: string;
}

interface CouponsResponse {
  success?: boolean;
  data?: Coupon[];
  error?: string;
}

interface CustomerInvoicesResponse {
  success?: boolean;
  data?: CustomerInvoice[];
  error?: string;
}

interface CreateInvoiceResponse {
  success?: boolean;
  data?: {
    customerInvoiceId: string;
    invoiceNumber: string;
    saleOrderId: string;
  };
  error?: string;
}

interface CouponDraftRow {
  id: string;
  offerId: string;
  couponId: string;
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

function createDraftRow(): CouponDraftRow {
  return {
    id: crypto.randomUUID(),
    offerId: "",
    couponId: "",
  };
}

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const saleOrderId = typeof params.id === "string" ? params.id : "";

  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [customerName, setCustomerName] = useState("-");
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [couponById, setCouponById] = useState<Record<string, Coupon>>({});
  const [couponRows, setCouponRows] = useState<CouponDraftRow[]>([]);
  const [showCouponPanel, setShowCouponPanel] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<CustomerInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    if (!saleOrder) return;
    document.title = `${saleOrder.soNumber || "sales-order"}`;
    window.print();
  };

  useEffect(() => {
    if (!saleOrderId) {
      setError("Invalid sales order id");
      setIsLoading(false);
      return;
    }

    async function loadSalesOrder() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const [saleOrderResponse, productResponse, contactsResponse, paymentTermsResponse, offersResponse, invoicesResponse] = await Promise.all([
          fetch(`/api/sale-order/${saleOrderId}`, {
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
          fetch("/api/payment-terms", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/offer", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/customer-invoice", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const saleOrderPayload = (await saleOrderResponse.json()) as SaleOrderResponse;
        const productPayload = (await productResponse.json()) as ProductResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;
        const paymentTermsPayload = (await paymentTermsResponse.json()) as PaymentTermsResponse;
        const offersPayload = (await offersResponse.json()) as OffersResponse;
        const invoicesPayload = (await invoicesResponse.json()) as CustomerInvoicesResponse;

        if (!saleOrderResponse.ok || !saleOrderPayload.success || !saleOrderPayload.data) {
          setError(saleOrderPayload.error ?? "Failed to fetch sales order");
          setSaleOrder(null);
          return;
        }

        if (!productResponse.ok || !productPayload.success) {
          setError(productPayload.error ?? "Failed to fetch products");
          setSaleOrder(null);
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          setSaleOrder(null);
          return;
        }

        if (!paymentTermsResponse.ok || !paymentTermsPayload.success) {
          setError(paymentTermsPayload.error ?? "Failed to fetch payment terms");
          setSaleOrder(null);
          return;
        }

        if (!offersResponse.ok || !offersPayload.success) {
          setError(offersPayload.error ?? "Failed to fetch offers");
          setSaleOrder(null);
          return;
        }

        if (!invoicesResponse.ok || !invoicesPayload.success) {
          setError(invoicesPayload.error ?? "Failed to fetch invoices");
          setSaleOrder(null);
          return;
        }

        const saleOrderData = saleOrderPayload.data;
        const products = Array.isArray(productPayload.data) ? productPayload.data : [];
        const contacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];
        const terms = Array.isArray(paymentTermsPayload.data) ? paymentTermsPayload.data : [];
        const allOffers = Array.isArray(offersPayload.data) ? offersPayload.data : [];
        const allInvoices = Array.isArray(invoicesPayload.data) ? invoicesPayload.data : [];

        const customer = contacts.find((contact) => contact.contactId === saleOrderData.customerId);

        const productMap = products.reduce<Record<string, string>>((accumulator, product) => {
          accumulator[product.productId] = product.productName;
          return accumulator;
        }, {});

        const now = Date.now();
        const activeOffers = allOffers.filter((offer) => {
          const start = getTimestampMillis(offer.startDate);
          const end = getTimestampMillis(offer.endDate);

          if (start === null || end === null) {
            return false;
          }

          return offer.availableOn === "sales" && now >= start && now <= end;
        });

        const couponIds = activeOffers.flatMap((offer) => offer.coupons.map((entry) => entry.couponId));

        let couponMap: Record<string, Coupon> = {};

        if (couponIds.length > 0) {
          const couponsResponse = await fetch(`/api/coupon?ids=${couponIds.join(",")}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const couponsPayload = (await couponsResponse.json()) as CouponsResponse;

          if (couponsResponse.ok && couponsPayload.success) {
            const coupons = Array.isArray(couponsPayload.data) ? couponsPayload.data : [];
            couponMap = coupons.reduce<Record<string, Coupon>>((accumulator, coupon) => {
              accumulator[coupon.couponId] = coupon;
              return accumulator;
            }, {});
          }
        }

        const selectedCoupons = Array.isArray(saleOrderData.selectedCoupons) ? saleOrderData.selectedCoupons : [];
        const initialRows = selectedCoupons.length > 0
          ? selectedCoupons.map((selected) => ({ id: crypto.randomUUID(), offerId: selected.offerId, couponId: selected.couponId }))
          : [createDraftRow()];

        setSaleOrder(saleOrderData);
        setCustomerName(customer?.name ?? "Unknown Customer");
        setProductNameById(productMap);
        setPaymentTerms(terms);
        setSelectedPaymentTermId(saleOrderData.paymentTermId ?? terms.find((term) => term.isWebsiteDefault)?.termId ?? "");
        setOffers(activeOffers);
        setCouponById(couponMap);
        setCouponRows(initialRows);
        setLinkedInvoice(allInvoices.find((invoice) => invoice.saleOrderId === saleOrderId) ?? null);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch sales order";
        setError(message);
        setSaleOrder(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadSalesOrder();
  }, [saleOrderId]);

  function validateRequiredFields(): boolean {
    if (!selectedPaymentTermId) {
      setError("Please select a payment term before confirming");
      return false;
    }
    return true;
  }

  function handleConfirm() {
    if (validateRequiredFields()) {
      setError(null);
      setIsConfirmed(true);
    }
  }

  const selectedCoupons = useMemo<SelectedCoupon[]>(() => {
    const seenOfferIds = new Set<string>();

    return couponRows
      .filter((row) => row.offerId && row.couponId)
      .filter((row) => {
        if (seenOfferIds.has(row.offerId)) {
          return false;
        }

        seenOfferIds.add(row.offerId);
        return true;
      })
      .map((row) => ({ offerId: row.offerId, couponId: row.couponId }));
  }, [couponRows]);

  const couponLineRows = useMemo(() => {
    if (!saleOrder) {
      return [];
    }

    return selectedCoupons
      .map((selectedCoupon) => {
        const offer = offers.find((item) => item.discountId === selectedCoupon.offerId);

        if (!offer) {
          return null;
        }

        const discountAmount = (saleOrder.totalUntaxed * offer.discountPercentage) / 100;

        return {
          id: `${selectedCoupon.offerId}-${selectedCoupon.couponId}`,
          offerName: offer.name,
          discountPercentage: offer.discountPercentage,
          discountAmount,
        };
      })
      .filter((row): row is { id: string; offerName: string; discountPercentage: number; discountAmount: number } => row !== null);
  }, [offers, saleOrder, selectedCoupons]);

  const couponDiscountTotal = useMemo(
    () => couponLineRows.reduce((sum, row) => sum + row.discountAmount, 0),
    [couponLineRows],
  );

  const netTotal = useMemo(() => {
    if (!saleOrder) {
      return 0;
    }

    return Math.max(0, saleOrder.totalTaxed - couponDiscountTotal);
  }, [couponDiscountTotal, saleOrder]);

  function updateCouponRow(rowId: string, update: Partial<CouponDraftRow>) {
    setCouponRows((previous) =>
      previous.map((row) => (row.id === rowId ? { ...row, ...update } : row)),
    );
  }

  function addCouponRow() {
    setCouponRows((previous) => [...previous, createDraftRow()]);
  }

  function removeCouponRow(rowId: string) {
    setCouponRows((previous) => {
      if (previous.length === 1) {
        return previous;
      }

      return previous.filter((row) => row.id !== rowId);
    });
  }

  function availableCouponsForOffer(offerId: string): Coupon[] {
    const offer = offers.find((item) => item.discountId === offerId);

    if (!offer) {
      return [];
    }

    const now = Date.now();

    return offer.coupons
      .filter((entry) => {
        const entryExpiry = getTimestampMillis(entry.expirationDate);

        if (entryExpiry === null || now > entryExpiry) {
          return false;
        }

        const coupon = couponById[entry.couponId];

        if (!coupon || coupon.status !== "unused") {
          return false;
        }

        const couponExpiry = getTimestampMillis(coupon.expirationDate);

        if (couponExpiry === null) {
          return false;
        }

        // Filter by contactId: show if contactId is null (global coupon) or matches sale order customer
        if (coupon.contactId !== null && coupon.contactId !== saleOrder?.customerId) {
          return false;
        }

        return now <= couponExpiry;
      })
      .map((entry) => couponById[entry.couponId])
      .filter((coupon): coupon is Coupon => Boolean(coupon));
  }

  async function handleCreateInvoice() {
    if (!saleOrder || !selectedPaymentTermId) {
      setError("Please select a payment term before creating invoice");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getCurrentIdToken();
      const response = await fetch("/api/customer-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          saleOrderId: saleOrder.saleOrderId,
          paymentTermId: selectedPaymentTermId,
          selectedCoupons,
        }),
      });

      const payload = (await response.json()) as CreateInvoiceResponse;

      if (!response.ok || !payload.success || !payload.data?.customerInvoiceId) {
        setError(payload.error ?? "Failed to create invoice");
        return;
      }

      router.push(`/customer-invoice/${payload.data.customerInvoiceId}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to create invoice";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_10%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Sales</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Sales Order Detail</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Download
            </button>
            {linkedInvoice ? (
              <Link
                href={`/customer-invoice/${linkedInvoice.customerInvoiceId}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Invoice
              </Link>
            ) : null}
            <Link
              href="/sales-order"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Back to Sales Orders
            </Link>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading sales order...</p> : null}

        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {saleOrder ? (
          <>
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">SO Number</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{saleOrder.soNumber}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">SO Date</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{formatDate(saleOrder.soDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Customer</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{customerName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Invoice</p>
                <p className="mt-1 text-sm font-medium text-zinc-900">{linkedInvoice?.invoiceNumber ?? "-"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Payment Term</span>
                <select
                  value={selectedPaymentTermId}
                  onChange={(event) => setSelectedPaymentTermId(event.target.value)}
                  disabled={isConfirmed}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  <option value="">Select payment term</option>
                  {paymentTerms.map((term) => (
                    <option key={term.termId} value={term.termId}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCouponPanel((previous) => !previous)}
                  disabled={isConfirmed}
                  className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  Coupon Code
                </button>
              </div>
            </div>

            {showCouponPanel ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600">Applied Offers and Coupons</p>

                <div className="mt-3 space-y-2">
                  {couponRows.map((row) => {
                    const chosenOfferIds = new Set(couponRows.filter((item) => item.id !== row.id).map((item) => item.offerId));
                    const offerOptions = offers.filter((offer) => !chosenOfferIds.has(offer.discountId) || offer.discountId === row.offerId);
                    const couponOptions = row.offerId ? availableCouponsForOffer(row.offerId) : [];

                    return (
                      <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <select
                          value={row.offerId}
                          onChange={(event) => updateCouponRow(row.id, { offerId: event.target.value, couponId: "" })}
                          disabled={isConfirmed}
                          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed"
                        >
                          <option value="">Select offer</option>
                          {offerOptions.map((offer) => (
                            <option key={offer.discountId} value={offer.discountId}>
                              {offer.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={row.couponId}
                          onChange={(event) => updateCouponRow(row.id, { couponId: event.target.value })}
                          disabled={!row.offerId || isConfirmed}
                          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 disabled:bg-zinc-100 disabled:text-zinc-500 disabled:cursor-not-allowed"
                        >
                          <option value="">Select coupon</option>
                          {couponOptions.map((coupon) => (
                            <option key={coupon.couponId} value={coupon.couponId}>
                              {coupon.code}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeCouponRow(row.id)}
                          disabled={couponRows.length === 1 || isConfirmed}
                          className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-100"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addCouponRow}
                  disabled={isConfirmed}
                  className="mt-3 inline-flex h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 disabled:bg-zinc-100 disabled:border-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  + Add Coupon Row
                </button>
              </div>
            ) : null}

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

                  {couponLineRows.map((couponRow) => (
                    <tr key={couponRow.id} className="bg-amber-50/40">
                      <td className="px-4 py-3 text-zinc-800">{couponRow.offerName}</td>
                      <td className="px-4 py-3 text-right text-zinc-800">1</td>
                      <td className="px-4 py-3 text-right text-zinc-800">-{couponRow.discountPercentage.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-medium text-red-700">-₹{couponRow.discountAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">-</td>
                      <td className="px-4 py-3 text-right text-zinc-500">-</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{couponRow.discountAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">₹{saleOrder.totalTaxed.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Coupon Discounts
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">-₹{couponDiscountTotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600" colSpan={6}>
                      Net Total
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900">₹{netTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!linkedInvoice ? (
              <div className="mt-6 flex justify-end gap-3">
                {!isConfirmed ? (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="h-11 rounded-xl border border-emerald-600 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateInvoice}
                    disabled={isSubmitting}
                    className="h-11 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating..." : "Create Invoice"}
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
