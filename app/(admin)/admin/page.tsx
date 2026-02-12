"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  MessageCircle, 
  UserPlus, 
  Database, 
  Users,
  LogOut,
  Bell
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { db } from "@/lib/firebase";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from "firebase/firestore";

export default function AdminDashboardPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  
  // State to track if there are unread notifications
  const [hasUnread, setHasUnread] = useState(false);

  // --- 🛡️ THE BOUNCER (Security Check) ---
  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
    const role = appUser.role ? appUser.role.toUpperCase() : "";
    if (role === "SRM") {
      router.replace("/srm");
      return;
    }
  }, [appUser, loading, router]);

  // --- 🔔 REAL-TIME UNREAD CHECK ---
  useEffect(() => {
    if (!appUser) return;

    // Query for any notification where read is explicitly false
    const q = query(
      collection(db, "admin_notifications"), 
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If the size of the snapshot is greater than 0, we have unread messages
      setHasUnread(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [appUser]);

  const handleLogout = async () => {
    await signOut(getAuth());
    router.push("/login");
  };

  const menuItems = [
    { label: "Enquiries", icon: MessageCircle, href: "/admin/enquiries" },
    { label: "Admission", icon: UserPlus, href: "/admin/admissions" },
    { label: "Data", icon: Database, href: "/admin/data" },
    { label: "SRM", icon: Users, href: "/admin/srms" },
  ];

  if (loading || !appUser) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#8C7B6C] animate-pulse">Loading Admin...</div>;
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="mt-4 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif font-bold text-[#2D241E]">
            Hello, {appUser?.name?.split(" ")[0] || "Admin"}
          </h2>
          <p className="text-[#8C7B6C] mt-1">Management Portal Overview</p>
        </div>
        
        <div className="flex items-center gap-6 mb-1">
            {/* Notification Bell Link */}
            <Link 
                href="/admin/notifications" 
                className="p-2 text-[#8C7B6C] hover:text-[#C5A880] transition-colors relative group"
            >
                <Bell size={26} className="group-hover:scale-110 transition-transform" />
                
                {/* 🔴 RED MARKER */}
                {hasUnread && (
                  <span className="absolute top-1.5 right-2 w-3 h-3 bg-red-500 border-2 border-[#F5F0EB] rounded-full animate-pulse shadow-sm" />
                )}
            </Link>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-[#8C7B6C] hover:text-[#D96C6C] transition-colors font-bold text-xs uppercase tracking-wider"
            >
              <LogOut size={16} /> Sign Out
            </button>
        </div>
      </div>

      {/* 4-Tile Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        {menuItems.map((item, idx) => (
          <Link key={idx} href={item.href} className="w-full block">
            <div className="bg-[#C5A880] hover:bg-[#B89A72] active:scale-95 transition-all duration-300 aspect-square rounded-sm shadow-sm flex flex-col items-center justify-center gap-3 relative group cursor-pointer">
              <div className="text-white opacity-90 group-hover:scale-110 transition-transform duration-300">
                <item.icon size={32} strokeWidth={1.5} />
              </div>
              <span className="text-white font-medium text-lg tracking-wide drop-shadow-sm">{item.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}