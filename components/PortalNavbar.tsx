"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function PortalNavbar() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsHydrated(true);
    });

    return () => unsubscribe();
  }, []);
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Sign out from Firebase
      await signOut(auth);
      
      // Update state and redirect to login
      setIsLoggedIn(false);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo/Company Name */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
            O
          </div>
          <span className="text-lg font-semibold text-zinc-900">Odoo Shop</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-sm font-medium text-zinc-700 hover:text-emerald-600">
            Home
          </Link>
          <Link href="/shop" className="text-sm font-medium text-zinc-700 hover:text-emerald-600">
            Shop
          </Link>
          <Link href="/my-account" className="text-sm font-medium text-zinc-700 hover:text-emerald-600">
            My Account
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative rounded-lg border border-zinc-200 p-2 text-zinc-700 transition-colors hover:border-emerald-600 hover:text-emerald-600"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M3 4H5L7.2 14.3C7.3 14.8 7.8 15.2 8.3 15.2H17.4C17.9 15.2 18.4 14.9 18.5 14.4L20.2 8.5C20.4 7.9 19.9 7.2 19.2 7.2H6.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9.4" cy="19.1" r="1.4" fill="currentColor" />
              <circle cx="17" cy="19.1" r="1.4" fill="currentColor" />
            </svg>
          </Link>

          {isHydrated && (
            <>
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/signup"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    Sign up
                  </Link>
                  <span className="text-zinc-300">|</span>
                  <Link
                    href="/login"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Login
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
