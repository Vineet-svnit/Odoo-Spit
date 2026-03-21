"use client";

import Link from "next/link";
import PortalNavbar from "@/components/PortalNavbar";

export default function HomePage() {
  return (
    <>
      <PortalNavbar />

      <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-zinc-50">
        {/* Hero Section */}
        <section className="flex items-center justify-center px-6 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold text-zinc-900 mb-6">Welcome to Odoo Shop</h1>
            <p className="text-lg text-zinc-600 mb-8">
              Discover a wide range of quality products at the best prices.
            </p>
            <Link
              href="/shop"
              className="inline-block rounded-lg bg-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        </section>

        {/* Featured Categories */}
        <section className="px-6 py-20 bg-white">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-zinc-900 mb-12 text-center">Featured Categories</h2>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Electronics",
                  description: "Latest gadgets and devices",
                  color: "bg-blue-500",
                },
                {
                  title: "Fashion",
                  description: "Trending clothing and accessories",
                  color: "bg-pink-500",
                },
                {
                  title: "Home & Garden",
                  description: "Everything for your home",
                  color: "bg-green-500",
                },
              ].map((category) => (
                <Link
                  key={category.title}
                  href="/shop"
                  className="group rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div
                    className={`${category.color} h-48 flex items-center justify-center group-hover:scale-105 transition-transform`}
                  >
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white">{category.title}</h3>
                      <p className="text-white/90 text-sm mt-2">{category.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-zinc-900 mb-12 text-center">Why Shop With Us</h2>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Quality Products",
                  description: "We offer only the best quality products from trusted vendors.",
                  icon: "✓",
                },
                {
                  title: "Best Prices",
                  description: "Competitive pricing with frequent discounts and offers.",
                  icon: "₹",
                },
                {
                  title: "Fast Delivery",
                  description: "Quick and reliable delivery to your doorstep.",
                  icon: "📦",
                },
              ].map((feature) => (
                <div key={feature.title} className="rounded-lg border border-zinc-200 bg-white p-6">
                  <div className="mb-4 text-4xl">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-20 bg-emerald-600">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to Shop?</h2>
            <p className="text-lg text-emerald-50 mb-8">
              Browse our extensive collection of products now.
            </p>
            <Link
              href="/shop"
              className="inline-block rounded-lg bg-white px-8 py-3 text-lg font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Explore Products
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
