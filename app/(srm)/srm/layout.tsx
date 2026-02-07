"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function SRMLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Protect the route: Bounce them if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) return null; // Or a loading spinner

  // Render ONLY the page content, no header/sidebar
  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {children}
    </div>
  );
}