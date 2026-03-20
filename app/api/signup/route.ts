import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { User } from "@/types/user";
import type { Contact } from "@/types/contact";

interface SignupRequestBody {
  name: string;
  mobile: string;
  address: {
    city: string;
    state: string;
    pincode: string;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRequiredFields(payload: unknown): payload is SignupRequestBody {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const data = payload as Partial<SignupRequestBody>;

  return Boolean(
    isNonEmptyString(data.name) &&
      isNonEmptyString(data.mobile) &&
      typeof data.address === "object" &&
      data.address !== null &&
      isNonEmptyString(data.address.city) &&
      isNonEmptyString(data.address.state) &&
      isNonEmptyString(data.address.pincode),
  );
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let decodedToken;
    let userId: string;
    let email: string;

    try {
      decodedToken = await adminAuth.verifyIdToken(token);
      userId = decodedToken.uid;
      email = decodedToken.email || "";
    } catch {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as unknown;

    if (!hasRequiredFields(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid signup payload" },
        { status: 400 },
      );
    }

    const userDocSnapshot = await adminDb.collection("users").doc(userId).get();

    if (userDocSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "User already exists" },
        { status: 409 },
      );
    }

    const contactDocRef = adminDb.collection("contacts").doc();
    const contactId = contactDocRef.id;
    const userDocRef = adminDb.collection("users").doc(userId);

    const serverTimestamp = FieldValue.serverTimestamp();

    const contactDoc = {
      contactId,
      name: body.name,
      type: "customer",
      email,
      mobile: body.mobile,
      address: body.address,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    } as unknown as Record<string, unknown>;

    const userDoc = {
      userId,
      name: body.name,
      role: "portal",
      email,
      mobile: body.mobile,
      address: body.address,
      contactId,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    } as unknown as Record<string, unknown>;

    const batch = adminDb.batch();
    batch.set(contactDocRef, contactDoc);
    batch.set(userDocRef, userDoc);
    await batch.commit();

    return NextResponse.json({ success: true, userId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "User couldn't be created! Pls try again" },
      { status: 500 },
    );
  }
}
