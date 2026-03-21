"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Product } from "@/types/product";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function loadProduct() {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();
        const response = await fetch(`/api/product/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await response.json();

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.error || "Failed to load product details");
        }

        const fetchedProduct = payload.data as Product;
        setProduct(fetchedProduct);
        setSelectedColor(fetchedProduct.colors[0] || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      loadProduct();
    }
  }, [params.id]);

  const images = useMemo(() => {
    if (!product?.images?.length) {
      return ["__placeholder__"];
    }
    return product.images;
  }, [product]);

  const decQty = () => setQuantity((prev) => Math.max(1, prev - 1));
  const incQty = () => setQuantity((prev) => prev + 1);

  if (isLoading) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-zinc-600">Loading product details...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-red-600">{error || "Product not found"}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PortalNavbar />

      <main className="min-h-screen bg-zinc-50 px-6 py-8">
        <section className="mx-auto max-w-7xl">
          <nav className="mb-6 text-sm text-zinc-600" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/shop" className="hover:text-emerald-600">
                  All Products
                </Link>
              </li>
              <li>/</li>
              <li>{product.productTypeName}</li>
              <li>/</li>
              <li className="font-medium text-zinc-900">{product.productName}</li>
            </ol>
          </nav>

          <div className="grid gap-8 rounded-xl border border-zinc-200 bg-white p-6 md:grid-cols-2 md:p-8">
            <div>
              <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                {images[selectedImage] === "__placeholder__" ? (
                  <div className="flex h-full w-full items-center justify-center text-zinc-500">No image available</div>
                ) : (
                  <img
                    src={images[selectedImage]}
                    alt={product.productName}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {images.map((img, idx) => (
                    <button
                      key={`${img}-${idx}`}
                      onClick={() => setSelectedImage(idx)}
                      className={`aspect-square overflow-hidden rounded-md border ${
                        idx === selectedImage ? "border-emerald-600" : "border-zinc-200"
                      }`}
                      aria-label={`Preview image ${idx + 1}`}
                    >
                      <img src={img} alt={`${product.productName} ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-zinc-900">{product.productName}</h1>
              <p className="mt-3 text-2xl font-semibold text-emerald-600">₹{product.salesPrice.toFixed(2)}</p>

              <div className="mt-6">
                <p className="text-sm font-medium text-zinc-700">Color Selection</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {product.colors.length === 0 && <span className="text-sm text-zinc-500">No colors listed</span>}
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                      aria-label={`Choose color ${color}`}
                      className={`h-8 w-8 rounded-full border-2 ${
                        selectedColor === color ? "border-zinc-900 ring-2 ring-emerald-500 ring-offset-2" : "border-zinc-300"
                      }`}
                      style={{ backgroundColor: color.toLowerCase() }}
                    />
                  ))}
                </div>
                {selectedColor && <p className="mt-2 text-sm text-zinc-600">Selected: {selectedColor}</p>}
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-zinc-700">Quantity</p>
                <div className="mt-3 inline-flex items-center rounded-lg border border-zinc-300">
                  <button onClick={decQty} className="px-4 py-2 text-lg text-zinc-700 hover:bg-zinc-100" aria-label="Decrease quantity">
                    -
                  </button>
                  <span className="min-w-12 px-4 py-2 text-center font-medium text-zinc-900">{quantity}</span>
                  <button onClick={incQty} className="px-4 py-2 text-lg text-zinc-700 hover:bg-zinc-100" aria-label="Increase quantity">
                    +
                  </button>
                </div>
              </div>

              <button
                className="mt-8 w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                disabled={product.currentStock <= 0}
              >
                {product.currentStock > 0 ? "Add to Cart" : "Out of Stock"}
              </button>

              <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-900">Terms and Conditions</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Delivery timelines may vary by location.</li>
                  <li>Products can be returned within 7 days if unused and in original packaging.</li>
                  <li>Color and texture may slightly vary from images shown online.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
