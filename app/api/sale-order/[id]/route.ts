import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

import type { SaleOrder, SelectedCoupon } from "@/types/saleOrder";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface UpdateSaleOrderPayload {
  paymentTermId: string;
  selectedCoupons: SelectedCoupon[];
}

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

function parsePayload(payload: unknown): UpdateSaleOrderPayload | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<UpdateSaleOrderPayload>;

  if (!isNonEmptyString(data.paymentTermId)) {
    return null;
  }

  if (!Array.isArray(data.selectedCoupons) || !data.selectedCoupons.every(isSelectedCoupon)) {
    return null;
  }

  return {
    paymentTermId: data.paymentTermId.trim(),
    selectedCoupons: normalizeSelectedCoupons(data.selectedCoupons),
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ success: false, error: "Sale order id is required" }, { status: 400 });
    }

    const snapshot = await adminDb.collection("saleOrders").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: "Sale order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: snapshot.data() as SaleOrder }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sale order";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ success: false, error: "Sale order id is required" }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);

    if (!payload) {
      return NextResponse.json({ success: false, error: "Invalid update payload" }, { status: 400 });
    }

    const saleOrderRef = adminDb.collection("saleOrders").doc(id);
    const snapshot = await saleOrderRef.get();

    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: "Sale order not found" }, { status: 404 });
    }

    await saleOrderRef.update({
      paymentTermId: payload.paymentTermId,
      selectedCoupons: payload.selectedCoupons,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sale order";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
