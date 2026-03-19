import { collection, Timestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Contact } from "@/types/contact";
import type { Product } from "@/types/product";
import type { User } from "@/types/user";

export const usersCollection = collection(db, "users");
export const contactsCollection = collection(db, "contacts");
export const productsCollection = collection(db, "products");

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
    productCategory: input.productCategory,
    productType: input.productType,
    material: input.material,
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
