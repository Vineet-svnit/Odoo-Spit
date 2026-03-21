import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { PaymentBill } from "@/types/paymentBill";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
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
        { success: false, error: "Payment bill id is required" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("paymentBills").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Payment bill not found" },
        { status: 404 },
      );
    }

    const paymentBill = snapshot.data() as PaymentBill;

    return NextResponse.json({ success: true, data: paymentBill }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bill payment";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
