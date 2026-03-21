import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { Offer } from "@/types/offer";

interface OfferRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: OfferRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const offerSnapshot = await adminDb.collection("offers").doc(id).get();

    if (!offerSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Offer Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: offerSnapshot.data() as Offer },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch offer";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
