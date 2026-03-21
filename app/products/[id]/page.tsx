"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Product } from "@/types/product";

interface ProductResponse {
  success?: boolean;
  data?: Product;
  error?: string;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = typeof params.id === "string" ? params.id : "";

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setError("Invalid product id");
      setIsLoading(false);
      return;
    }

    async function loadProduct() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();
        const response = await fetch(`/api/product/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await response.json()) as ProductResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setProduct(null);
          setError(payload.error ?? "Failed to fetch product");
          return;
        }

        setProduct(payload.data);
      } catch {
        setProduct(null);
        setError("Failed to fetch product");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProduct();
  }, [productId]);

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#ffd8b2_0%,transparent_34%),radial-gradient(circle_at_85%_8%,#bdebd9_0%,transparent_36%),linear-gradient(150deg,#f9f4ec,#eef6f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Product Detail
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              Product Overview
            </h1>
          </div>
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Products
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading product...</p> : null}

        {error ? (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        {product ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Name</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.productName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Category</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.productCategoryName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.productTypeName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Material</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.materialName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Published</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {product.published ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Current Stock</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.currentStock}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sales Price</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">₹{product.salesPrice}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Sales Tax</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.salesTax}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Purchase Price</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">₹{product.purchasePrice}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Purchase Tax</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.purchaseTax}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Colors</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{product.colors.join(", ") || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Images</p>
              <ul className="mt-2 grid gap-2">
                {product.images.length > 0 ? (
                  product.images.map((image) => (
                    <li key={image} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                      {image}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-zinc-600">No images</li>
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </section>
    </main>
    </>
  );
}
