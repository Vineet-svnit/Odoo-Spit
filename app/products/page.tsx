"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <main className="app-shell px-6 py-10">
      <Card className="app-surface mx-auto w-full max-w-7xl p-6 md:p-8">
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

          <Button asChild className="h-11 px-5 text-sm font-semibold rounded-xl">
            <Link href="/products/new">
              + New Product
            </Link>
          </Button>
        </div>

        <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Product Name</span>
            <Input
              value={filters.productName}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, productName: event.target.value }))
              }
              className="h-10"
            />
          </Label>

          <Label className="grid gap-1">
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
          </Label>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit" className="h-10 px-4 text-sm font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800">
              Apply Filters
            </Button>
            <Button
              type="button"
              onClick={handleClearFilters}
              variant="secondary"
              className="h-10 px-4 text-sm font-semibold rounded-lg"
            >
              Clear
            </Button>
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
              <Card key={product.productId} className="app-surface group rounded-2xl p-4 transition app-surface-hover">
                <Link href={`/products/${product.productId}`} className="block">
                  <CardHeader className="p-0 mb-2">
                    <CardTitle className="mt-2 text-lg font-semibold text-zinc-900 group-hover:text-emerald-700">
                      {product.productName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="mt-2 text-sm text-zinc-600">{product.productCategoryName}</p>
                    <p className="mt-1 text-sm text-zinc-600">{product.productTypeName}</p>
                    <p className="mt-1 text-sm text-zinc-600">Material: {product.materialName}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-800">Stock: {product.currentStock}</span>
                      <span className="font-semibold text-emerald-700">₹{product.salesPrice}</span>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))
          )}
        </div>
      </Card>
    </main>
    </>
  );
}
