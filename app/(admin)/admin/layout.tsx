"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  LogOut,
  ShieldCheck,
  Database
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
    { name: "Data", href: "/admin/data", icon: Database }, 
    { name: "SRM Team", href: "/admin/srms", icon: ShieldCheck }, 
  ];

  if (loading) return null;

  return (
    <div className="flex min-h-screen bg-[#F5F0EB] text-[#4A4036]">
      
      {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
      <aside className="hidden md:flex w-64 bg-[#FDFDFD] border-r border-[#E8E0D5] flex-col fixed inset-y-0 z-50 shadow-sm">
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

      {/* --- MOBILE BOTTOM NAV (Visible only on Mobile) --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FDFDFD] border-t border-[#E8E0D5] z-50 px-6 py-3 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {navItems.slice(0, 4).map((item) => { // Show first 4 items only to fit space
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isActive ? "text-[#2D241E]" : "text-[#C5A880]"
                }`}
              >
                <div className={`p-2 rounded-full ${isActive ? "bg-[#2D241E] text-white" : ""}`}>
                    <item.icon size={20} strokeWidth={2} />
                </div>
                {/* Optional: Hide label for cleaner look, or keep it tiny */}
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            );
          })}
          {/* Mobile Sign Out (Small Icon) */}
          <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-[#D96C6C]">
             <div className="p-2"><LogOut size={20} /></div>
             <span className="text-[10px] font-bold">Exit</span>
          </button>
      </div>

      {/* --- CONTENT AREA (Adjusted margins) --- */}
      <main className="flex-1 md:ml-64 w-full h-full p-4 md:p-8 pb-24 md:pb-8">
        {/* Mobile-only Header */}
        <div className="md:hidden mb-6 flex justify-between items-center">
             <h1 className="text-xl font-serif font-bold text-[#2D241E]">Yangerila Admin</h1>
        </div>
        {children}
      </main>

    </div>
  );
}