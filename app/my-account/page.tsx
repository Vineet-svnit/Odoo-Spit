"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { User } from "@/types/user";

export default function MyAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        setIsLoading(true);
        const token = await getCurrentIdToken();

        if (!token) {
          router.push("/login");
          return;
        }

        // Fetch current user data
        const response = await fetch("/api/users?current=true", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error("Failed to load user profile");
        }

        const data = await response.json();
        setUser(data.data as User);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, [router]);

  if (isLoading) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-zinc-600">Loading your profile...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-red-600">Error: {error || "User not found"}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PortalNavbar />

      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 text-3xl font-bold text-zinc-900">My Account</h1>

          {/* Profile Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-8 mb-8">
            <div className="mb-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
                {user.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900">{user.email}</h2>
              <p className="text-sm text-zinc-600 mt-1">
                Role: <span className="font-medium capitalize">{user.role}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600 mb-1">Email Address</p>
                <p className="text-lg font-medium text-zinc-900">{user.email}</p>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600 mb-1">Account Status</p>
                <p className="text-lg font-medium text-emerald-600">Active</p>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <p className="text-sm text-zinc-600 mb-1">Member Since</p>
                <p className="text-lg font-medium text-zinc-900">
                  {user.createdAt ? new Date(user.createdAt instanceof Date ? user.createdAt : user.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Orders</h3>
              <p className="text-zinc-600 mb-4">View and manage your orders</p>
              <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                My Orders
              </button>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Addresses</h3>
              <p className="text-zinc-600 mb-4">Manage your delivery addresses</p>
              <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                My Addresses
              </button>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Wishlist</h3>
              <p className="text-zinc-600 mb-4">Your saved items</p>
              <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                My Wishlist
              </button>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Settings</h3>
              <p className="text-zinc-600 mb-4">Update your account preferences</p>
              <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                Account Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
