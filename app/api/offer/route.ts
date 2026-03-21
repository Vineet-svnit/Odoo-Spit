import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

type OfferAvailability = "sales" | "website";

interface CreateOfferRequestBody {
  name: string;
  discountPercentage: number;
  startDate: number;
  endDate: number;
  availableOn: OfferAvailability;
  couponIds: string[];
}

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

    const offerDoc = {
      discountId,
      name: payload.name,
      discountPercentage: payload.discountPercentage,
      startDate: Timestamp.fromMillis(payload.startDate),
      endDate: Timestamp.fromMillis(payload.endDate),
      availableOn: payload.availableOn,
      couponIds: payload.couponIds,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let batch = adminDb.batch();
    let pendingOperations = 0;

    batch.set(offerRef, offerDoc as Record<string, unknown>);
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
    const message = error instanceof Error ? error.message : "Failed to create offer";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
