"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Contact } from "@/types/contact";
import type { User } from "@/types/user";
import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";

interface UsersResponse {
  success?: boolean;
  data?: User[];
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
  error?: string;
}

export default function PeoplePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const [usersResponse, contactsResponse] = await Promise.all([
          fetch("/api/users", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/contacts", {
            headers: {
              Authorization: `Bearer ${token}`,
            }
          }),
        ]);

        const usersPayload = (await usersResponse.json()) as UsersResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;

        if (!usersResponse.ok || !usersPayload.success) {
          setError(usersPayload.error ?? "Failed to fetch users");
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setError(contactsPayload.error ?? "Failed to fetch contacts");
          return;
        }

        setUsers(Array.isArray(usersPayload.data) ? usersPayload.data : []);
        setContacts(Array.isArray(contactsPayload.data) ? contactsPayload.data : []);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to fetch data";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);

  const internalUsers = useMemo(
    () => users.filter((user) => user.role === "internal").length,
    [users],
  );
  const portalUsers = useMemo(
    () => users.filter((user) => user.role === "portal").length,
    [users],
  );

  const customerContacts = useMemo(
    () => contacts.filter((contact) => contact.type === "customer" || contact.type === "both").length,
    [contacts],
  );
  const vendorContacts = useMemo(
    () => contacts.filter((contact) => contact.type === "vendor" || contact.type === "both").length,
    [contacts],
  );

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_14%_18%,#ffd9af_0%,transparent_35%),radial-gradient(circle_at_85%_12%,#b7efdb_0%,transparent_36%),linear-gradient(145deg,#f8f4ed,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
            Dashboard
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
            Users and Contacts
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Quick overview by role and contact type.
          </p>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading overview...</p> : null}

        {error ? (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        {!isLoading && !error ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/users"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Users
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Total: {users.length}</h2>
              <p className="mt-3 text-sm text-zinc-700">Internal: {internalUsers}</p>
              <p className="mt-1 text-sm text-zinc-700">Portal: {portalUsers}</p>
            </Link>

            <Link
              href="/contacts"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Contacts
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900">Total: {contacts.length}</h2>
              <p className="mt-3 text-sm text-zinc-700">Customers: {customerContacts}</p>
              <p className="mt-1 text-sm text-zinc-700">Vendors: {vendorContacts}</p>
            </Link>
          </div>
        ) : null}
      </section>
    </main>
    </>
  );
}
