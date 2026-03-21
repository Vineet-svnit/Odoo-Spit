import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";

import { auth } from "@/lib/firebase";

async function getCurrentUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getCurrentIdToken(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be logged in");
  }

  return user.getIdToken();
}
