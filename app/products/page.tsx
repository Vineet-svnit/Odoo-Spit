"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Product } from "@/types/product";

interface ProductListResponse {
  success?: boolean;
  data?: Product[];
  error?: string;
}

interface ProductFilters {
  productName: string;
  published: "" | "true" | "false";
}

const INITIAL_FILTERS: ProductFilters = {
  productName: "",
  published: "",
};

function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams();

  if (filters.productName.trim()) {
    params.set("productName", filters.productName.trim());
  }

  if (filters.published) {
    params.set("published", filters.published);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<ProductFilters>(INITIAL_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts(activeFilters: ProductFilters) {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getCurrentIdToken();
      const response = await fetch(`/api/product${buildQueryString(activeFilters)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as ProductListResponse;

      if (!response.ok || !payload.success) {
        setProducts([]);
        setError(payload.error ?? "Failed to fetch products");
        return;
      }

      setProducts(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setProducts([]);
      setError("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts(INITIAL_FILTERS);
  }, []);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadProducts(filters);
  }

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
    void loadProducts(INITIAL_FILTERS);
  }

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#ffd6a8_0%,transparent_32%),radial-gradient(circle_at_85%_10%,#b6f0d8_0%,transparent_36%),linear-gradient(145deg,#f8f3ec,#edf7f1)] px-6 py-10">
      <section className="mx-auto w-full max-w-7xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Inventory
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
              Products
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Browse all products and filter by core product fields.
            </p>
          </div>

          <Link
            href="/products/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            + New Product
          </Link>
        </div>

        <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Product Name</span>
            <input
              value={filters.productName}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, productName: event.target.value }))
              }
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Published</span>
            <select
              value={filters.published}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  published: event.target.value as ProductFilters["published"],
                }))
              }
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
          </label>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Clear
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-zinc-600">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-zinc-600">No products found.</p>
          ) : (
            products.map((product) => (
              <Link
                key={product.productId}
                href={`/products/${product.productId}`}
                className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
              >
                <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:text-emerald-700">
                  {product.productName}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">{product.productCategoryName}</p>
                <p className="mt-1 text-sm text-zinc-600">{product.productTypeName}</p>
                <p className="mt-1 text-sm text-zinc-600">Material: {product.materialName}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-800">Stock: {product.currentStock}</span>
                  <span className="font-semibold text-emerald-700">₹{product.salesPrice}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
    </>
  );
}
