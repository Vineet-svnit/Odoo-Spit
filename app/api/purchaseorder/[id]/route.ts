import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { PurchaseOrder } from "@/types/purchaseOrder";

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
        { success: false, error: "Purchase order id is required" },
        { status: 400 },
      );
    }

    const snapshot = await adminDb.collection("purchaseOrders").doc(id).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Purchase order not found" },
        { status: 404 },
      );
    }

    const purchaseOrder = snapshot.data() as PurchaseOrder;

    return NextResponse.json({ success: true, data: purchaseOrder }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch purchase order";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
