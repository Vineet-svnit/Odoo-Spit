import { NextResponse } from "next/server";

import { doc, getDoc } from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { contactsCollection } from "@/lib/collections";
import type { Contact } from "@/types/contact";

interface ContactRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: ContactRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const contactSnapshot = await getDoc(doc(contactsCollection, id));

    if (!contactSnapshot.exists()) {
      return NextResponse.json(
        { success: false, error: "Contact Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: contactSnapshot.data() as Contact },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch contact";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
