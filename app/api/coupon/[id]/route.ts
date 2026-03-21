import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { Coupon } from "@/types/coupon";

interface CouponRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: CouponRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const couponSnapshot = await adminDb.collection("coupons").doc(id).get();

    if (!couponSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Coupon Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: couponSnapshot.data() as Coupon },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch coupon";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
