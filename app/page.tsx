"use client";

import Link from "next/link";
import PortalNavbar from "@/components/PortalNavbar";

export default function HomePage() {
  return (
    <>
      <PortalNavbar />

      <main className="app-shell px-6 py-10">
        {/* Hero Section */}
        <section className="flex items-center justify-center px-6 py-20">
          <div className="app-surface mx-auto max-w-4xl text-center p-8">
            <h1 className="text-4xl font-bold text-zinc-900 mb-6">Welcome to Odoo Shop</h1>
            <p className="text-lg text-zinc-600 mb-8">
              Discover a wide range of quality products at the best prices.
            </p>
            <Link
              href="/shop"
              className="gradient-btn inline-block rounded-lg px-8 py-3 text-lg font-semibold transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        </section>

        {/* Featured Categories */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-3xl font-bold text-zinc-900 mb-12 text-center">Featured Categories</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Electronics",
                  description: "Latest gadgets and devices",
                },
                {
                  title: "Fashion",
                  description: "Trending clothing and accessories",
                },
                {
                  title: "Home & Garden",
                  description: "Everything for your home",
                },
              ].map((category) => (
                <Link
                  key={category.title}
                  href="/shop"
                  className="app-surface group rounded-2xl p-8 transition app-surface-hover"
                >
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-zinc-900">{category.title}</h3>
                    <p className="text-zinc-600 text-sm mt-2">{category.description}</p>
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
                <div key={feature.title} className="app-surface rounded-lg p-6 app-surface-hover">
                  <div className="mb-4 text-4xl">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="flex items-center justify-center px-6 py-20">
          <div className="app-surface mx-auto max-w-4xl text-center p-8">
            <h2 className="text-3xl font-bold text-zinc-900 mb-6">Ready to Shop?</h2>
            <p className="text-lg text-zinc-600 mb-8">
              Browse our extensive collection of products now.
            </p>
            <Link
              href="/shop"
              className="gradient-btn inline-block rounded-lg px-8 py-3 text-lg font-semibold transition-colors"
            >
              Explore Products
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
