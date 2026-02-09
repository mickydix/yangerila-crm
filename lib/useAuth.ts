import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

export type AppUser = {
  uid: string;
  email: string | null;
  role: string;
  name?: string;
  srmId?: string;
};

// 👇 List of pages where we DOES NOT check for login
const PUBLIC_PATHS = ["/login", "/reset-password", "/setup"];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Fetch the Role and ID from your database
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            setAppUser({ ...userData, uid: firebaseUser.uid });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        // User is logged out
        setUser(null);
        setAppUser(null);

        // 👇 FIX: Only redirect if we are NOT on a public page
        if (!PUBLIC_PATHS.includes(pathname)) {
            router.push("/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  return { user, appUser, loading };
}