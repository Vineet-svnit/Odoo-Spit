import { NextRequest, NextResponse } from "next/server";

import {
  doc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  type QueryConstraint,
} from "firebase/firestore";

import { ensureInternalUser } from "@/lib/apiAuth";
import { createProductDoc, productsCollection } from "@/lib/collections";
import type { Product } from "@/types/product";

type ProductWritePayload = Omit<Product, "productId" | "createdAt" | "updatedAt">;

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

function normalizeBooleanFilter(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filters: QueryConstraint[] = [];

    const productId = searchParams.get("productId");
    const productName = searchParams.get("productName");
    const productCategoryId = searchParams.get("productCategoryId");
    const productTypeId = searchParams.get("productTypeId");
    const materialId = searchParams.get("materialId");
    const published = normalizeBooleanFilter(searchParams.get("published"));

    if (productId) {
      filters.push(where("productId", "==", productId));
    }

    if (productName) {
      filters.push(where("productName", "==", productName));
    }

    if (productCategoryId) {
      filters.push(where("productCategoryId", "==", productCategoryId));
    }

    if (productTypeId) {
      filters.push(where("productTypeId", "==", productTypeId));
    }

    if (materialId) {
      filters.push(where("materialId", "==", materialId));
    }

    if (published !== null) {
      filters.push(where("published", "==", published));
    }

    const productsSnapshot = filters.length
      ? await getDocs(query(productsCollection, ...filters))
      : await getDocs(productsCollection);

    const products = productsSnapshot.docs.map((docSnapshot) =>
      docSnapshot.data() as Product,
    );

    return NextResponse.json({ success: true, data: products }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch products";

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

    if (!isProductWritePayload(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid product payload" },
        { status: 400 },
      );
    }

    const createdAt = Timestamp.now();
    const docRef = doc(productsCollection);

    const productDoc = createProductDoc({
      ...body,
      productId: docRef.id,
      createdAt,
      updatedAt: createdAt,
    });

    await setDoc(docRef, productDoc);

    return NextResponse.json({ success: true, data: productDoc }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create product";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
