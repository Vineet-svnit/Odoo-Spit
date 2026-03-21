import { NextResponse } from "next/server";

import { deleteDoc, doc, getDoc } from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { productsCollection } from "@/lib/collections";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import type { Product } from "@/types/product";
import type { UserRole } from "@/types/user";

interface ProductRouteContext {
  params: Promise<{ id: string }>;
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

async function getRequestUserRole(request: Request): Promise<UserRole | null> {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return null;
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userSnapshot = await adminDb.collection("users").doc(decodedToken.uid).get();

    if (!userSnapshot.exists) {
      return null;
    }

    const role = (userSnapshot.data() as { role?: unknown }).role;

    if (role !== "internal" && role !== "portal") {
      return null;
    }

    return role;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: ProductRouteContext) {
  try {
    const role = await getRequestUserRole(request);

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const productDocRef = doc(productsCollection, id);
    const productSnapshot = await getDoc(productDocRef);

    if (!productSnapshot.exists()) {
      return NextResponse.json(
        { success: false, error: "Product Not Found" },
        { status: 404 },
      );
    }

    const product = productSnapshot.data() as Product;

    if (role === "portal" && !product.published) {
      return NextResponse.json(
        { success: false, error: "Product Not Found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: product }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch product";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: ProductRouteContext) {
  try {
    const unauthorizedResponse = await ensureInternalUser(request);

    if (unauthorizedResponse) {
      return unauthorizedResponse;
    }

    const { id } = await context.params;
    const productDocRef = doc(productsCollection, id);
    const productSnapshot = await getDoc(productDocRef);

    if (!productSnapshot.exists()) {
      return NextResponse.json(
        { success: false, error: "Product Not Found" },
        { status: 404 },
      );
    }

    await deleteDoc(productDocRef);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete product";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
