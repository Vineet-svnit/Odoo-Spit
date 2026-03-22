"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Product } from "@/types/product";

interface Filters {
  category: string;
  type: string;
  material: string;
  color: string;
  priceRange: [number, number];
  searchQuery: string;
  sortBy: "price-asc" | "price-desc";
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter options
  const [categories, setCategories] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(0);

  // Filters state
  const [filters, setFilters] = useState<Filters>({
    category: "",
    type: "",
    material: "",
    color: "",
    priceRange: [0, 0],
    searchQuery: "",
    sortBy: "price-asc",
  });

  // Search autocomplete suggestions
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch products
  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        const token = await getCurrentIdToken();

        const response = await fetch("/api/product", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        const productList = (data.data || []) as Product[];

        // Filter only published products
        const publishedProducts = productList.filter((p) => p.published);
        setProducts(publishedProducts);

        // Extract filter options
        const uniqueCategories = [...new Set(publishedProducts.map((p) => p.productCategoryName))].sort();
        const uniqueTypes = [...new Set(publishedProducts.map((p) => p.productTypeName))].sort();
        const uniqueMaterials = [...new Set(publishedProducts.map((p) => p.materialName))].sort();
        const uniqueColors = [...new Set(publishedProducts.flatMap((p) => p.colors))].sort();
        const maxPriceValue = Math.max(...publishedProducts.map((p) => p.salesPrice));

        setCategories(uniqueCategories);
        setTypes(uniqueTypes);
        setMaterials(uniqueMaterials);
        setColors(uniqueColors);
        setMaxPrice(maxPriceValue);

        setFilters((prev) => ({
          ...prev,
          priceRange: [0, maxPriceValue],
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setIsLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Generate search suggestions
  const generateSuggestions = (query: string) => {
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const suggestions = [
      ...new Set(
        products
          .map((p) => p.productName)
          .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      ),
    ]
      .slice(0, 5)
      .sort();

    setSearchSuggestions(suggestions);
  };

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = products;

    // Apply filters
    if (filters.category) {
      result = result.filter((p) => p.productCategoryName === filters.category);
    }
    if (filters.type) {
      result = result.filter((p) => p.productTypeName === filters.type);
    }
    if (filters.material) {
      result = result.filter((p) => p.materialName === filters.material);
    }
    if (filters.color) {
      result = result.filter((p) => p.colors.includes(filters.color));
    }

    // Price range filter
    result = result.filter(
      (p) => p.salesPrice >= filters.priceRange[0] && p.salesPrice <= filters.priceRange[1]
    );

    // Search filter
    if (filters.searchQuery) {
      result = result.filter((p) =>
        p.productName.toLowerCase().includes(filters.searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    if (filters.sortBy === "price-asc") {
      result = result.sort((a, b) => a.salesPrice - b.salesPrice);
    } else if (filters.sortBy === "price-desc") {
      result = result.sort((a, b) => b.salesPrice - a.salesPrice);
    }

    return result;
  }, [products, filters]);

  if (isLoading) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen app-shell px-6 py-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-zinc-600">Loading products...</p>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen app-shell px-6 py-10">
          <div className="mx-auto max-w-7xl">
            <p className="text-center text-red-600">Error: {error}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PortalNavbar />

      {/* Type Sub-navbar */}
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex gap-4 overflow-x-auto pb-2">
            <button
              onClick={() => setFilters({ ...filters, type: "" })}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                filters.type === ""
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All
            </button>
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setFilters({ ...filters, type })}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  filters.type === type
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="min-h-screen app-shell px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-6 lg:flex-row">
            {/* Left Sidebar - Filters */}
            <aside className="lg:w-64">
              <div className="app-surface rounded-lg border border-zinc-200 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>

                {/* Search Bar */}
                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={filters.searchQuery}
                    onChange={(e) => {
                      setFilters({ ...filters, searchQuery: e.target.value });
                      generateSuggestions(e.target.value);
                      setShowSuggestions(true);
                    }}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />

                  {/* Autocomplete Suggestions */}
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg z-50">
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setFilters({ ...filters, searchQuery: suggestion });
                            setShowSuggestions(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Category</label>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="category"
                          value={category}
                          checked={filters.category === category}
                          onChange={(e) =>
                            setFilters({ ...filters, category: e.target.value })
                          }
                          className="rounded border-zinc-300"
                        />
                        <span className="text-sm text-zinc-700">{category}</span>
                      </label>
                    ))}
                    {filters.category && (
                      <button
                        onClick={() => setFilters({ ...filters, category: "" })}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Material Filter */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Material</label>
                  <select
                    value={filters.material}
                    onChange={(e) => setFilters({ ...filters, material: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">All Materials</option>
                    {materials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color Filter */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFilters({ ...filters, color: color === filters.color ? "" : color })}
                        title={color}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          filters.color === color ? "border-zinc-900 ring-2 ring-offset-2 ring-emerald-600" : "border-zinc-300"
                        }`}
                        style={{ backgroundColor: color.toLowerCase() }}
                      />
                    ))}
                  </div>
                </div>

                {/* Price Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Price Range</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max={maxPrice}
                        value={filters.priceRange[0]}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            priceRange: [Number(e.target.value), filters.priceRange[1]],
                          })
                        }
                        placeholder="Min"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <input
                        type="number"
                        min="0"
                        max={maxPrice}
                        value={filters.priceRange[1]}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            priceRange: [filters.priceRange[0], Number(e.target.value)],
                          })
                        }
                        placeholder="Max"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={maxPrice}
                      value={filters.priceRange[1]}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          priceRange: [filters.priceRange[0], Number(e.target.value)],
                        })
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-zinc-600">
                      ₹{filters.priceRange[0]} - ₹{filters.priceRange[1]}
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Content - Products */}
            <div className="flex-1">
              {/* Sort Options */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-zinc-600">
                  Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
                </p>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      sortBy: e.target.value as "price-asc" | "price-desc",
                    })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>

              {/* Products Grid */}
              {filteredProducts.length === 0 ? (
                <div className="app-surface rounded-lg border border-zinc-200 p-12 text-center">
                  <p className="text-zinc-600">No products found matching your filters.</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <Link
                      key={product.productId}
                      href={`/shop/${product.productId}`}
                      className="app-surface block rounded-lg border border-zinc-200 overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {/* Product Image */}
                      <div className="aspect-square bg-zinc-100 overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400">
                            No image
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-4">
                        <p className="text-xs text-zinc-600 mb-1">{product.productCategoryName}</p>
                        <h3 className="font-semibold text-zinc-900 mb-2 line-clamp-2">
                          {product.productName}
                        </h3>

                        {/* Product Type */}
                        <p className="text-xs text-zinc-600 mb-2">{product.productTypeName}</p>

                        {/* Colors */}
                        {product.colors.length > 0 && (
                          <div className="flex gap-1 mb-3">
                            {product.colors.slice(0, 3).map((color) => (
                              <div
                                key={color}
                                className="w-4 h-4 rounded-full border border-zinc-300"
                                style={{ backgroundColor: color.toLowerCase() }}
                                title={color}
                              />
                            ))}
                            {product.colors.length > 3 && (
                              <div className="text-xs text-zinc-600">+{product.colors.length - 3}</div>
                            )}
                          </div>
                        )}

                        {/* Price and Stock */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-emerald-600">
                              ₹{product.salesPrice.toFixed(2)}
                            </p>
                            <p className="text-xs text-zinc-600">
                              Stock: {product.currentStock > 0 ? product.currentStock : "Out"}
                            </p>
                          </div>
                          <span className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
                            View
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
