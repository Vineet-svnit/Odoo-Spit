import { NextResponse } from "next/server";

import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import { doc, Timestamp, writeBatch } from "firebase/firestore";

import {
  contactsCollection,
  createContactDoc,
  createUserDoc,
  usersCollection,
} from "@/lib/collections";
import { app, db } from "@/lib/firebase";

interface SignupRequestBody {
  name: string;
  email: string;
  password: string;
  mobile: string;
  address: {
    city: string;
    state: string;
    pincode: string;
  };
}

function hasRequiredFields(payload: Partial<SignupRequestBody>): payload is SignupRequestBody {
  return Boolean(
    payload.name &&
      payload.email &&
      payload.password &&
      payload.mobile &&
      payload.address?.city &&
      payload.address?.state &&
      payload.address?.pincode,
  );
}

function getNowTimestamps(): { createdAt: Timestamp; updatedAt: Timestamp } {
  const now = Timestamp.now();
  return { createdAt: now, updatedAt: now };
}

export async function POST(request: Request) {
  const auth = getAuth(app);
  let createdAuthUser: Parameters<typeof deleteUser>[0] | null = null;

  try {
    const body = (await request.json()) as Partial<SignupRequestBody>;

    if (!hasRequiredFields(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid signup payload" },
        { status: 400 },
      );
    }

    const authCredential = await createUserWithEmailAndPassword(
      auth,
      body.email,
      body.password,
    );

    createdAuthUser = authCredential.user;

    const userId = authCredential.user.uid;
    const contactDocRef = doc(contactsCollection);
    const contactId = contactDocRef.id;
    const userDocRef = doc(usersCollection, userId);

    const { createdAt, updatedAt } = getNowTimestamps();

    const contactDoc = createContactDoc({
      contactId,
      name: body.name,
      type: "customer",
      email: body.email,
      mobile: body.mobile,
      address: body.address,
      createdAt,
      updatedAt,
    });

    const userDoc = createUserDoc({
      userId,
      name: body.name,
      role: "portal",
      email: body.email,
      mobile: body.mobile,
      address: body.address,
      contactId,
      createdAt,
      updatedAt,
    });

    const batch = writeBatch(db);
    batch.set(contactDocRef, contactDoc);
    batch.set(userDocRef, userDoc);
    await batch.commit();

    return NextResponse.json({ success: true, userId }, { status: 201 });
  } catch (error) {
    if (createdAuthUser) {
      try {
        await deleteUser(createdAuthUser);
      } catch {
        // Keep response deterministic; cleanup best-effort only.
      }
    }

    const message =
      error instanceof Error ? error.message : "Failed to complete signup";
    const isAuthError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      (error as { code: string }).code.startsWith("auth/");

    return NextResponse.json(
      { success: false, error: message },
      { status: isAuthError ? 400 : 500 },
    );
  }
}
