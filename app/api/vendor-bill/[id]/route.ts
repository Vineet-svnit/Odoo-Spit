import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { VendorBill } from "@/types/vendorBill";

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
        { success: false, error: "Vendor bill id is required" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("vendorBills").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Vendor bill not found" },
        { status: 404 },
      );
    }

    const vendorBill = snapshot.data() as VendorBill;

    return NextResponse.json({ success: true, data: vendorBill }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch vendor bill";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
