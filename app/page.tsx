"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function RootPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    // 1. Wait for Auth to initialize
    if (loading) return; 

    // 2. If NOT logged in, send to Login
    if (!appUser) {
      router.replace("/login");
      return;
    }

    // 3. If Logged in, check Role
    const role = appUser.role ? appUser.role.toUpperCase() : "";

    if (role === "ADMIN") {
      router.replace("/admin");
    } else if (role === "SRM") {
      router.replace("/srm");
    } else {
      // 🛑 STOP THE LOOP: If role is missing/weird, DO NOT redirect to login.
      // Show an error message on screen so we know what's wrong.
      console.error("Routing Error: User logged in but role is unknown:", role);
      setError(`Access Denied. Your account role is: "${role || 'Missing'}". Please contact support.`);
    }
  }, [appUser, loading, router]);

  // --- Error State (Stops the Loop) ---
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="text-red-600 text-xl font-bold mb-2">Login Error</div>
        <p className="text-gray-600 text-center">{error}</p>
        <button 
            onClick={() => router.replace("/login")}
            className="mt-6 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
        >
            Force Logout / Try Again
        </button>
      </div>
    );
  }

  // --- Loading State ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#C5A880] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#8C7B6C] font-serif font-bold animate-pulse">
            Yangerila CRM
        </p>
      </div>
    </div>
  );
}