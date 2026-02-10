"use client";

import { useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  MessageCircle,
  ArrowRight,
  Database,
  LogOut
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";

export default function AdminDashboardPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  // --- 🛡️ THE BOUNCER (Security Check) ---
  useEffect(() => {
    if (loading) return;

    if (!appUser) {
      router.replace("/login");
      return;
    }

    // Convert to uppercase for safety
    const role = appUser.role ? appUser.role.toUpperCase() : "";

    // If logged in as SRM, kick to SRM Dashboard
    if (role === "SRM") {
      router.replace("/srm");
      return;
    }
  }, [appUser, loading, router]);

  const handleLogout = async () => {
      await signOut(getAuth());
      router.push("/login");
  };

  const shortcuts = [
    { 
      name: "Enquiries", 
      href: "/admin/enquiries", 
      icon: MessageCircle, 
      color: "bg-[#C5A880]", 
      desc: "View all leads & conversations" 
    },
    { 
      name: "Archived Data", 
      href: "/admin/data", 
      icon: Database, 
      color: "bg-[#8C7B6C]", 
      desc: "Joined & Closed records" 
    },
    { 
      name: "SRM Team", 
      href: "/admin/srms", 
      icon: Users, 
      color: "bg-[#2D241E]", 
      desc: "Manage staff & performance" 
    },
  ];

  // Prevent flash of content
  if (loading || !appUser) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#8C7B6C] animate-pulse">Loading Admin...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      
      {/* Header with Logout */}
      <div className="mb-12 mt-4 flex justify-between items-start">
        <div>
            <h1 className="text-4xl font-serif font-bold text-[#2D241E]">
                Hello, {appUser?.name?.split(" ")[0] || "Admin"}
            </h1>
            <p className="text-[#8C7B6C] mt-2 text-lg">Here is your overview for today.</p>
        </div>
        <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[#8C7B6C] hover:text-[#D96C6C] transition-colors font-bold text-xs uppercase tracking-wider mt-2"
        >
            <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Quick Stats Row (Placeholders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-[#FDFDFD] p-8 rounded-3xl shadow-sm border border-[#E8E0D5] flex flex-col justify-between h-40">
            <div className="text-xs font-bold text-[#8C7B6C] uppercase tracking-wider">Total Enquiries</div>
            <div className="text-5xl font-serif font-bold text-[#2D241E]">--</div>
        </div>
        <div className="bg-[#FDFDFD] p-8 rounded-3xl shadow-sm border border-[#E8E0D5] flex flex-col justify-between h-40">
            <div className="text-xs font-bold text-[#8C7B6C] uppercase tracking-wider">Active SRMs</div>
            <div className="text-5xl font-serif font-bold text-[#2D241E]">--</div>
        </div>
      </div>

      <h2 className="text-xl font-serif font-bold text-[#2D241E] mb-6 border-b border-[#E8E0D5] pb-4">
          Quick Access
      </h2>
      
      {/* The Icon Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shortcuts.map((item) => (
          <Link 
            key={item.name} 
            href={item.href}
            className="group bg-[#FDFDFD] p-8 rounded-3xl shadow-sm border border-[#E8E0D5] hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-6"
          >
            <div className={`p-4 rounded-2xl text-white shadow-md ${item.color} group-hover:scale-110 transition-transform duration-300`}>
              <item.icon size={32} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#2D241E] group-hover:text-[#C5A880] transition-colors flex items-center gap-2">
                {item.name}
                <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
              </h3>
              <p className="text-sm text-[#8C7B6C] mt-1 font-medium">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}