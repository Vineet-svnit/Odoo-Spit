import { NextResponse } from "next/server";

import { getDocs } from "firebase/firestore";

import { ensureInternalUser, getAuthenticatedUser } from "@/lib/apiAuth";
import { usersCollection } from "@/lib/collections";
import type { User } from "@/types/user";

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
