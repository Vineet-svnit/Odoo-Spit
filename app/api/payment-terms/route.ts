import { NextResponse } from "next/server";

import { ensureInternalUser, ensureUserWithRoles } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreatePaymentTermRequestBody,
  EarlyPayDiscountComputation,
  PaymentTerm,
} from "@/types/paymentTerm";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidComputation(value: unknown): value is EarlyPayDiscountComputation {
  return value === "base_amount" || value === "total_amount";
}

function buildExamplePreview(payload: CreatePaymentTermRequestBody): string {
  if (payload.early_payment_discount) {
    return `Early Payment Discount: ${payload.discount_percentage}% if paid before ${payload.discount_days} days`;
  }

  if (payload.name.toLowerCase() === "immediate payment") {
    return "Payment Terms: Immediate Payment";
  }

  return `Payment Terms: ${payload.name}`;
}

function parseAndValidatePayload(payload: unknown): CreatePaymentTermRequestBody | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Partial<CreatePaymentTermRequestBody>;

  if (!isNonEmptyString(data.name)) {
    return null;
  }

  if (typeof data.early_payment_discount !== "boolean") {
    return null;
  }

  if (data.early_payment_discount) {
    if (
      typeof data.discount_percentage !== "number" ||
      !Number.isFinite(data.discount_percentage) ||
      data.discount_percentage <= 0 ||
      data.discount_percentage > 100
    ) {
      return null;
    }

    if (
      typeof data.discount_days !== "number" ||
      !Number.isInteger(data.discount_days) ||
      data.discount_days <= 0
    ) {
      return null;
    }

    if (!isValidComputation(data.early_pay_discount_computation)) {
      return null;
    }
  }

  return {
    name: data.name.trim(),
    early_payment_discount: data.early_payment_discount,
    discount_percentage: data.discount_percentage,
    discount_days: data.discount_days,
    early_pay_discount_computation: data.early_pay_discount_computation,
  };
}

async function ensureImmediatePaymentTermExists(): Promise<void> {
  const defaultSnapshot = await adminDb
    .collection("paymentTerms")
    .where("isWebsiteDefault", "==", true)
    .limit(1)
    .get();

  if (!defaultSnapshot.empty) {
    return;
  }

  const docRef = adminDb.collection("paymentTerms").doc();

  const defaultTerm = {
    termId: docRef.id,
    name: "Immediate Payment",
    early_payment_discount: false,
    discount_percentage: null,
    discount_days: null,
    early_pay_discount_computation: null,
    example_preview: "Payment Terms: Immediate Payment",
    isWebsiteDefault: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  } as unknown as PaymentTerm;

  await docRef.set(defaultTerm as unknown as Record<string, unknown>);
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    await ensureImmediatePaymentTermExists();

    const termsSnapshot = await adminDb.collection("paymentTerms").get();
    const terms = termsSnapshot.docs.map((docSnapshot) => docSnapshot.data() as PaymentTerm);

    return NextResponse.json({ success: true, data: terms }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payment terms";

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
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    const isWebsiteDefault =
      payload.name.toLowerCase() === "immediate payment" &&
      payload.early_payment_discount === false;
    const examplePreview = buildExamplePreview(payload);

    const docRef = adminDb.collection("paymentTerms").doc();

    const paymentTermDoc = {
      termId: docRef.id,
      name: payload.name,
      early_payment_discount: payload.early_payment_discount,
      discount_percentage: payload.early_payment_discount
        ? (payload.discount_percentage as number)
        : null,
      discount_days: payload.early_payment_discount ? (payload.discount_days as number) : null,
      early_pay_discount_computation: payload.early_payment_discount
        ? (payload.early_pay_discount_computation as EarlyPayDiscountComputation)
        : null,
      example_preview: examplePreview,
      isWebsiteDefault,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as PaymentTerm;

    await docRef.set(paymentTermDoc as unknown as Record<string, unknown>);

    return NextResponse.json({ success: true, data: { termId: docRef.id } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment term";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
