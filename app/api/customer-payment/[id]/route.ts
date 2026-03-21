import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { CustomerPayment } from "@/types/customerPayment";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Customer payment id is required" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("customerPayments").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Customer payment not found" },
        { status: 404 },
      );
    }

    const customerPayment = snapshot.data() as CustomerPayment;

    return NextResponse.json({ success: true, data: customerPayment }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer payment";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
