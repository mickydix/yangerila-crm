"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function RootPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; 

    if (appUser) {
      // Convert role to uppercase to prevent case-sensitive bugs
      const role = appUser.role ? appUser.role.toUpperCase() : "";

      if (role === "ADMIN") {
        router.replace("/admin");
      } else if (role === "SRM") {
        router.replace("/srm");
      } else {
        // Only redirect to login if the role is TRULY unrecognizable
        console.log("Unknown Role detected:", role); 
        router.replace("/login"); 
      }
    } else {
      router.replace("/login");
    }
  }, [appUser, loading, router]);

  // Loading Screen
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