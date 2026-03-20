import { NextResponse } from "next/server";

import { doc, getDoc } from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { usersCollection } from "@/lib/collections";
import type { User } from "@/types/user";

interface UserRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: UserRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const userSnapshot = await getDoc(doc(usersCollection, id));

    if (!userSnapshot.exists()) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: userSnapshot.data() as User },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch user";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
