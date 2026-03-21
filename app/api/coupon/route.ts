import { NextResponse } from "next/server";

import { ensureInternalUser, ensureUserWithRoles, getAuthenticatedUser, isPortalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
  Coupon,
  CouponStatus,
  CouponTarget,
  CreateCouponRequestBody,
} from "@/types/coupon";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BATCH_LIMIT = 450;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

function isValidTarget(value: unknown): value is CouponTarget {
  return value === "anonymous" || value === "selected";
}

function parseAndValidatePayload(payload: unknown): CreateCouponRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreateCouponRequestBody>;

  if (!isValidTarget(data.for)) {
    return null;
  }

  if (typeof data.validUntil !== "number" || !Number.isFinite(data.validUntil) || data.validUntil <= 0) {
    return null;
  }

  if (data.contacts !== undefined && !isStringArray(data.contacts)) {
    return null;
  }

  if (data.for === "anonymous") {
    if (
      typeof data.quantity !== "number" ||
      !Number.isInteger(data.quantity) ||
      data.quantity <= 0 ||
      data.contacts !== undefined
    ) {
      return null;
    }
  }

  if (data.for === "selected") {
    if (data.quantity !== undefined) {
      return null;
    }
  }

  return {
    for: data.for,
    contacts: data.contacts,
    quantity: data.quantity,
    validUntil: data.validUntil,
  };
}

function randomChunk(length: number): string {
  let result = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
    result += CODE_CHARS[randomIndex];
  }

  return result;
}

function buildCouponCode(): string {
  const code = `${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
  return code.toUpperCase();
}

async function generateUniqueCouponCode(localCodes: Set<string>): Promise<string> {
  for (let attempts = 0; attempts < 50; attempts += 1) {
    const candidate = buildCouponCode();

    if (localCodes.has(candidate)) {
      continue;
    }

    const snapshot = await adminDb
      .collection("coupons")
      .where("code", "==", candidate)
      .limit(1)
      .get();

    if (snapshot.empty) {
      localCodes.add(candidate);
      return candidate;
    }
  }

  throw new Error("Unable to generate unique coupon code");
}

async function resolveContactIds(payload: CreateCouponRequestBody): Promise<string[]> {
  if (payload.for === "anonymous") {
    return [];
  }

  if (payload.contacts && payload.contacts.length > 0) {
    return Array.from(new Set(payload.contacts.map((id) => id.trim()).filter(Boolean)));
  }

  const contactsSnapshot = await adminDb.collection("contacts").get();

  return contactsSnapshot.docs
    .map((docSnapshot) => {
      const data = docSnapshot.data() as { contactId?: unknown };
      return isNonEmptyString(data.contactId) ? data.contactId : docSnapshot.id;
    })
    .filter((contactId) => isNonEmptyString(contactId));
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const role = authResult.role;
    const currentTimeMillis = Date.now();
    let portalContactId: string | null = null;

    if (role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      if (!isPortalUser(currentUserResult.data.user)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }

      portalContactId = currentUserResult.data.user.contactId;
    }

    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");

    if (idsParam && idsParam.trim().length > 0) {
      const couponIds = Array.from(
        new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean)),
      );

      const snapshots = await Promise.all(
        couponIds.map((couponId) => adminDb.collection("coupons").doc(couponId).get()),
      );

      const coupons = snapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => snapshot.data() as Coupon)
        .filter((coupon) => {
          if (role !== "portal") {
            return true;
          }

          const expirationMillis = coupon.expirationDate?.toMillis?.() ?? 0;
          const isOwned = coupon.contactId === null || coupon.contactId === portalContactId;

          return coupon.status === "unused" && expirationMillis > currentTimeMillis && isOwned;
        });

      return NextResponse.json({ success: true, data: coupons }, { status: 200 });
    }

    const couponsSnapshot = await adminDb.collection("coupons").get();
    const coupons = couponsSnapshot.docs
      .map((docSnapshot) => docSnapshot.data() as Coupon)
      .filter((coupon) => {
        if (role !== "portal") {
          return true;
        }

        const expirationMillis = coupon.expirationDate?.toMillis?.() ?? 0;
        const isOwned = coupon.contactId === null || coupon.contactId === portalContactId;

        return coupon.status === "unused" && expirationMillis > currentTimeMillis && isOwned;
      });

    return NextResponse.json({ success: true, data: coupons }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch coupons";

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
        { success: false, error: "Invalid coupon payload" },
        { status: 400 },
      );
    }

    const expirationDate = Timestamp.fromMillis(Date.now() + payload.validUntil);
    const targetContacts = await resolveContactIds(payload);

    const couponCount =
      payload.for === "anonymous" ? (payload.quantity as number) : targetContacts.length;

    const contactAssignments: Array<string | null> =
      payload.for === "anonymous"
        ? Array.from({ length: couponCount }, () => null)
        : targetContacts;

    const localCodes = new Set<string>();
    const createdCouponIds: string[] = [];

    let batch = adminDb.batch();
    let pendingOperations = 0;

    for (const contactId of contactAssignments) {
      const couponRef = adminDb.collection("coupons").doc();
      const code = await generateUniqueCouponCode(localCodes);
      const serverTimestamp = FieldValue.serverTimestamp();

      const couponDoc = {
        couponId: couponRef.id,
        code,
        expirationDate,
        status: "unused" as CouponStatus,
        contactId,
        discountId: null,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      } as unknown as Coupon;

      batch.set(couponRef, couponDoc as unknown as Record<string, unknown>);
      createdCouponIds.push(couponRef.id);
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
          count: createdCouponIds.length,
          couponIds: createdCouponIds,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create coupons";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
