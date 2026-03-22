import { NextResponse } from "next/server";

import { ensureInternalUser, ensureUserWithRoles, getAuthenticatedUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type { Contact } from "@/types/contact";
import type { Coupon } from "@/types/coupon";
import type { CustomerInvoice, CreateCustomerInvoiceRequestBody, InvoiceCouponLine } from "@/types/customerInvoice";
import type { Offer } from "@/types/offer";
import type { PaymentTerm } from "@/types/paymentTerm";
import type { SaleOrder, SelectedCoupon } from "@/types/saleOrder";

type CustomerInvoiceFilter = "all" | "completed" | "unpaid" | "overdue";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSelectedCoupon(value: unknown): value is SelectedCoupon {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const coupon = value as Partial<SelectedCoupon>;

  return isNonEmptyString(coupon.offerId) && isNonEmptyString(coupon.couponId);
}

function normalizeSelectedCoupons(coupons: SelectedCoupon[]): SelectedCoupon[] {
  const seenOffers = new Set<string>();
  const unique: SelectedCoupon[] = [];

  for (const coupon of coupons) {
    const offerId = coupon.offerId.trim();
    const couponId = coupon.couponId.trim();

    if (!offerId || !couponId || seenOffers.has(offerId)) {
      continue;
    }

    seenOffers.add(offerId);
    unique.push({ offerId, couponId });
  }

  return unique;
}

function parsePayload(payload: unknown): CreateCustomerInvoiceRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreateCustomerInvoiceRequestBody>;

  if (!isNonEmptyString(data.saleOrderId) || !isNonEmptyString(data.paymentTermId)) {
    return null;
  }

  if (!Array.isArray(data.selectedCoupons) || !data.selectedCoupons.every(isSelectedCoupon)) {
    return null;
  }

  return {
    saleOrderId: data.saleOrderId.trim(),
    paymentTermId: data.paymentTermId.trim(),
    selectedCoupons: normalizeSelectedCoupons(data.selectedCoupons),
  };
}

