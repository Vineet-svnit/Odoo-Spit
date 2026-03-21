"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";

interface ContactResponse {
  success?: boolean;
  data?: Contact;
  error?: string;
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = typeof params.id === "string" ? params.id : "";

  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContact() {
      if (!contactId) {
        setError("Invalid contact");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const response = await fetch(`/api/contacts/${contactId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as ContactResponse;

        if (!response.ok || !payload.success || !payload.data) {
          setContact(null);
          setError(payload.error ?? "Failed to fetch contact");
          return;
        }

        setContact(payload.data);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to fetch contact";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadContact();
  }, [contactId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#ffd8b6_0%,transparent_33%),radial-gradient(circle_at_86%_12%,#c7efdf_0%,transparent_36%),linear-gradient(145deg,#f9f4ec,#edf7f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
              Contact Details
            </h1>
          </div>
          <Link
            href="/contacts"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Contacts
          </Link>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading contact...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {contact ? (
          <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Name</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{contact.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Type</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{contact.type}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Email</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{contact.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Mobile</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">{contact.mobile}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Address</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {contact.address.city}, {contact.address.state} - {contact.address.pincode}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
