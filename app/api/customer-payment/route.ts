import { NextResponse } from "next/server";

import { ensureUserWithRoles, getAuthenticatedUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import type {
  CreateCustomerPaymentRequestBody,
  CustomerPayment,
  CustomerPaymentPartnerType,
  CustomerPaymentType,
} from "@/types/customerPayment";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { PaymentTerm } from "@/types/paymentTerm";
import type { SaleOrder } from "@/types/saleOrder";

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

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

async function getPortalOwnedInvoiceIds(contactId: string): Promise<Set<string>> {
  const saleOrdersSnapshot = await adminDb.collection("saleOrders").where("customerId", "==", contactId).get();
  const saleOrderIds = new Set(
    saleOrdersSnapshot.docs.map((docSnapshot) => (docSnapshot.data() as SaleOrder).saleOrderId),
  );

  if (saleOrderIds.size === 0) {
    return new Set<string>();
  }

  const customerInvoicesSnapshot = await adminDb.collection("customerInvoices").get();
  const invoiceIds = customerInvoicesSnapshot.docs
    .map((docSnapshot) => docSnapshot.data() as CustomerInvoice)
    .filter((invoice) => saleOrderIds.has(invoice.saleOrderId))
    .map((invoice) => invoice.customerInvoiceId);

  return new Set(invoiceIds);
}

async function ensurePortalOwnsInvoice(contactId: string, customerInvoice: CustomerInvoice): Promise<boolean> {
  const saleOrderSnapshot = await adminDb.collection("saleOrders").doc(customerInvoice.saleOrderId).get();

  if (!saleOrderSnapshot.exists) {
    return false;
  }

  const saleOrder = saleOrderSnapshot.data() as SaleOrder;
  return saleOrder.customerId === contactId;
}

function computeExpectedPayable(customerInvoice: CustomerInvoice, paymentTerm: PaymentTerm | null): number {
  if (!paymentTerm || paymentTerm.name.trim().toLowerCase() === "immediate payment") {
    return roundToTwo(customerInvoice.amountDue);
  }

  if (
    !paymentTerm.early_payment_discount ||
    !paymentTerm.discount_percentage ||
    !paymentTerm.discount_days ||
    !paymentTerm.early_pay_discount_computation
  ) {
    return roundToTwo(customerInvoice.amountDue);
  }

  const invoiceDateMs = getTimestampMillis(customerInvoice.invoiceDate);
  const nowMs = Date.now();
  const discountWindowMs = paymentTerm.discount_days * 24 * 60 * 60 * 1000;
  const eligibleForEarlyDiscount = invoiceDateMs > 0 && nowMs <= invoiceDateMs + discountWindowMs;

  if (!eligibleForEarlyDiscount) {
    return roundToTwo(customerInvoice.amountDue);
  }

  const baseAmount =
    paymentTerm.early_pay_discount_computation === "base_amount"
      ? Math.max(0, customerInvoice.subtotalUntaxed - customerInvoice.couponDiscountTotal)
      : customerInvoice.amountDue;

  const discountAmount = (baseAmount * paymentTerm.discount_percentage) / 100;
  return roundToTwo(Math.max(0, customerInvoice.amountDue - discountAmount));
}

export async function GET(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const searchParams = new URL(request.url).searchParams;
    const customerInvoiceId = searchParams.get("customerInvoiceId")?.trim();

    const collectionRef = adminDb.collection("customerPayments");
    const snapshot = customerInvoiceId
      ? await collectionRef.where("customerInvoiceId", "==", customerInvoiceId).get()
      : await collectionRef.orderBy("createdAt", "desc").get();

    let customerPayments = snapshot.docs.map((docSnapshot) => docSnapshot.data() as CustomerPayment);

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      const allowedInvoiceIds = await getPortalOwnedInvoiceIds(currentUserResult.data.user.contactId);
      customerPayments = customerPayments.filter((payment) => allowedInvoiceIds.has(payment.customerInvoiceId));
    }

    return NextResponse.json({ success: true, data: sortByCreatedAtDesc(customerPayments) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer payments";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
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

    if (authResult.role === "portal") {
      const currentUserResult = await getAuthenticatedUser(request);

      if ("response" in currentUserResult) {
        return currentUserResult.response;
      }

      const ownsInvoice = await ensurePortalOwnsInvoice(
        currentUserResult.data.user.contactId,
        customerInvoice,
      );

      if (!ownsInvoice) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    if (customerInvoice.amountDue <= 0) {
      return NextResponse.json({ success: false, error: "Invoice already paid" }, { status: 400 });
    }

    if (customerInvoice.paidOn) {
      return NextResponse.json({ success: false, error: "Single payment already recorded" }, { status: 400 });
    }

    const paymentTerm = customerInvoice.paymentTermId
      ? ((await adminDb.collection("paymentTerms").doc(customerInvoice.paymentTermId).get()).data() as PaymentTerm | undefined)
      : undefined;

    const expectedPayable = computeExpectedPayable(customerInvoice, paymentTerm ?? null);
    const submittedAmount = roundToTwo(payload.amount);

    if (Math.abs(submittedAmount - expectedPayable) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: `Full single payment required. Expected amount: ${expectedPayable.toFixed(2)}`,
        },
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
      amount: submittedAmount,
      paymentDate: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } as unknown as CustomerPayment;

    const paidOnEntry = {
      date: Timestamp.now(),
      amount: submittedAmount,
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
