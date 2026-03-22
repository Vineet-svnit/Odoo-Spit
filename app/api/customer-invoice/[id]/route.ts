import { NextResponse } from "next/server";

import { ensureUserWithRoles, getAuthenticatedUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { SaleOrder } from "@/types/saleOrder";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
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

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      const saleOrderSnapshot = await adminDb.collection("saleOrders").doc(customerInvoice.saleOrderId).get();

      if (!saleOrderSnapshot.exists) {
        return NextResponse.json({ success: false, error: "Sale order not found" }, { status: 404 });
      }

      const saleOrder = saleOrderSnapshot.data() as SaleOrder;

      if (saleOrder.customerId !== currentUserResult.data.user.contactId) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.json({ success: true, data: customerInvoice }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer invoice";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
