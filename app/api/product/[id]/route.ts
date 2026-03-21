import { NextResponse } from "next/server";

import { deleteDoc, doc, getDoc } from "firebase/firestore";

import { ensureInternalUser, ensureUserWithRoles } from "@/lib/apiAuth";
import { productsCollection } from "@/lib/collections";
import type { Product } from "@/types/product";

interface ProductRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: ProductRouteContext) {
  try {
    const authResult = await ensureUserWithRoles(request, ["internal", "portal"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const role = authResult.role;

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
