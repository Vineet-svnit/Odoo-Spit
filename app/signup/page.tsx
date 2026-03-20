"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createUserWithEmailAndPassword, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface SignupFormState {
  name: string;
  email: string;
  password: string;
  mobile: string;
  city: string;
  state: string;
  pincode: string;
}

const INITIAL_STATE: SignupFormState = {
  name: "",
  email: "",
  password: "",
  mobile: "",
  city: "",
  state: "",
  pincode: "",
};

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      if (!PASSWORD_POLICY_REGEX.test(form.password)) {
        setIsError(true);
        setMessage(
          "Password must be at least 8 characters and include lowercase, uppercase, a digit, and a special character",
        );
        setIsSubmitting(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );

      const idToken = await getIdToken(userCredential.user);

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
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

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        setIsError(true);
        setMessage(payload.error ?? "Signup failed");
        return;
      }

      setForm(INITIAL_STATE);
      setMessage("Account created successfully. Redirecting...");
      router.push("/");
    } catch (error) {
      setIsError(true);

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";

      if (errorMessage.includes("email-already-in-use")) {
        setMessage("Email already exists");
      } else if (
        errorMessage.includes("weak-password") ||
        errorMessage.includes("WEAK_PASSWORD")
      ) {
        setMessage(
          "Password is too weak. Include at least 8 characters, lowercase, uppercase, digit, and special character",
        );
      } else {
        setMessage(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#ffd7a8_0%,transparent_35%),radial-gradient(circle_at_80%_10%,#a8e7ff_0%,transparent_32%),linear-gradient(140deg,#f9f6ef,#eef5fb)] px-6 py-14">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-black/10 bg-white/85 p-8 shadow-[0_25px_70px_-35px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Apparel Desk
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
            Create Account
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Fill all details to create your portal account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Mobile</span>
            <input
              required
              value={form.mobile}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mobile: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">City</span>
            <input
              required
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">State</span>
            <input
              required
              value={form.state}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, state: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Pincode</span>
            <input
              required
              value={form.pincode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, pincode: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-sky-500"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:col-span-2"
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        {message ? (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              isError
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-zinc-700">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-sky-700 hover:text-sky-900">
            Login here
          </Link>
        </p>
      </section>
    </main>
  );
}
