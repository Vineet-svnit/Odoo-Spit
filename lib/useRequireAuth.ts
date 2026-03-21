import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface UseRequireAuthResult {
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Hook to protect pages that require authentication.
 * Redirects to login if user is not authenticated.
 * Returns object with isAuthenticated and isLoading states.
 * 
 * Uses Firebase auth state directly (like internal users).
 */
export function useRequireAuth(): UseRequireAuthResult {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
        // Redirect to login if not authenticated
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return { isAuthenticated, isLoading };
}
