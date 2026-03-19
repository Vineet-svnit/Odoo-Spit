import { NextResponse } from "next/server";

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDocs, limit, query, where } from "firebase/firestore";

import { usersCollection } from "@/lib/collections";
import { app } from "@/lib/firebase";

interface LoginRequestBody {
  email: string;
  password: string;
}

function hasRequiredFields(payload: Partial<LoginRequestBody>): payload is LoginRequestBody {
  return Boolean(payload.email && payload.password);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findUserByEmail(email: string): Promise<{ userId: string } | null> {
  const userSnapshot = await getDocs(
    query(usersCollection, where("email", "==", email), limit(1)),
  );

  if (userSnapshot.empty) {
    return null;
  }

  const userDoc = userSnapshot.docs[0].data() as { userId?: string };
  const userId = userDoc.userId ?? userSnapshot.docs[0].id;

  return { userId };
}

export async function POST(request: Request) {
  const auth = getAuth(app);

  try {
    const body = (await request.json()) as Partial<LoginRequestBody>;

    if (!hasRequiredFields(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid login payload" },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(body.email);
    const existingUser = await findUserByEmail(normalizedEmail);

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "Account doesn't exist" },
        { status: 404 },
      );
    }

    await signInWithEmailAndPassword(auth, normalizedEmail, body.password);

    return NextResponse.json(
      { success: true, userId: existingUser.userId },
      { status: 200 },
    );
  } catch (error) {
    const authCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;

    if (authCode === "auth/invalid-credential" || authCode === "auth/wrong-password") {
      return NextResponse.json(
        { success: false, error: "Invalid Password" },
        { status: 401 },
      );
    }

    if (authCode === "auth/user-not-found") {
      return NextResponse.json(
        { success: false, error: "Account doesn't exist" },
        { status: 404 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to complete login";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
