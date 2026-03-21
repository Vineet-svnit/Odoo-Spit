"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getIdToken, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LoginFormState {
  email: string;
  password: string;
}

const INITIAL_STATE: LoginFormState = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password,
      );
      
      setForm(INITIAL_STATE);
      setMessage("Login successful. Redirecting...");
      
      // Redirect to home after short delay
      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (error) {
      setIsError(true);

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";

      if (errorMessage.includes("invalid-credential")) {
        setMessage("Invalid email or password");
      } else if (errorMessage.includes("user-not-found")) {
        setMessage("Account doesn't exist");
      } else {
        setMessage(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_15%,#f7d8cb_0%,transparent_34%),radial-gradient(circle_at_90%_25%,#c9f0e5_0%,transparent_36%),linear-gradient(120deg,#faf5ef,#f0f7f4)] px-6 py-14">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-black/10 bg-white/85 p-8 shadow-[0_25px_70px_-35px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
            Apparel Desk
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Login with your registered account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isSubmitting ? "Logging in..." : "Login"}
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
          New here?{" "}
          <Link href="/signup" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
