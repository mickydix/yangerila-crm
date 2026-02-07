"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  LogOut,
  ShieldCheck,
  Database // <--- Imported Database Icon
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Protect Admin Route
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await signOut(getAuth());
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Enquiries", href: "/admin/enquiries", icon: MessageCircle },
    { name: "Admissions", href: "/admin/admissions", icon: Users },
    { name: "Data", href: "/admin/data", icon: Database }, // <--- NEW OPTION HERE
    { name: "SRM Team", href: "/admin/srms", icon: ShieldCheck }, 
  ];

  if (loading) return null;

  return (
    <div className="flex h-screen bg-[#F5F0EB] text-[#4A4036]">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#FDFDFD] border-r border-[#E8E0D5] flex flex-col fixed inset-y-0 z-50 shadow-sm">
        <div className="p-8 border-b border-[#E8E0D5]">
          <h1 className="text-2xl font-serif font-bold tracking-wide text-[#2D241E]">
            Yangerila
          </h1>
          <p className="text-xs text-[#8C7B6C] font-bold uppercase tracking-widest mt-1">Admin Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 text-sm font-bold rounded-xl transition-all ${
                  isActive 
                    ? "bg-[#2D241E] text-[#F5F0EB] shadow-md" 
                    : "text-[#8C7B6C] hover:bg-[#F5F0EB] hover:text-[#2D241E]"
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-[#E8E0D5]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#D96C6C] hover:bg-[#D96C6C]/10 rounded-xl w-full transition-colors uppercase tracking-wider"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* CONTENT AREA */}
      <main className="flex-1 ml-64 h-full overflow-y-auto p-8">
        {children}
      </main>

    </div>
  );
}