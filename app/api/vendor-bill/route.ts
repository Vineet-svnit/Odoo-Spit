import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { VendorBill } from "@/types/vendorBill";

type VendorBillFilter = "all" | "completed" | "unpaid" | "overdue";

function getTimestampMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const withToMillis = value as { toMillis?: () => number };

  if (typeof withToMillis.toMillis === "function") {
    return withToMillis.toMillis();
  }

  const withSeconds = value as { _seconds?: number; seconds?: number };
  const seconds = withSeconds._seconds ?? withSeconds.seconds;

  if (typeof seconds === "number") {
    return seconds * 1000;
  }

  return null;
}

function normalizeFilter(value: string | null): VendorBillFilter {
  if (value === "completed" || value === "unpaid" || value === "overdue") {
    return value;
  }

  return "all";
}

function applyFilter(vendorBills: VendorBill[], filter: VendorBillFilter): VendorBill[] {
  if (filter === "all") {
    return vendorBills;
  }

  if (filter === "completed") {
    return vendorBills.filter((vendorBill) => vendorBill.amountDue <= 0);
  }

  if (filter === "unpaid") {
    return vendorBills.filter((vendorBill) => vendorBill.amountDue > 0);
  }

  const now = Date.now();

  return vendorBills.filter((vendorBill) => {
    if (vendorBill.amountDue <= 0) {
      return false;
    }

    const dueMillis = getTimestampMillis(vendorBill.billDue);

    if (dueMillis === null) {
      return false;
    }

    return now > dueMillis;
  });
}

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const filter = normalizeFilter(new URL(request.url).searchParams.get("filter"));

    const snapshot = await adminDb
      .collection("vendorBills")
      .orderBy("createdAt", "desc")
      .get();

    const vendorBills = snapshot.docs.map((docSnapshot) => docSnapshot.data() as VendorBill);
    const filteredVendorBills = applyFilter(vendorBills, filter);

    return NextResponse.json({ success: true, data: filteredVendorBills }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch vendor bills";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
