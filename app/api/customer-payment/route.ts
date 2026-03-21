import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  CreateCustomerPaymentRequestBody,
  CustomerPayment,
  CustomerPaymentPartnerType,
  CustomerPaymentType,
} from "@/types/customerPayment";
import type { CustomerInvoice } from "@/types/customerInvoice";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPaymentType(value: unknown): value is CustomerPaymentType {
  return value === "receive";
}

function isPartnerType(value: unknown): value is CustomerPaymentPartnerType {
  return value === "customer";
}

function parsePayload(payload: unknown): CreateCustomerPaymentRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreateCustomerPaymentRequestBody>;

  if (
    !isNonEmptyString(data.customerInvoiceId) ||
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
    customerInvoiceId: data.customerInvoiceId.trim(),
    paymentType: data.paymentType,
    partnerType: data.partnerType,
    partnerName: data.partnerName.trim(),
    amount: data.amount,
  };
}

function toPayId(sequence: number): string {
  return `RCV/${sequence.toString().padStart(4, "0")}`;
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

function sortByCreatedAtDesc(items: CustomerPayment[]): CustomerPayment[] {
  return [...items].sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
}

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const searchParams = new URL(request.url).searchParams;
    const customerInvoiceId = searchParams.get("customerInvoiceId")?.trim();

    const collectionRef = adminDb.collection("customerPayments");
    const snapshot = customerInvoiceId
      ? await collectionRef.where("customerInvoiceId", "==", customerInvoiceId).get()
      : await collectionRef.orderBy("createdAt", "desc").get();

    const customerPayments = snapshot.docs.map((docSnapshot) => docSnapshot.data() as CustomerPayment);

    return NextResponse.json({ success: true, data: sortByCreatedAtDesc(customerPayments) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer payments";

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
        { success: false, error: "Invalid customer payment payload" },
        { status: 400 },
      );
    }

    const customerInvoiceRef = adminDb.collection("customerInvoices").doc(payload.customerInvoiceId);
    const customerInvoiceSnapshot = await customerInvoiceRef.get();

    if (!customerInvoiceSnapshot.exists) {
      return NextResponse.json({ success: false, error: "Customer invoice not found" }, { status: 404 });
    }

    const customerInvoice = customerInvoiceSnapshot.data() as CustomerInvoice;

    if (customerInvoice.amountDue <= 0) {
      return NextResponse.json({ success: false, error: "Invoice already paid" }, { status: 400 });
    }

    if (customerInvoice.paidOn) {
      return NextResponse.json({ success: false, error: "Single payment already recorded" }, { status: 400 });
    }

    if (payload.amount > customerInvoice.amountDue) {
      return NextResponse.json(
        { success: false, error: "Amount cannot exceed unpaid amount" },
        { status: 400 },
      );
    }

    const customerPaymentRef = adminDb.collection("customerPayments").doc();
    const paymentCountSnapshot = await adminDb.collection("customerPayments").count().get();
    const payId = toPayId(Number(paymentCountSnapshot.data().count) + 1);

    const customerPaymentDoc = {
      customerPaymentId: customerPaymentRef.id,
      payId,
      customerInvoiceId: payload.customerInvoiceId,
      paymentType: payload.paymentType,
      partnerType: payload.partnerType,
      partnerName: payload.partnerName,
      amount: payload.amount,
      paymentDate: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as CustomerPayment;

    const paidOnEntry = {
      date: Timestamp.now(),
      amount: payload.amount,
    };

    const batch = adminDb.batch();
    batch.set(customerPaymentRef, customerPaymentDoc as unknown as Record<string, unknown>);
    batch.update(customerInvoiceRef, {
      amountDue: 0,
      paidOn: paidOnEntry,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json(
      {
        success: true,
        data: {
          customerPaymentId: customerPaymentRef.id,
          payId,
          customerInvoiceId: payload.customerInvoiceId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create customer payment";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
