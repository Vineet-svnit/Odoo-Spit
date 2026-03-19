import { NextResponse } from "next/server";

import { createUserWithEmailAndPassword, deleteUser, getAuth } from "firebase/auth";
import { doc, getDocs, limit, query, Timestamp, where, writeBatch } from "firebase/firestore";

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

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isPasswordValid(password: string): boolean {
  return PASSWORD_POLICY_REGEX.test(password);
}

async function emailExists(email: string): Promise<boolean> {
  const usersSnapshot = await getDocs(
    query(usersCollection, where("email", "==", email), limit(1)),
  );

  if (!usersSnapshot.empty) {
    return true;
  }

  const contactsSnapshot = await getDocs(
    query(contactsCollection, where("email", "==", email), limit(1)),
  );

  return !contactsSnapshot.empty;
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

    const normalizedEmail = normalizeEmail(body.email);

    if (!isPasswordValid(body.password)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password must be at least 8 characters and include lowercase, uppercase, a digit, and a special character",
        },
        { status: 400 },
      );
    }

    if (await emailExists(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Email already exists" },
        { status: 409 },
      );
    }

    const authCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
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
      email: normalizedEmail,
      mobile: body.mobile,
      address: body.address,
      createdAt,
      updatedAt,
    });

    const userDoc = createUserDoc({
      userId,
      name: body.name,
      role: "portal",
      email: normalizedEmail,
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
    const authCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    const isAuthError = typeof authCode === "string" && authCode.startsWith("auth/");
    const isDuplicateEmailError = authCode === "auth/email-already-in-use";

    return NextResponse.json(
      {
        success: false,
        error: isDuplicateEmailError ? "Email already exists" : message,
      },
      { status: isDuplicateEmailError ? 409 : isAuthError ? 400 : 500 },
    );
  }
}
