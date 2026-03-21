import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  BillPaymentPartnerType,
  BillPaymentType,
  CreatePaymentBillRequestBody,
  PaymentBill,
} from "@/types/paymentBill";
import type { VendorBill } from "@/types/vendorBill";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPaymentType(value: unknown): value is BillPaymentType {
  return value === "send" || value === "receive";
}

function isPartnerType(value: unknown): value is BillPaymentPartnerType {
  return value === "customer" || value === "vendor";
}

function parsePayload(payload: unknown): CreatePaymentBillRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreatePaymentBillRequestBody>;

  if (
    !isNonEmptyString(data.vendorBillId) ||
    !isPaymentType(data.paymentType) ||
    !isPartnerType(data.partnerType) ||
    !isNonEmptyString(data.partnerName) ||
    typeof data.amount !== "number" ||
    !Number.isFinite(data.amount) ||
    data.amount <= 0
  ) {
    return null;
  }

  return {
    vendorBillId: data.vendorBillId.trim(),
    paymentType: data.paymentType,
    partnerType: data.partnerType,
    partnerName: data.partnerName.trim(),
    amount: data.amount,
  };
}

function toPayId(sequence: number): string {
  return `PAY/${sequence.toString().padStart(4, "0")}`;
}

function getTimestampMillis(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
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

  return 0;
}

function sortByCreatedAtDesc(items: PaymentBill[]): PaymentBill[] {
  return [...items].sort(
    (a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt),
  );
}

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const searchParams = new URL(request.url).searchParams;
    const vendorBillId = searchParams.get("vendorBillId")?.trim();
    const partnerType = searchParams.get("partnerType")?.trim();

    const collectionRef = adminDb.collection("paymentBills");
    const snapshot = vendorBillId
      ? await collectionRef.where("vendorBillId", "==", vendorBillId).get()
      : partnerType === "vendor" || partnerType === "customer"
        ? await collectionRef.where("partnerType", "==", partnerType).get()
        : await collectionRef.orderBy("createdAt", "desc").get();

    const paymentBills = snapshot.docs.map((docSnapshot) => docSnapshot.data() as PaymentBill);
    const sortedPaymentBills = sortByCreatedAtDesc(paymentBills);

    return NextResponse.json({ success: true, data: sortedPaymentBills }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bill payments";

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
    const payload = parsePayload(body);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid bill payment payload" },
        { status: 400 },
      );
    }

    const vendorBillRef = adminDb.collection("vendorBills").doc(payload.vendorBillId);
    const vendorBillSnapshot = await vendorBillRef.get();

    if (!vendorBillSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Vendor bill not found" },
        { status: 404 },
      );
    }

    const vendorBill = vendorBillSnapshot.data() as VendorBill;

    if (payload.amount > vendorBill.amountDue) {
      return NextResponse.json(
        { success: false, error: "Amount cannot exceed unpaid amount" },
        { status: 400 },
      );
    }

    const paymentBillRef = adminDb.collection("paymentBills").doc();
    const paymentCountSnapshot = await adminDb.collection("paymentBills").count().get();
    const payId = toPayId(Number(paymentCountSnapshot.data().count) + 1);

    const paymentBillDoc = {
      paymentBillId: paymentBillRef.id,
      payId,
      vendorBillId: payload.vendorBillId,
      paymentType: payload.paymentType,
      partnerType: payload.partnerType,
      partnerName: payload.partnerName,
      amount: payload.amount,
      paymentDate: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as PaymentBill;

    const updatedAmountDue = Math.max(0, vendorBill.amountDue - payload.amount);
    const paidOnEntry = {
      date: Timestamp.now(),
      amount: payload.amount,
    };

    const batch = adminDb.batch();
    batch.set(paymentBillRef, paymentBillDoc as unknown as Record<string, unknown>);
    batch.update(vendorBillRef, {
      amountDue: updatedAmountDue,
      paidOn: [...vendorBill.paidOn, paidOnEntry],
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          paymentBillId: paymentBillRef.id,
          payId,
          vendorBillId: payload.vendorBillId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bill payment";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
