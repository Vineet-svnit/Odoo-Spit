import { NextResponse } from "next/server";

import { ensureInternalUser, ensureUserWithRoles } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
  CreateOfferRequestBody,
  Offer,
  OfferAvailability,
  OfferCouponEntry,
} from "@/types/offer";

const BATCH_LIMIT = 450;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidAvailability(value: unknown): value is OfferAvailability {
  return value === "sales" || value === "website";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function getTimestampMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { toMillis?: () => number };

  if (typeof candidate.toMillis !== "function") {
    return null;
  }

  return candidate.toMillis();
}

function parseAndValidatePayload(payload: unknown): CreateOfferRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreateOfferRequestBody>;

  if (!isNonEmptyString(data.name)) {
    return null;
  }

  if (
    typeof data.discountPercentage !== "number" ||
    !Number.isFinite(data.discountPercentage) ||
    data.discountPercentage <= 0 ||
    data.discountPercentage > 100
  ) {
    return null;
  }

  if (
    typeof data.startDate !== "number" ||
    typeof data.endDate !== "number" ||
    !Number.isFinite(data.startDate) ||
    !Number.isFinite(data.endDate) ||
    data.endDate <= data.startDate
  ) {
    return null;
  }

  if (!isValidAvailability(data.availableOn)) {
    return null;
  }

  if (!isStringArray(data.couponIds) || data.couponIds.length === 0) {
    return null;
  }

  return {
    name: data.name.trim(),
    discountPercentage: data.discountPercentage,
    startDate: data.startDate,
    endDate: data.endDate,
    availableOn: data.availableOn,
    couponIds: Array.from(new Set(data.couponIds.map((id) => id.trim()).filter(Boolean))),
  };
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const offersSnapshot =
      authResult.role === "portal"
        ? await adminDb.collection("offers").where("availableOn", "==", "website").get()
        : await adminDb.collection("offers").get();
    const offers = offersSnapshot.docs.map((docSnapshot) => docSnapshot.data() as Offer);

    return NextResponse.json({ success: true, data: offers }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch offers";

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
    const payload = parseAndValidatePayload(body);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    const couponRefs = payload.couponIds.map((couponId) =>
      adminDb.collection("coupons").doc(couponId),
    );

    const couponSnapshots = await adminDb.getAll(...couponRefs);

    if (couponSnapshots.some((snapshot) => !snapshot.exists)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    const offerRef = adminDb.collection("offers").doc();
    const discountId = offerRef.id;
    const offerStartMillis = payload.startDate;
    const offerEndMillis = payload.endDate;

    const coupons = couponSnapshots.map((snapshot) => {
      const couponId = snapshot.id;
      const rawExpiration = (snapshot.data() as { expirationDate?: unknown }).expirationDate;
      const couponExpirationMillis = getTimestampMillis(rawExpiration) ?? offerEndMillis;
      const computedExpirationMillis = Math.min(couponExpirationMillis, offerEndMillis);

      if (computedExpirationMillis < offerStartMillis) {
        throw new Error("Invalid payload");
      }

      return {
        couponId,
        expirationDate: Timestamp.fromMillis(computedExpirationMillis),
      } as OfferCouponEntry;
    });

    const offerDoc = {
      discountId,
      name: payload.name,
      discountPercentage: payload.discountPercentage,
      startDate: Timestamp.fromMillis(payload.startDate),
      endDate: Timestamp.fromMillis(payload.endDate),
      availableOn: payload.availableOn,
      coupons,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as Offer;

    let batch = adminDb.batch();
    let pendingOperations = 0;

    batch.set(offerRef, offerDoc as unknown as Record<string, unknown>);
    pendingOperations += 1;

    for (const couponRef of couponRefs) {
      batch.update(couponRef, {
        discountId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      pendingOperations += 1;

      if (pendingOperations >= BATCH_LIMIT) {
        await batch.commit();
        batch = adminDb.batch();
        pendingOperations = 0;
      }
    }

    if (pendingOperations > 0) {
      await batch.commit();
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          discountId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid payload") {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create offer";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
