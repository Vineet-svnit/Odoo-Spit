import { NextResponse } from "next/server";

import { getDocs } from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { contactsCollection } from "@/lib/collections";
import type { Contact } from "@/types/contact";

export async function GET(request: Request) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const contactsSnapshot = await getDocs(contactsCollection);
    const contacts = contactsSnapshot.docs.map((docSnapshot) =>
      docSnapshot.data() as Contact,
    );

    return NextResponse.json({ success: true, data: contacts }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch contacts";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
