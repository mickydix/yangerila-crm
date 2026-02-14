"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  MessageCircle, 
  UserPlus, 
  Database, 
  Users,
  LogOut,
  Bell,
  CalendarDays,
  X
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { db } from "@/lib/firebase";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { 
    collection, 
    query, 
    where, 
    onSnapshot,
    doc 
} from "firebase/firestore";
import { format, isAfter, startOfToday } from "date-fns";
// Import your component here
import EnquiryActionCard from "@/components/EnquiryActionCard"; 

// --- Types for Demo Tracking ---
type StudentInfo = {
    id: string;
    name: string;
};

type DemoSlot = {
    date: Date;
    students: StudentInfo[];
};

type Enquiry = {
  id: string;
  enqId: string;
  name: string;
  phone: string;
  status: "CALL_AGAIN" | "READY_DEMO" | "DEMO_TAKEN" | "READY_ADMISSION" | "NOT_JOINING" | "JOINED";
  createdAt: any; 
  lastAction: string;
  lastActionDate: any;
  lastRemark: string;
  nextAction: string;
  nextActionDate: any;
  linkSent?: boolean;
  srmName?: string; 
  srmId?: string;
};

export default function AdminDashboardPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  
  // UI State
  const [hasUnread, setHasUnread] = useState(false);
  const [upcomingDemos, setUpcomingDemos] = useState<DemoSlot[]>([]);
  
  // States for the Action Card Modal
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);
  const [selectedEnquiryData, setSelectedEnquiryData] = useState<Enquiry | null>(null);

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

    const q = query(
      collection(db, "admin_notifications"), 
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnread(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [appUser]);

  // --- 📅 REAL-TIME UPCOMING DEMOS FETCH ---
  useEffect(() => {
    if (!appUser) return;

    const q = query(
        collection(db, "enquiries"),
        where("status", "==", "READY_DEMO")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const demoGroups: { [key: string]: DemoSlot } = {};
        const today = startOfToday();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.nextActionDate) {
                const dateObj = data.nextActionDate.toDate();
                
                if (isAfter(dateObj, today) || format(dateObj, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
                    const slotKey = format(dateObj, "yyyy-MM-dd-HH:mm");

                    if (!demoGroups[slotKey]) {
                        demoGroups[slotKey] = { date: dateObj, students: [] };
                    }
                    
                    if (!demoGroups[slotKey].students.some(s => s.id === doc.id)) {
                        demoGroups[slotKey].students.push({
                            id: doc.id,
                            name: data.name
                        });
                    }
                }
            }
        });

        const sortedSlots = Object.values(demoGroups).sort((a, b) => 
            a.date.getTime() - b.date.getTime()
        );

        setUpcomingDemos(sortedSlots);
    });

    return () => unsubscribe();
  }, [appUser]);

  // --- 🗂️ FETCH SINGLE ENQUIRY DATA WHEN CLICKED ---
  useEffect(() => {
    if (!selectedEnquiryId) {
        setSelectedEnquiryData(null);
        return;
    }

    const unsub = onSnapshot(doc(db, "enquiries", selectedEnquiryId), (docSnap) => {
        if (docSnap.exists()) {
            setSelectedEnquiryData({ id: docSnap.id, ...docSnap.data() } as Enquiry);
        }
    });

    return () => unsub();
  }, [selectedEnquiryId]);

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
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto space-y-8 relative">
      
      {/* Header */}
      <div className="mt-4 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif font-bold text-[#2D241E]">
            Hello, {appUser?.name?.split(" ")[0] || "Admin"}
          </h2>
          <p className="text-[#8C7B6C] mt-1">Management Portal Overview</p>
        </div>
        
        <div className="flex items-center gap-6 mb-1">
            <Link 
                href="/admin/notifications" 
                className="p-2 text-[#8C7B6C] hover:text-[#C5A880] transition-colors relative group"
            >
                <Bell size={26} className="group-hover:scale-110 transition-transform" />
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

      {/* --- 📅 UPCOMING DEMOS SECTION --- */}
      <div className="bg-[#F9F7F5] border border-[#E8E0D5] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
              <CalendarDays size={22} className="text-[#C5A880]" />
              <h3 className="font-serif font-bold text-[#2D241E] text-xl tracking-tight">Upcoming Demo Classes</h3>
          </div>

          {upcomingDemos.length === 0 ? (
              <p className="text-md text-[#8C7B6C] italic py-2">No upcoming demos scheduled.</p>
          ) : (
              <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                  {upcomingDemos.map((slot, idx) => {
                      const hasNoTime = slot.date.getHours() === 0 && slot.date.getMinutes() === 0;
                      
                      return (
                        <div 
                            key={idx} 
                            className="flex-shrink-0 w-60 bg-[#C5A880] rounded-sm p-5 shadow-md border-b-4 border-[#B89A72] transition-all hover:translate-y-[-2px]"
                        >
                            <div className="flex flex-col border-b border-white/20 pb-3 mb-3">
                                <span className="text-xs font-black text-white/90 uppercase tracking-[0.1em]">
                                    {format(slot.date, "EEEE")}
                                </span>
                                <span className="text-sm font-bold text-white/80 uppercase mt-0.5">
                                    {format(slot.date, "dd MMM yyyy")}
                                </span>
                                <span className="text-2xl font-serif font-bold text-white mt-2 leading-none">
                                    {hasNoTime ? "Time TBD" : format(slot.date, "h:mm a")}
                                </span>
                            </div>
                            <div className="space-y-2.5">
                                {slot.students.map((student, sIdx) => (
                                    <button 
                                        key={sIdx} 
                                        onClick={() => setSelectedEnquiryId(student.id)}
                                        className="w-full text-left text-md font-bold text-white flex items-center gap-2 group/btn hover:bg-white/10 p-1 rounded transition-colors"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover/btn:bg-white transition-colors" />
                                        <span className="underline decoration-white/30 underline-offset-4 group-hover/btn:decoration-white">
                                            {student.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                      );
                  })}
              </div>
          )}
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

      {/* --- 🗂️ ENQUIRY ACTION CARD MODAL --- */}
      {selectedEnquiryData && (
          <EnquiryActionCard 
            enquiry={selectedEnquiryData} 
            onClose={() => setSelectedEnquiryId(null)} 
            onUpdate={() => setSelectedEnquiryId(null)} 
          />
      )}
    </div>
  );
}