function toInvoiceNumber(sequence: number): string {
  return `INV/${sequence.toString().padStart(4, "0")}`;
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

function normalizeFilter(value: string | null): CustomerInvoiceFilter {
  if (value === "completed" || value === "unpaid" || value === "overdue") {
    return value;
  }

  return "all";
}

function applyFilter(customerInvoices: CustomerInvoice[], filter: CustomerInvoiceFilter): CustomerInvoice[] {
  if (filter === "all") {
    return customerInvoices;
  }

  if (filter === "completed") {
    return customerInvoices.filter((customerInvoice) => customerInvoice.amountDue <= 0);
  }

  if (filter === "unpaid") {
    return customerInvoices.filter((customerInvoice) => customerInvoice.amountDue > 0);
  }

  const now = Date.now();

  return customerInvoices.filter((customerInvoice) => {
    if (customerInvoice.amountDue <= 0) {
      return false;
    }

    const dueMillis = getTimestampMillis(customerInvoice.invoiceDue);

    if (dueMillis === null) {
      return false;
    }

    return now > dueMillis;
  });
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const filter = normalizeFilter(new URL(request.url).searchParams.get("filter"));

    const snapshot = await adminDb.collection("customerInvoices").orderBy("createdAt", "desc").get();

    let customerInvoices = snapshot.docs.map((docSnapshot) => docSnapshot.data() as CustomerInvoice);

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      const saleOrdersSnapshot = await adminDb
        .collection("saleOrders")
        .where("customerId", "==", currentUserResult.data.user.contactId)
        .get();

      const allowedSaleOrderIds = new Set(
        saleOrdersSnapshot.docs.map((docSnapshot) => (docSnapshot.data() as SaleOrder).saleOrderId),
      );

      customerInvoices = customerInvoices.filter((invoice) => allowedSaleOrderIds.has(invoice.saleOrderId));
    }

    const filtered = applyFilter(customerInvoices, filter);

    return NextResponse.json({ success: true, data: filtered }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer invoices";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);

    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid customer invoice payload" }, { status: 400 });
    }

    const saleOrderRef = adminDb.collection("saleOrders").doc(payload.saleOrderId);
    const saleOrderSnapshot = await saleOrderRef.get();

    if (!saleOrderSnapshot.exists) {
      return NextResponse.json({ success: false, error: "Sale order not found" }, { status: 404 });
    }

    const existingInvoiceSnapshot = await adminDb
      .collection("customerInvoices")
      .where("saleOrderId", "==", payload.saleOrderId)
      .limit(1)
      .get();

    if (!existingInvoiceSnapshot.empty) {
      const existing = existingInvoiceSnapshot.docs[0].data() as CustomerInvoice;

      return NextResponse.json(
        {
          success: true,
          data: {
            customerInvoiceId: existing.customerInvoiceId,
            invoiceNumber: existing.invoiceNumber,
            saleOrderId: existing.saleOrderId,
          },
        },
        { status: 200 },
      );
    }

    const saleOrder = saleOrderSnapshot.data() as SaleOrder;

    const paymentTermRef = adminDb.collection("paymentTerms").doc(payload.paymentTermId);
    const paymentTermSnapshot = await paymentTermRef.get();

    if (!paymentTermSnapshot.exists) {
      return NextResponse.json({ success: false, error: "Payment term not found" }, { status: 404 });
    }

    const customerSnapshot = await adminDb.collection("contacts").doc(saleOrder.customerId).get();
    const customer = customerSnapshot.exists ? (customerSnapshot.data() as Contact) : null;
    const customerName = customer?.name ?? "Unknown Customer";

    const nowMillis = Date.now();
    const couponLines: InvoiceCouponLine[] = [];
    let couponDiscountTotal = 0;

    for (const selected of payload.selectedCoupons) {
      const offerSnapshot = await adminDb.collection("offers").doc(selected.offerId).get();

      if (!offerSnapshot.exists) {
        continue;
      }

      const offer = offerSnapshot.data() as Offer;
      const offerStart = getTimestampMillis(offer.startDate);
      const offerEnd = getTimestampMillis(offer.endDate);

      if (offerStart === null || offerEnd === null || nowMillis < offerStart || nowMillis > offerEnd) {
        continue;
      }

      const couponEntry = offer.coupons.find((coupon) => coupon.couponId === selected.couponId);

      if (!couponEntry) {
        continue;
      }

      const entryExpiry = getTimestampMillis(couponEntry.expirationDate);

      if (entryExpiry !== null && nowMillis > entryExpiry) {
        continue;
      }

      const couponSnapshot = await adminDb.collection("coupons").doc(selected.couponId).get();

      if (!couponSnapshot.exists) {
        continue;
      }

      const coupon = couponSnapshot.data() as Coupon;
      const couponExpiry = getTimestampMillis(coupon.expirationDate);

      if (coupon.status !== "unused" || (couponExpiry !== null && nowMillis > couponExpiry)) {
        continue;
      }

      const discountAmount = (saleOrder.totalUntaxed * offer.discountPercentage) / 100;

      couponDiscountTotal += discountAmount;
      couponLines.push({
        offerId: offer.discountId,
        couponId: coupon.couponId,
        offerName: offer.name,
        couponCode: coupon.code,
        discountPercentage: offer.discountPercentage,
        discountAmount,
      });
    }

    const amountDue = Math.max(0, saleOrder.totalTaxed - couponDiscountTotal);

    const customerInvoiceRef = adminDb.collection("customerInvoices").doc();
    const invoiceCountSnapshot = await adminDb.collection("customerInvoices").count().get();
    const invoiceNumber = toInvoiceNumber(Number(invoiceCountSnapshot.data().count) + 1);

    const invoiceDate = Timestamp.now();
    const invoiceDue = Timestamp.fromMillis(invoiceDate.toMillis() + 30 * 24 * 60 * 60 * 1000);

    const customerInvoiceDoc = {
      customerInvoiceId: customerInvoiceRef.id,
      invoiceNumber,
      customerName,
      saleOrderId: saleOrder.saleOrderId,
      paymentTermId: payload.paymentTermId,
      subtotalUntaxed: saleOrder.totalUntaxed,
      subtotalTaxed: saleOrder.totalTaxed,
      couponDiscountTotal,
      couponLines,
      amountDue,
      paidOn: null,
      invoiceDate,
      invoiceDue,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as CustomerInvoice;

    const batch = adminDb.batch();

    batch.set(customerInvoiceRef, customerInvoiceDoc as unknown as Record<string, unknown>);
    batch.update(saleOrderRef, {
      paymentTermId: payload.paymentTermId,
      selectedCoupons: payload.selectedCoupons,
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const couponLine of couponLines) {
      const couponRef = adminDb.collection("coupons").doc(couponLine.couponId);
      batch.update(couponRef, {
        status: "used",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          customerInvoiceId: customerInvoiceRef.id,
          invoiceNumber,
          saleOrderId: saleOrder.saleOrderId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create customer invoice";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
