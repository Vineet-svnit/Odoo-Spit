"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Timestamp, collection, doc, getDocs, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { Material } from "@/types/material";
import type { Product } from "@/types/product";
import type { ProductCategory } from "@/types/productCategory";
import type { ProductType } from "@/types/productType";

type ProductWritePayload = Omit<Product, "productId" | "createdAt" | "updatedAt">;

interface ProductCreateResponse {
  success?: boolean;
  data?: Product;
  error?: string;
}

interface ProductFormState {
  productName: string;
  selectedCategoryId: string;
  selectedTypeId: string;
  selectedMaterialId: string;
  colors: string;
  currentStock: string;
  salesPrice: string;
  salesTax: string;
  purchasePrice: string;
  purchaseTax: string;
  published: "true" | "false";
  images: string;
}

const INITIAL_STATE: ProductFormState = {
  productName: "",
  selectedCategoryId: "",
  selectedTypeId: "",
  selectedMaterialId: "",
  colors: "",
  currentStock: "",
  salesPrice: "",
  salesTax: "",
  purchasePrice: "",
  purchaseTax: "",
  published: "false",
  images: "",
};

function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPayload(
  form: ProductFormState,
  categories: ProductCategory[],
  types: ProductType[],
  materials: Material[],
): ProductWritePayload | null {
  const selectedCategory = categories.find(
    (category) => category.categoryId === form.selectedCategoryId,
  );
  const selectedType = types.find((type) => type.typeId === form.selectedTypeId);
  const selectedMaterial = materials.find(
    (material) => material.materialId === form.selectedMaterialId,
  );

  if (!selectedCategory || !selectedType || !selectedMaterial) {
    return null;
  }

  return {
    productName: form.productName.trim(),
    productCategoryId: selectedCategory.categoryId,
    productCategoryName: selectedCategory.name,
    productTypeId: selectedType.typeId,
    productTypeName: selectedType.name,
    materialId: selectedMaterial.materialId,
    materialName: selectedMaterial.name,
    colors: parseCsv(form.colors),
    currentStock: Number(form.currentStock),
    salesPrice: Number(form.salesPrice),
    salesTax: Number(form.salesTax),
    purchasePrice: Number(form.purchasePrice),
    purchaseTax: Number(form.purchaseTax),
    published: form.published === "true",
    images: parseCsv(form.images),
  };
}

function isValidPayload(payload: ProductWritePayload): boolean {
  return Boolean(
    payload.productName &&
      payload.productCategoryId &&
      payload.productCategoryName &&
      payload.productTypeId &&
      payload.productTypeName &&
      payload.materialId &&
      payload.materialName &&
      payload.colors.length > 0 &&
      Number.isFinite(payload.currentStock) &&
      Number.isFinite(payload.salesPrice) &&
      Number.isFinite(payload.salesTax) &&
      Number.isFinite(payload.purchasePrice) &&
      Number.isFinite(payload.purchaseTax) &&
      payload.images.length > 0,
  );
}

