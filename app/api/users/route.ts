import { NextResponse } from "next/server";

import { getDocs } from "firebase/firestore";
import { FieldValue } from "firebase-admin/firestore";

import { ensureInternalUser, getAuthenticatedUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { usersCollection } from "@/lib/collections";
import type { User } from "@/types/user";

interface UpdateCurrentUserBody {
  name?: string;
  mobile?: string;
  address?: {
    city?: string;
    state?: string;
    pincode?: string;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const current = url.searchParams.get("current")?.toLowerCase() === "true";

    if (current) {
      const authResult = await getAuthenticatedUser(request);

      if ("response" in authResult) {
        return authResult.response;
      }

      return NextResponse.json(
        { success: true, data: authResult.data.user },
        { status: 200 },
      );
    }

    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const usersSnapshot = await getDocs(usersCollection);
    const users = usersSnapshot.docs.map((docSnapshot) => docSnapshot.data() as User);

    return NextResponse.json({ success: true, data: users }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const current = url.searchParams.get("current")?.toLowerCase() === "true";

    if (!current) {
      return NextResponse.json({ success: false, error: "Unsupported update target" }, { status: 400 });
    }

    const authResult = await getAuthenticatedUser(request);

    if ("response" in authResult) {
      return authResult.response;
    }

    const body = (await request.json()) as UpdateCurrentUserBody;
    const updates: Record<string, unknown> = {};

    if (isNonEmptyString(body.name)) {
      updates.name = body.name.trim();
    }

    if (isNonEmptyString(body.mobile)) {
      updates.mobile = body.mobile.trim();
    }

    if (body.address && typeof body.address === "object") {
      if (isNonEmptyString(body.address.city)) {
        updates["address.city"] = body.address.city.trim();
      }
      if (isNonEmptyString(body.address.state)) {
        updates["address.state"] = body.address.state.trim();
      }
      if (isNonEmptyString(body.address.pincode)) {
        updates["address.pincode"] = body.address.pincode.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    await adminDb.collection("users").doc(authResult.data.uid).update(updates);

    if (authResult.data.user.contactId) {
      await adminDb.collection("contacts").doc(authResult.data.user.contactId).update({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.mobile ? { mobile: updates.mobile } : {}),
        ...(updates["address.city"] ? { "address.city": updates["address.city"] } : {}),
        ...(updates["address.state"] ? { "address.state": updates["address.state"] } : {}),
        ...(updates["address.pincode"] ? { "address.pincode": updates["address.pincode"] } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const updatedUserSnapshot = await adminDb.collection("users").doc(authResult.data.uid).get();

    return NextResponse.json({ success: true, data: updatedUserSnapshot.data() as User }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
