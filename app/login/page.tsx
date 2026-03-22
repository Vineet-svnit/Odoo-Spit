"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getIdToken, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LoginFormState {
  email: string;
  password: string;
}

interface CurrentUserResponse {
  success?: boolean;
  data?: {
    role?: "internal" | "portal";
  };
  error?: string;
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

      const token = await getIdToken(userCredential.user);
      let destination = "/";

      try {
        const userResponse = await fetch("/api/users?current=true", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const userPayload = (await userResponse.json()) as CurrentUserResponse;

        if (userResponse.ok && userPayload.success && userPayload.data?.role === "internal") {
          destination = "/dashboard";
        }
      } catch {
        destination = "/";
      }
      
      setForm(INITIAL_STATE);
      setMessage("Login successful. Redirecting...");
      
      // Redirect after short delay based on user role.
      setTimeout(() => {
        router.push(destination);
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
    <main className="app-shell px-6 py-14">
      <Card className="app-surface mx-auto w-full max-w-xl p-8 md:p-10">
        <CardHeader className="mb-8 p-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Apparel Desk</CardTitle>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">Welcome Back</h1>
          <p className="mt-2 text-sm text-zinc-600">Login with your registered account.</p>
        </CardHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="h-11"
            />
          </Label>
          <Label className="grid gap-1">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <Input
              required
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              className="h-11"
            />
          </Label>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-12 text-sm font-semibold rounded-xl"
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </Button>
        </form>
        {message ? (
          <CardContent className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            isError
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
          }`}>
            {message}
          </CardContent>
        ) : null}
        <CardContent className="mt-6 text-sm text-zinc-700">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Create account
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
