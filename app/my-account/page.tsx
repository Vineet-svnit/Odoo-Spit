"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { formatFirebaseDate } from "@/lib/firebaseDate";
import { useRequireAuth } from "@/lib/useRequireAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { SaleOrder } from "@/types/saleOrder";
import type { User } from "@/types/user";

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

interface ProfileFormState {
  name: string;
  mobile: string;
  city: string;
  state: string;
  pincode: string;
}

export default function MyAccountPage() {
  const { isLoading: isAuthLoading } = useRequireAuth();

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [form, setForm] = useState<ProfileFormState>({
    name: "",
    mobile: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccountData() {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getCurrentIdToken();

        const [userResponse, ordersResponse, invoicesResponse] = await Promise.all([
          fetch("/api/users?current=true", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/sale-order", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/customer-invoice", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const userPayload = (await userResponse.json()) as ApiResponse<User>;
        const ordersPayload = (await ordersResponse.json()) as ApiResponse<SaleOrder[]>;
        const invoicesPayload = (await invoicesResponse.json()) as ApiResponse<CustomerInvoice[]>;

        if (!userResponse.ok || !userPayload.success || !userPayload.data) {
          throw new Error(userPayload.error ?? "Failed to load profile");
        }

        if (!ordersResponse.ok || !ordersPayload.success) {
          throw new Error(ordersPayload.error ?? "Failed to load orders");
        }

        if (!invoicesResponse.ok || !invoicesPayload.success) {
          throw new Error(invoicesPayload.error ?? "Failed to load invoices");
        }

        const currentUser = userPayload.data;
        setUser(currentUser);
        setOrders(Array.isArray(ordersPayload.data) ? ordersPayload.data : []);
        setInvoices(Array.isArray(invoicesPayload.data) ? invoicesPayload.data : []);

        setForm({
          name: currentUser.name,
          mobile: currentUser.mobile,
          city: currentUser.address.city,
          state: currentUser.address.state,
          pincode: currentUser.address.pincode,
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load account details");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAccountData();
  }, []);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setMessage(null);
      setError(null);

      const token = await getCurrentIdToken();
      const response = await fetch("/api/users?current=true", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          mobile: form.mobile,
          address: {
            city: form.city,
            state: form.state,
            pincode: form.pincode,
          },
        }),
      });

      const payload = (await response.json()) as ApiResponse<User>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Failed to update profile");
      }

      setUser(payload.data);
      setMessage("Profile updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  const unpaidInvoicesCount = useMemo(
    () => invoices.filter((invoice) => invoice.amountDue > 0).length,
    [invoices],
  );

  const latestOrderDate = useMemo(() => {
    if (orders.length === 0) {
      return "-";
    }

    return formatFirebaseDate(orders[0].soDate);
  }, [orders]);

  if (isAuthLoading || isLoading) {
    return (
      <>
        <PortalNavbar />
        <main className="min-h-screen bg-zinc-50 px-6 py-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-zinc-600">Loading your account...</p>
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
          <div className="mx-auto max-w-6xl">
            <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error || "User not found"}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PortalNavbar />
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <section className="mx-auto max-w-6xl">
          <h1 className="mb-6 text-3xl font-bold text-zinc-900">My Account</h1>

          {message ? <p className="mb-4 rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Personal Details */}
            <article className="lg:col-span-1 rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-zinc-900">Personal Details</h2>
              <div className="mt-5 space-y-4">
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Name</span>
                  <p className="text-sm text-zinc-900">{user.name}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Email</span>
                  <p className="text-sm text-zinc-900">{user.email}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Mobile</span>
                  <p className="text-sm text-zinc-900">{user.mobile}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">City</span>
                  <p className="text-sm text-zinc-900">{user.address.city}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">State</span>
                  <p className="text-sm text-zinc-900">{user.address.state}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Pincode</span>
                  <p className="text-sm text-zinc-900">{user.address.pincode}</p>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Role</span>
                  <p className="text-sm capitalize text-zinc-900">{user.role}</p>
                </div>
              </div>
            </article>

            {/* Right: 3 Sections Vertically Stacked */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Update Form */}
              <article className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-zinc-900">Profile Update</h2>
                <p className="mt-1 text-sm text-zinc-600">Edit your personal information.</p>

                <form onSubmit={handleSaveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                      required
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Mobile</span>
                    <input
                      value={form.mobile}
                      onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                      required
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">City</span>
                    <input
                      value={form.city}
                      onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                      required
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">State</span>
                    <input
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                      required
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Pincode</span>
                    <input
                      value={form.pincode}
                      onChange={(event) => setForm((prev) => ({ ...prev, pincode: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="sm:col-span-2 h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-zinc-400"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </article>

              {/* Sale Orders */}
              <article className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-zinc-900">Sale Orders</h2>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Total Orders</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">{orders.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Latest Order</p>
                    <p className="mt-1 text-sm text-zinc-900">{latestOrderDate}</p>
                  </div>
                </div>
                <Link
                  href="/portal/sale-order"
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  View All Orders
                </Link>
              </article>

              {/* Invoices */}
              <article className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h2 className="text-xl font-semibold text-zinc-900">Invoices</h2>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Total Invoices</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">{invoices.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Unpaid</p>
                    <p className="mt-1 text-2xl font-bold text-orange-600">{unpaidInvoicesCount}</p>
                  </div>
                </div>
                <Link
                  href="/portal/invoice"
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  View All Invoices
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
