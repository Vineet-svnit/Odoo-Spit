import { collection, Timestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Contact } from "@/types/contact";
import type { Product } from "@/types/product";
import type { User } from "@/types/user";
import type { Material } from "../types/material";
import type { ProductCategory } from "../types/productCategory";
import type { ProductType } from "../types/productType";

export const usersCollection = collection(db, "users");
export const contactsCollection = collection(db, "contacts");
export const productsCollection = collection(db, "products");
export const productCategoriesCollection = collection(db, "productCategories");
export const productTypesCollection = collection(db, "productTypes");
export const materialsCollection = collection(db, "materials");

export type CreateUserDocInput = Omit<User, "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateContactDocInput = Omit<Contact, "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateProductDocInput = Omit<Product, "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateProductCategoryDocInput = Omit<
  ProductCategory,
  "createdAt" | "updatedAt"
> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateProductTypeDocInput = Omit<ProductType, "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateMaterialDocInput = Omit<Material, "createdAt" | "updatedAt"> & {
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export function createUserDoc(input: CreateUserDocInput): User {
  if (!input.userId) {
    throw new Error("userId is required");
  }

  const now = Timestamp.now();

  return {
    userId: input.userId,
    name: input.name,
    role: input.role,
    email: input.email,
    mobile: input.mobile,
    address: input.address,
    contactId: input.contactId,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createContactDoc(input: CreateContactDocInput): Contact {
  if (!input.contactId) {
    throw new Error("contactId is required");
  }

  const now = Timestamp.now();

  return {
    contactId: input.contactId,
    name: input.name,
    type: input.type,
    email: input.email,
    mobile: input.mobile,
    address: input.address,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createProductDoc(input: CreateProductDocInput): Product {
  if (!input.productId) {
    throw new Error("productId is required");
  }

  const now = Timestamp.now();

  return {
    productId: input.productId,
    productName: input.productName,
    productCategoryId: input.productCategoryId,
    productCategoryName: input.productCategoryName,
    productTypeId: input.productTypeId,
    productTypeName: input.productTypeName,
    materialId: input.materialId,
    materialName: input.materialName,
    colors: input.colors,
    currentStock: input.currentStock,
    salesPrice: input.salesPrice,
    salesTax: input.salesTax,
    purchasePrice: input.purchasePrice,
    purchaseTax: input.purchaseTax,
    published: input.published,
    images: input.images,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createProductCategoryDoc(
  input: CreateProductCategoryDocInput,
): ProductCategory {
  if (!input.categoryId) {
    throw new Error("categoryId is required");
  }

  const now = Timestamp.now();

  return {
    categoryId: input.categoryId,
    name: input.name,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createProductTypeDoc(input: CreateProductTypeDocInput): ProductType {
  if (!input.typeId) {
    throw new Error("typeId is required");
  }

  const now = Timestamp.now();

  return {
    typeId: input.typeId,
    name: input.name,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function createMaterialDoc(input: CreateMaterialDocInput): Material {
  if (!input.materialId) {
    throw new Error("materialId is required");
  }

  const now = Timestamp.now();

  return {
    materialId: input.materialId,
    name: input.name,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
