"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { User, UserRole } from "@/types/user";

interface UsersResponse {
  success?: boolean;
  data?: User[];
  error?: string;
}

type UserRoleFilter = "all" | UserRole;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        const response = await fetch("/api/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as UsersResponse;

        if (!response.ok || !payload.success) {
          setUsers([]);
          setError(payload.error ?? "Failed to fetch users");
          return;
        }

        setUsers(Array.isArray(payload.data) ? payload.data : []);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to fetch users";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") {
      return users;
    }

    return users.filter((user) => user.role === roleFilter);
  }, [roleFilter, users]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_15%,#ffd7b2_0%,transparent_34%),radial-gradient(circle_at_82%_10%,#c2efde_0%,transparent_35%),linear-gradient(145deg,#f8f4ed,#eef8f3)] px-6 py-10">
      <section className="mx-auto w-full max-w-6xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.38)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Directory
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Users</h1>
          </div>
          <Link
            href="/people"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Overview
          </Link>
        </div>

        <div className="mb-5 max-w-xs">
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">Role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRoleFilter)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            >
              <option value="all">All</option>
              <option value="internal">Internal</option>
              <option value="portal">Portal</option>
            </select>
          </label>
        </div>

        {isLoading ? <p className="text-sm text-zinc-600">Loading users...</p> : null}
        {error ? <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {!isLoading && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <Link
                  key={user.userId}
                  href={`/users/${user.userId}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                >
                  <p className="text-lg font-semibold text-zinc-900">{user.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
                  <p className="mt-1 text-sm text-zinc-600">{user.mobile}</p>
                  <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {user.role}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-600">No users found.</p>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
