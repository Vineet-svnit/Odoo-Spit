import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { CustomerInvoice } from "@/types/customerInvoice";

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
        { success: false, error: "Customer invoice id is required" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("customerInvoices").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Customer invoice not found" },
        { status: 404 },
      );
    }

    const customerInvoice = snapshot.data() as CustomerInvoice;

    return NextResponse.json({ success: true, data: customerInvoice }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer invoice";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
