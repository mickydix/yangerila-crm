"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Plus, 
  Layers, 
  FileText, 
  Database, 
  X, 
  Save, 
  AlertCircle,
  LogOut,
  Bell,
  CalendarDays,
  RefreshCcw
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    doc,
    Timestamp, 
    query, 
    where, 
    onSnapshot,
    getCountFromServer,
    writeBatch
} from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { format, isAfter, startOfToday } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard";

// --- Constants ---
const SOURCES = ["Instagram", "Facebook", "Referral", "Google", "Walk-in", "Justdial", "Other"];
const ACTIONS = ["Called", "Sent Message"];
const STATUSES = [
    { label: "Follow Up", value: "CALL_AGAIN" },
    { label: "Ready for Demo", value: "READY_DEMO" },
];

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

export default function SRMDashboard() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelStage, setCancelStage] = useState<0 | 1>(0);
  const [hasUnread, setHasUnread] = useState(false);
  
  // Demo States
  const [upcomingDemos, setUpcomingDemos] = useState<DemoSlot[]>([]);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);
  const [selectedEnquiryData, setSelectedEnquiryData] = useState<Enquiry | null>(null);

  // Form State
  const initialForm = {
      name: "",
      phone: "",
      source: SOURCES[0],
      action: "Called",
      remark: "",
      status: "CALL_AGAIN",
      nextAction: "Call back",
      nextActionDate: "",
      nextActionTime: "" 
  };
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (form.status === "READY_DEMO") {
        setForm(prev => ({ ...prev, nextAction: "Demo class date" }));
    } else {
        setForm(prev => ({ ...prev, nextAction: "Call back" }));
    }
  }, [form.status]);

  // --- 🛡️ THE BOUNCER ---
  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
    if (appUser.role === "ADMIN") {
      router.replace("/admin"); 
      return;
    }
  }, [appUser, loading, router]);

  // --- 🔔 REAL-TIME UNREAD CHECK ---
  useEffect(() => {
    if (!appUser?.srmId) return;
    const q = query(
      collection(db, "srm_notifications"),
      where("srmId", "==", appUser.srmId),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnread(!snapshot.empty);
    });
    return () => unsubscribe();
  }, [appUser]);

  // --- 📅 REAL-TIME UPCOMING DEMOS FETCH (SRM SPECIFIC) ---
  useEffect(() => {
    if (!appUser?.srmId) return;

    const q = query(
        collection(db, "enquiries"),
        where("srmId", "==", appUser.srmId),
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
                        demoGroups[slotKey].students.push({ id: doc.id, name: data.name });
                    }
                }
            }
        });

        const sortedSlots = Object.values(demoGroups).sort((a, b) => a.date.getTime() - b.date.getTime());
        setUpcomingDemos(sortedSlots);
    });

    return () => unsubscribe();
  }, [appUser]);

  // --- 🗂️ FETCH SINGLE ENQUIRY DATA ---
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

  const handleSaveEnquiry = async () => {
      if (!form.name || !form.phone || !form.nextActionDate) return alert("Please fill Name, Phone and Next Action Date.");
      setSaving(true);
      try {
          const now = new Date();
          const yearLastDigit = now.getFullYear().toString().slice(-1);
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const startOfDay = new Date(now.setHours(0, 0, 0, 0));
          const endOfDay = new Date(now.setHours(23, 59, 59, 999));
          const q = query(collection(db, "enquiries"), where("createdAt", ">=", Timestamp.fromDate(startOfDay)), where("createdAt", "<=", Timestamp.fromDate(endOfDay)));
          const snap = await getCountFromServer(q);
          const enqId = `Q${yearLastDigit}${month}${day}${String.fromCharCode(97 + snap.data().count)}`;

          let combinedDate = new Date(form.nextActionDate);
          if (form.nextActionTime) {
              const [h, m] = form.nextActionTime.split(":").map(Number);
              combinedDate.setHours(h, m);
          }

          const batch = writeBatch(db);
          const newEnqRef = doc(collection(db, "enquiries"));
          const parentData = {
              ...form,
              enqId,
              nextActionDate: Timestamp.fromDate(combinedDate),
              srmId: appUser?.srmId || "Unknown",
              srmName: appUser?.name || "Unknown",
              createdAt: Timestamp.now(),
              lastActionDate: null,
              lastRemark: form.remark
          };

          batch.set(newEnqRef, parentData);
          const timelineRef = doc(collection(db, "enquiries", newEnqRef.id, "timeline"));
          batch.set(timelineRef, { action: form.action, remark: form.remark, date: Timestamp.now(), status: form.status, by: appUser?.name || "SRM" });
          
          await batch.commit();
          setIsModalOpen(false);
          setForm(initialForm);
      } catch (e) { alert("Failed to save enquiry."); } finally { setSaving(false); }
  };

  const menuItems = [
      { label: "Add Enquiry", icon: Plus, onClick: () => setIsModalOpen(true) },
      { label: "Cards", icon: Layers, href: "/srm/cards" },
      { label: "Enquiries", icon: FileText, href: "/srm/enquiries" },
      { label: "Data", icon: Database, href: "/srm/data" },
  ];

  if (loading || !appUser || appUser.role === "ADMIN") {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#8C7B6C] animate-pulse">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto space-y-10 relative">
        
        {/* Header */}
        <div className="mt-4 flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-serif font-bold text-[#2D241E]">
                    Welcome back, {appUser?.name?.split(" ")[0]}
                </h2>
                <p className="text-[#8C7B6C] mt-1">Ready to connect with your students today?</p>
            </div>
            
            <div className="flex items-center gap-6 mb-1">
                <Link href="/srm/notifications" className="p-2 text-[#8C7B6C] hover:text-[#C5A880] transition-colors relative group">
                    <Bell size={24} className="group-hover:scale-110 transition-transform" />
                    {hasUnread && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-[#F5F0EB] rounded-full animate-pulse shadow-sm" />}
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 text-[#8C7B6C] hover:text-[#D96C6C] transition-colors font-bold text-xs uppercase tracking-wider">
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </div>

        {/* --- 📅 UPCOMING DEMOS SECTION --- */}
        <div className="bg-[#F9F7F5] border border-[#E8E0D5] rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
                <CalendarDays size={22} className="text-[#C5A880]" />
                <h3 className="font-serif font-bold text-[#2D241E] text-lg md:text-xl tracking-tight">Upcoming Demo Classes</h3>
            </div>

            {upcomingDemos.length === 0 ? (
                <p className="text-md text-[#8C7B6C] italic py-2">No upcoming demos scheduled.</p>
            ) : (
                <div className="relative">
                    <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4 md:px-0 scroll-smooth">
                        {upcomingDemos.map((slot, idx) => {
                            const hasNoTime = slot.date.getHours() === 0 && slot.date.getMinutes() === 0;
                            return (
                                <div key={idx} className="flex-shrink-0 w-[85%] xs:w-[75%] md:w-60 bg-[#C5A880] rounded-sm p-5 shadow-md border-b-4 border-[#B89A72] transition-all snap-center relative">
                                    <div className="flex flex-col border-b border-white/20 pb-3 mb-3">
                                        <span className="text-xs font-black text-white/90 uppercase tracking-[0.1em]">{format(slot.date, "EEEE")}</span>
                                        <span className="text-sm font-bold text-white/80 uppercase mt-0.5">{format(slot.date, "dd MMM yyyy")}</span>
                                        <span className="text-2xl font-serif font-bold text-white mt-2 leading-none">{hasNoTime ? "Time TBD" : format(slot.date, "h:mm a")}</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        {slot.students.map((student, sIdx) => (
                                            <button key={sIdx} onClick={() => setSelectedEnquiryId(student.id)} className="w-full text-left text-md font-bold text-white flex items-center gap-2 group/btn hover:bg-white/10 p-1 rounded transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover/btn:bg-white transition-colors" />
                                                <span className="underline decoration-white/30 underline-offset-4 group-hover/btn:decoration-white">{student.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {menuItems.map((item, idx) => {
                const CardContent = (
                    <div className="bg-[#C5A880] hover:bg-[#B89A72] active:scale-95 transition-all duration-300 aspect-square rounded-sm shadow-sm flex flex-col items-center justify-center gap-3 relative group cursor-pointer">
                        <div className="text-white opacity-90 group-hover:scale-110 transition-transform duration-300"><item.icon size={32} strokeWidth={1.5} /></div>
                        <span className="text-white font-medium text-lg tracking-wide drop-shadow-sm">{item.label}</span>
                    </div>
                );
                return item.onClick ? (
                    <button key={idx} onClick={item.onClick} className="w-full text-left">{CardContent}</button>
                ) : (
                    <Link key={idx} href={item.href!} className="w-full block">{CardContent}</Link>
                );
            })}
        </div>

        {/* --- 🗂️ ENQUIRY ACTION CARD MODAL --- */}
        {selectedEnquiryData && (
            <EnquiryActionCard 
                enquiry={selectedEnquiryData} 
                onClose={() => setSelectedEnquiryId(null)} 
                onUpdate={() => setSelectedEnquiryId(null)} 
            />
        )}

        {/* Modal for New Enquiry */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-[#FDFDFD] w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                        <h2 className="text-xl font-serif font-bold text-[#2D241E]">New Enquiry</h2>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F5F0EB] text-[#8C7B6C] rounded-full transition-colors"><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-6 overflow-y-auto">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Student Name</label>
                                <input className="w-full border-b border-[#E8E0D5] p-2 outline-none font-serif font-medium text-[#2D241E] focus:border-[#C5A880] transition-colors text-lg bg-transparent placeholder:text-[#E8E0D5]" placeholder="e.g. Rahul Sharma" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Phone</label>
                                    <input className="w-full border-b border-[#E8E0D5] p-2 outline-none font-medium text-[#4A4036] focus:border-[#C5A880] transition-colors bg-transparent placeholder:text-[#E8E0D5]" placeholder="98765..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Source</label>
                                    <select className="w-full border-b border-[#E8E0D5] p-2 outline-none bg-transparent font-medium text-[#4A4036] focus:border-[#C5A880]" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="bg-[#F5F0EB] p-5 rounded-2xl space-y-4 border border-[#E8E0D5]">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Action Taken</label>
                                    <select className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-[#FDFDFD] text-[#2D241E] focus:border-[#C5A880]" value={form.action} onChange={e => setForm({...form, action: e.target.value})}>
                                        {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Current Status</label>
                                    <select className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-[#FDFDFD] text-[#2D241E] focus:border-[#C5A880]" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <textarea className="w-full p-3 rounded-xl border border-[#E8E0D5] outline-none text-sm resize-none h-24 bg-[#FDFDFD] text-[#4A4036] focus:border-[#C5A880]" placeholder="Conversation details..." value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} />
                        </div>
                        <div className="space-y-3 p-4 rounded-xl border bg-white border-[#E8E0D5]">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#8C7B6C] uppercase tracking-wider opacity-80"><CalendarDays size={14} /><span>Next Step Planning</span></div>
                            {form.status === "READY_DEMO" ? (
                                <div className="space-y-3">
                                    <div className="text-sm font-bold text-[#4A4036]">Demo class date and time</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="date" value={form.nextActionDate} onChange={e => setForm({...form, nextActionDate: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                                        <input type="time" value={form.nextActionTime} onChange={e => setForm({...form, nextActionTime: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 items-center">
                                    <div className="p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036]/50 italic">Call back</div>
                                    <input type="date" value={form.nextActionDate} onChange={e => setForm({...form, nextActionDate: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3 pt-4 border-t border-[#E8E0D5] shrink-0 p-6 bg-white">
                        <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-sm font-bold rounded-xl text-[#8C7B6C] hover:bg-[#F5F0EB]">Cancel</button>
                        <button onClick={handleSaveEnquiry} disabled={saving} className="flex-[2] py-3 text-sm font-bold text-white bg-[#C5A880] rounded-xl hover:bg-[#B89A72] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{saving ? "Saving..." : <><Save size={18} /> Save Enquiry</>}</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}