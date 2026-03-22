import { NextResponse } from "next/server";

import { ensureUserWithRoles, getAuthenticatedUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  CreateSaleOrderRequestBody,
  SaleOrder,
  SaleOrderLineItem,
  SelectedCoupon,
} from "@/types/saleOrder";
import type { PaymentTerm } from "@/types/paymentTerm";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidLineItem(value: unknown): value is SaleOrderLineItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<SaleOrderLineItem>;

  return Boolean(
    isNonEmptyString(item.product) &&
      typeof item.qty === "number" &&
      Number.isInteger(item.qty) &&
      item.qty > 0 &&
      typeof item.unitPrice === "number" &&
      Number.isFinite(item.unitPrice) &&
      typeof item.tax === "number" &&
      Number.isFinite(item.tax) &&
      typeof item.taxAmount === "number" &&
      Number.isFinite(item.taxAmount) &&
      typeof item.total === "number" &&
      Number.isFinite(item.total),
  );
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

function parseAndValidatePayload(payload: unknown): CreateSaleOrderRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreateSaleOrderRequestBody>;

  if (!isNonEmptyString(data.customerId)) {
    return null;
  }

  if (!Array.isArray(data.order) || data.order.length === 0 || !data.order.every(isValidLineItem)) {
    return null;
  }

  if (
    typeof data.totalUntaxed !== "number" ||
    !Number.isFinite(data.totalUntaxed) ||
    typeof data.totalTaxed !== "number" ||
    !Number.isFinite(data.totalTaxed)
  ) {
    return null;
  }

  const rawSelectedCoupons = Array.isArray(data.selectedCoupons) ? data.selectedCoupons : [];

  if (!rawSelectedCoupons.every(isSelectedCoupon)) {
    return null;
  }

  return {
    customerId: data.customerId.trim(),
    order: data.order,
    totalUntaxed: data.totalUntaxed,
    totalTaxed: data.totalTaxed,
    paymentTermId: isNonEmptyString(data.paymentTermId) ? data.paymentTermId.trim() : null,
    selectedCoupons: normalizeSelectedCoupons(rawSelectedCoupons),
  };
}

function toSoNumber(sequence: number): string {
  return `S${sequence.toString().padStart(4, "0")}`;
}

async function ensureDefaultPaymentTermId(): Promise<string> {
  const defaultSnapshot = await adminDb
    .collection("paymentTerms")
    .where("isWebsiteDefault", "==", true)
    .limit(1)
    .get();

  if (!defaultSnapshot.empty) {
    const defaultTerm = defaultSnapshot.docs[0].data() as PaymentTerm;
    return defaultTerm.termId;
  }

  const docRef = adminDb.collection("paymentTerms").doc();

  const defaultTerm = {
    termId: docRef.id,
    name: "Immediate Payment",
    early_payment_discount: false,
    discount_percentage: null,
    discount_days: null,
    early_pay_discount_computation: null,
    example_preview: "Payment Terms: Immediate Payment",
    isWebsiteDefault: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  } as unknown as PaymentTerm;

  await docRef.set(defaultTerm as unknown as Record<string, unknown>);

  return docRef.id;
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    let snapshot;

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      snapshot = await adminDb
        .collection("saleOrders")
        .where("customerId", "==", currentUserResult.data.user.contactId)
        .get();
    } else {
      snapshot = await adminDb.collection("saleOrders").orderBy("createdAt", "desc").get();
    }

    let saleOrders = snapshot.docs.map((docSnapshot) => docSnapshot.data() as SaleOrder);

    // Sort portal users' orders client-side since composite index not available yet
    if (authResult.role === "portal") {
      saleOrders.sort((a, b) => {
        const aTime = typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? (a.createdAt as any).toMillis() : 0;
        const bTime = typeof b.createdAt === 'object' && 'toMillis' in b.createdAt ? (b.createdAt as any).toMillis() : 0;
        return bTime - aTime;
      });
    }

    return NextResponse.json({ success: true, data: saleOrders }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sale orders";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const body = (await request.json()) as unknown;
    const payload = parseAndValidatePayload(body);

    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid sale order" }, { status: 400 });
    }

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      const currentContactId = currentUserResult.data.user.contactId;

      if (payload.customerId !== currentContactId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const paymentTermId = payload.paymentTermId ?? (await ensureDefaultPaymentTermId());

    const saleOrderRef = adminDb.collection("saleOrders").doc();
    const soCountSnapshot = await adminDb.collection("saleOrders").count().get();
    const soNumber = toSoNumber(Number(soCountSnapshot.data().count) + 1);

    const saleOrderDoc = {
      saleOrderId: saleOrderRef.id,
      customerId: payload.customerId,
      soNumber,
      soDate: Timestamp.now(),
      order: payload.order,
      totalUntaxed: payload.totalUntaxed,
      totalTaxed: payload.totalTaxed,
      paymentTermId,
      selectedCoupons: payload.selectedCoupons ?? [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as SaleOrder;

    await saleOrderRef.set(saleOrderDoc as unknown as Record<string, unknown>);

    return NextResponse.json(
      { success: true, data: { saleOrderId: saleOrderRef.id, soNumber } },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sale order";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
