import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { PaymentTerm } from "@/types/paymentTerm";

interface PaymentTermRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: PaymentTermRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const termSnapshot = await adminDb.collection("paymentTerms").doc(id).get();

    if (!termSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Payment term not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: termSnapshot.data() as PaymentTerm },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payment term";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
