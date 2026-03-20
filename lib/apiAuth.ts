import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import type { User } from "@/types/user";

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

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 },
  );
}

export async function ensureInternalUser(request: Request): Promise<NextResponse | null> {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return unauthorizedResponse();
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const userSnapshot = await adminDb.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      return unauthorizedResponse();
    }

    const user = userSnapshot.data() as User;

    if (user.role !== "internal") {
      return unauthorizedResponse();
    }

    return null;
  } catch {
    return unauthorizedResponse();
  }
}
