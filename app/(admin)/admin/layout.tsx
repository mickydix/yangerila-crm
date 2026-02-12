"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
  // Using the requested background color #F5F0EB
  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {children}
    </div>
  );
}