import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { User } from "@/types/user";
import type {
  CreatePurchaseOrderRequestBody,
  PurchaseOrder,
  PurchaseOrderLineItem,
} from "@/types/purchaseOrder";
import type { VendorBill } from "@/types/vendorBill";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidLineItem(value: unknown): value is PurchaseOrderLineItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<PurchaseOrderLineItem>;

  return Boolean(
    isNonEmptyString(item.product) &&
      typeof item.qty === "number" &&
      Number.isInteger(item.qty) &&
      item.qty > 0 &&
      typeof item.unitPrice === "number" &&
      Number.isFinite(item.unitPrice) &&
      typeof item.tax === "number" &&
      Number.isFinite(item.tax) &&
      typeof item.taxAmount === "number" &&
      Number.isFinite(item.taxAmount) &&
      typeof item.total === "number" &&
      Number.isFinite(item.total),
  );
}

function parseAndValidatePayload(payload: unknown): CreatePurchaseOrderRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreatePurchaseOrderRequestBody>;

  if (!isNonEmptyString(data.vendorId) || !isNonEmptyString(data.poNumber)) {
    return null;
  }

  if (!Array.isArray(data.order) || data.order.length === 0) {
    return null;
  }

  if (!data.order.every((item) => isValidLineItem(item))) {
    return null;
  }

  if (
    typeof data.totalUntaxed !== "number" ||
    !Number.isFinite(data.totalUntaxed) ||
    typeof data.totalTaxed !== "number" ||
    !Number.isFinite(data.totalTaxed)
  ) {
    return null;
  }

  return {
    vendorId: data.vendorId.trim(),
    poNumber: data.poNumber.trim(),
    order: data.order,
    totalUntaxed: data.totalUntaxed,
    totalTaxed: data.totalTaxed,
  };
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

async function getInternalUserNameFromToken(request: Request): Promise<string | null> {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userSnapshot = await adminDb.collection("users").doc(decodedToken.uid).get();

  if (!userSnapshot.exists) {
    return decodedToken.name ?? decodedToken.email ?? null;
  }

  const user = userSnapshot.data() as User;
  return user.name ?? decodedToken.name ?? decodedToken.email ?? null;
}

function toBillNumber(sequence: number): string {
  return `BILL/${sequence.toString().padStart(4, "0")}`;
}

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const snapshot = await adminDb
      .collection("purchaseOrders")
      .orderBy("createdAt", "desc")
      .get();

    const purchaseOrders = snapshot.docs.map(
      (docSnapshot) => docSnapshot.data() as PurchaseOrder,
    );

    return NextResponse.json({ success: true, data: purchaseOrders }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch purchase orders";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const body = (await request.json()) as unknown;
    const payload = parseAndValidatePayload(body);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid purchase order" },
        { status: 400 },
      );
    }

    const customerName = await getInternalUserNameFromToken(request);

    if (!customerName) {
      return NextResponse.json(
        { success: false, error: "Invalid purchase order" },
        { status: 400 },
      );
    }

    const purchaseOrderRef = adminDb.collection("purchaseOrders").doc();
    const vendorBillRef = adminDb.collection("vendorBills").doc();

    const billCountSnapshot = await adminDb.collection("vendorBills").count().get();
    const nextBillSequence = Number(billCountSnapshot.data().count) + 1;
    const billNumber = toBillNumber(nextBillSequence);

    const poDate = Timestamp.now();
    const billDate = Timestamp.now();
    const billDue = Timestamp.fromMillis(billDate.toMillis() + 30 * 24 * 60 * 60 * 1000);

    const purchaseOrderDoc = {
      purchaseOrderId: purchaseOrderRef.id,
      vendorId: payload.vendorId,
      poNumber: payload.poNumber,
      poDate,
      order: payload.order,
      totalUntaxed: payload.totalUntaxed,
      totalTaxed: payload.totalTaxed,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as PurchaseOrder;

    const vendorBillDoc = {
      vendorBillId: vendorBillRef.id,
      billNumber,
      customerName,
      purchaseOrder: purchaseOrderRef.id,
      amountDue: payload.totalTaxed,
      paidOn: [],
      billDate,
      billDue,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as VendorBill;

    const batch = adminDb.batch();
    batch.set(purchaseOrderRef, purchaseOrderDoc as unknown as Record<string, unknown>);
    batch.set(vendorBillRef, vendorBillDoc as unknown as Record<string, unknown>);
    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          purchaseOrderId: purchaseOrderRef.id,
          vendorBillId: vendorBillRef.id,
          billNumber,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create purchase order";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
