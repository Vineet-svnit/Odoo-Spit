import { NextResponse } from "next/server";

import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { createProductDoc, productsCollection } from "@/lib/collections";
import type { Product } from "@/types/product";

type ProductWritePayload = Omit<Product, "productId" | "createdAt" | "updatedAt">;

interface ProductRouteContext {
  params: Promise<{ id: string }>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProductWritePayload(payload: unknown): payload is ProductWritePayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const data = payload as Partial<Record<keyof ProductWritePayload, unknown>>;

  return Boolean(
    isNonEmptyString(data.productName) &&
      isNonEmptyString(data.productCategoryId) &&
      isNonEmptyString(data.productCategoryName) &&
      isNonEmptyString(data.productTypeId) &&
      isNonEmptyString(data.productTypeName) &&
      isNonEmptyString(data.materialId) &&
      isNonEmptyString(data.materialName) &&
      Array.isArray(data.colors) &&
      data.colors.every((color) => typeof color === "string") &&
      typeof data.currentStock === "number" &&
      typeof data.salesPrice === "number" &&
      typeof data.salesTax === "number" &&
      typeof data.purchasePrice === "number" &&
      typeof data.purchaseTax === "number" &&
      typeof data.published === "boolean" &&
      Array.isArray(data.images) &&
      data.images.every((image) => typeof image === "string"),
  );
}

export async function PUT(request: Request, context: ProductRouteContext) {
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

    const body = (await request.json()) as unknown;

    if (!isProductWritePayload(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid product payload" },
        { status: 400 },
      );
    }

    const existingProduct = productSnapshot.data() as Product;

    const updatedProduct = createProductDoc({
      ...body,
      productId: id,
      createdAt: existingProduct.createdAt,
      updatedAt: Timestamp.now(),
    });

    await setDoc(productDocRef, updatedProduct);

    return NextResponse.json({ success: true, data: updatedProduct }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update product";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
