import { NextResponse } from "next/server";

import { ensureInternalUser } from "@/lib/apiAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

interface AutoInvoicingSetting {
  enabled: boolean;
  updatedAt: unknown;
}

const SETTINGS_COLLECTION = "financeSettings";
const AUTO_INVOICING_DOC_ID = "autoInvoicing";

function parsePayload(payload: unknown): { enabled: boolean } | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as { enabled?: unknown };

  if (typeof data.enabled !== "boolean") {
    return null;
  }

  return { enabled: data.enabled };
}

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const snapshot = await adminDb.collection(SETTINGS_COLLECTION).doc(AUTO_INVOICING_DOC_ID).get();

    if (!snapshot.exists) {
      return NextResponse.json({ success: true, data: { enabled: false } }, { status: 200 });
    }

    const setting = snapshot.data() as AutoInvoicingSetting;

    return NextResponse.json(
      { success: true, data: { enabled: Boolean(setting.enabled) } },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch auto invoicing setting";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
    }

    await adminDb.collection(SETTINGS_COLLECTION).doc(AUTO_INVOICING_DOC_ID).set(
      {
        enabled: payload.enabled,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ success: true, data: { enabled: payload.enabled } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update auto invoicing setting";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