export default function NewProductPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProductFormState>(INITIAL_STATE);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newMaterialName, setNewMaterialName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      setIsLoadingLookups(true);

      try {
        const [categorySnapshot, typeSnapshot, materialSnapshot] = await Promise.all([
          getDocs(collection(db, "productCategories")),
          getDocs(collection(db, "productTypes")),
          getDocs(collection(db, "materials")),
        ]);

        const categoryRows = categorySnapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Partial<ProductCategory>;
            const categoryId = data.categoryId ?? docSnapshot.id;
            const name = typeof data.name === "string" ? data.name : "";

            return {
              categoryId,
              name,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as ProductCategory;
          })
          .filter((row) => row.categoryId && row.name);

        const typeRows = typeSnapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Partial<ProductType>;
            const typeId = data.typeId ?? docSnapshot.id;
            const name = typeof data.name === "string" ? data.name : "";

            return {
              typeId,
              name,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as ProductType;
          })
          .filter((row) => row.typeId && row.name);

        const materialRows = materialSnapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Partial<Material>;
            const materialId = data.materialId ?? docSnapshot.id;
            const name = typeof data.name === "string" ? data.name : "";

            return {
              materialId,
              name,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as Material;
          })
          .filter((row) => row.materialId && row.name);

        setCategories(categoryRows);
        setTypes(typeRows);
        setMaterials(materialRows);
      } catch {
        setIsError(true);
        setMessage("Failed to load category, type, or material options");
      } finally {
        setIsLoadingLookups(false);
      }
    }

    void loadLookups();
  }, []);

  async function handleCreateCategory() {

    const name = newCategoryName.trim();

    if (!name) {
      setIsError(true);
      setMessage("Category name is required");
      return;
    }

    setIsCreatingCategory(true);
    setIsError(false);
    setMessage(null);

    try {
      const categoryRef = doc(collection(db, "productCategories"));
      const now = Timestamp.now();

      const categoryDoc: ProductCategory = {
        categoryId: categoryRef.id,
        name,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(categoryRef, categoryDoc);

      setCategories((prev) => [
        ...prev,
        categoryDoc,
      ]);
      setForm((prev) => ({ ...prev, selectedCategoryId: categoryDoc.categoryId }));
      setNewCategoryName("");
    } catch {
      setIsError(true);
      setMessage("Failed to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function handleCreateType() {

    const name = newTypeName.trim();

    if (!name) {
      setIsError(true);
      setMessage("Type name is required");
      return;
    }

    setIsCreatingType(true);
    setIsError(false);
    setMessage(null);

    try {
      const typeRef = doc(collection(db, "productTypes"));
      const now = Timestamp.now();

      const typeDoc: ProductType = {
        typeId: typeRef.id,
        name,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(typeRef, typeDoc);

      setTypes((prev) => [
        ...prev,
        typeDoc,
      ]);
      setForm((prev) => ({ ...prev, selectedTypeId: typeDoc.typeId }));
      setNewTypeName("");
    } catch {
      setIsError(true);
      setMessage("Failed to create type");
    } finally {
      setIsCreatingType(false);
    }
  }

  async function handleCreateMaterial() {

    const name = newMaterialName.trim();

    if (!name) {
      setIsError(true);
      setMessage("Material name is required");
      return;
    }

    setIsCreatingMaterial(true);
    setIsError(false);
    setMessage(null);

    try {
      const materialRef = doc(collection(db, "materials"));
      const now = Timestamp.now();

      const materialDoc: Material = {
        materialId: materialRef.id,
        name,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(materialRef, materialDoc);

      setMaterials((prev) => [
        ...prev,
        materialDoc,
      ]);
      setForm((prev) => ({ ...prev, selectedMaterialId: materialDoc.materialId }));
      setNewMaterialName("");
    } catch {
      setIsError(true);
      setMessage("Failed to create material");
    } finally {
      setIsCreatingMaterial(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const payload = toPayload(form, categories, types, materials);

      if (!payload) {
        setIsError(true);
        setMessage("Please select valid category, type, and material");
        return;
      }

      if (!isValidPayload(payload)) {
        setIsError(true);
        setMessage("Please fill all required fields with valid values");
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setIsError(true);
        setMessage("You must be logged in as internal user");
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as ProductCreateResponse;

      if (!response.ok || !responsePayload.success || !responsePayload.data) {
        setIsError(true);
        setMessage(responsePayload.error ?? "Failed to create product");
        return;
      }

      router.push(`/products/${responsePayload.data.productId}`);
    } catch {
      setIsError(true);
      setMessage("Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#ffd7b3_0%,transparent_34%),radial-gradient(circle_at_80%_10%,#c6f3dd_0%,transparent_36%),linear-gradient(140deg,#f8f3ec,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Inventory
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              New Product
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Create a new product and save it to the catalog.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Products
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Quick Add Master Data
            </p>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="New category name"
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => {
                  void handleCreateCategory();
                }}
                disabled={isCreatingCategory}
                className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isCreatingCategory ? "Adding..." : "Add Category"}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                placeholder="New type name"
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => {
                  void handleCreateType();
                }}
                disabled={isCreatingType}
                className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isCreatingType ? "Adding..." : "Add Type"}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={newMaterialName}
                onChange={(event) => setNewMaterialName(event.target.value)}
                placeholder="New material name"
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => {
                  void handleCreateMaterial();
                }}
                disabled={isCreatingMaterial}
                className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {isCreatingMaterial ? "Adding..." : "Add Material"}
              </button>
            </div>
          </div>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Product Name</span>
            <input
              required
              value={form.productName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, productName: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Category</span>
            <select
              required
              value={form.selectedCategoryId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, selectedCategoryId: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              disabled={isLoadingLookups}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Type</span>
            <select
              required
              value={form.selectedTypeId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, selectedTypeId: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              disabled={isLoadingLookups}
            >
              <option value="">Select type</option>
              {types.map((type) => (
                <option key={type.typeId} value={type.typeId}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Material</span>
            <select
              required
              value={form.selectedMaterialId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, selectedMaterialId: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              disabled={isLoadingLookups}
            >
              <option value="">Select material</option>
              {materials.map((material) => (
                <option key={material.materialId} value={material.materialId}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Colors (comma separated)</span>
            <input
              required
              value={form.colors}
              onChange={(event) => setForm((prev) => ({ ...prev, colors: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              placeholder="Red, Blue, Black"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Current Stock</span>
            <input
              required
              type="number"
              value={form.currentStock}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, currentStock: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Sales Price</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.salesPrice}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, salesPrice: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Sales Tax (%)</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.salesTax}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, salesTax: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Purchase Price</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.purchasePrice}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, purchasePrice: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Purchase Tax (%)</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.purchaseTax}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, purchaseTax: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Images (comma separated URLs)</span>
            <input
              required
              value={form.images}
              onChange={(event) => setForm((prev) => ({ ...prev, images: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
              placeholder="https://..., https://..."
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Published</span>
            <select
              value={form.published}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  published: event.target.value as ProductFormState["published"],
                }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
          >
            {isSubmitting ? "Creating product..." : "Create Product"}
          </button>
        </form>

        {message ? (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
