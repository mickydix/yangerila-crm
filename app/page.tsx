"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function RootPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait for auth to finish checking

    if (appUser) {
      // 🚦 TRAFFIC CONTROLLER LOGIC
      if (appUser.role === "ADMIN") {
        router.replace("/admin"); // Send Micky to Admin
      } else if (appUser.role === "SRM") {
        router.replace("/srm");   // Send SRMs to SRM
      } else {
        // Fallback for weird roles
        router.replace("/login"); 
      }
    } else {
      // Not logged in? Go to login
      router.replace("/login");
    }
  }, [appUser, loading, router]);

  // While we decide where to send them, show a loading screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium animate-pulse">Routing...</p>
      </div>
    </div>
  );
}