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
  LogOut
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    doc,
    Timestamp, 
    query, 
    where, 
    getCountFromServer,
    writeBatch
} from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";
import { getAuth, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

// --- Constants ---
const SOURCES = ["Instagram", "Facebook", "Referral", "Google", "Walk-in", "Justdial", "Other"];
const ACTIONS = ["Called", "Sent Message"];
const STATUSES = [
    { label: "Follow Up", value: "CALL_AGAIN" },
    { label: "Ready for Demo", value: "READY_DEMO" },
    { label: "Demo Taken", value: "DEMO_TAKEN" },
    { label: "Ready for Admission", value: "READY_ADMISSION" },
    { label: "Not Joining", value: "NOT_JOINING" },
];

export default function SRMDashboard() {
  const { appUser, loading } = useAuth(); // Added loading
  const router = useRouter();
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelStage, setCancelStage] = useState<0 | 1>(0);

  // Form State
  const initialForm = {
      name: "",
      phone: "",
      source: SOURCES[0],
      action: "Called",
      remark: "",
      status: "CALL_AGAIN",
      nextAction: "",
      nextActionDate: ""
  };
  const [form, setForm] = useState(initialForm);

  // --- 🛡️ THE BOUNCER (Security Check) ---
  useEffect(() => {
    if (loading) return;

    // 1. If not logged in, kick to login
    if (!appUser) {
      router.replace("/login");
      return;
    }

    // 2. If logged in as ADMIN, kick to Admin Dashboard
    if (appUser.role === "ADMIN") {
      router.replace("/admin"); 
      return;
    }
  }, [appUser, loading, router]);

  // --- Handlers ---

  const handleLogout = async () => {
      await signOut(getAuth());
      router.push("/login");
  };

  const handleCancel = () => {
      if (cancelStage === 0) {
          setCancelStage(1);
      } else {
          setIsModalOpen(false);
          setForm(initialForm);
          setCancelStage(0);
      }
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
          
          // Generate Q-ID based on today's count
          const q = query(
              collection(db, "enquiries"),
              where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
              where("createdAt", "<=", Timestamp.fromDate(endOfDay))
          );
          
          const snapshot = await getCountFromServer(q);
          const count = snapshot.data().count; 
          const suffix = String.fromCharCode(97 + count); 
          const enqId = `Q${yearLastDigit}${month}${day}${suffix}`;

          const batch = writeBatch(db);
          const newEnqRef = doc(collection(db, "enquiries"));
          
          const parentData = {
              name: form.name,
              phone: form.phone,
              source: form.source,
              enqId: enqId,
              status: form.status,
              lastAction: form.action,
              // --- CHANGE HERE: Set to null so it shows up in "Cards" today ---
              lastActionDate: null, 
              lastRemark: form.remark,
              nextAction: form.nextAction || "Follow up",
              nextActionDate: Timestamp.fromDate(new Date(form.nextActionDate)),
              srmId: appUser?.srmId || "Unknown",
              srmName: appUser?.name || "Unknown",
              createdAt: Timestamp.now(),
          };

          batch.set(newEnqRef, parentData);

          const timelineRef = doc(collection(db, "enquiries", newEnqRef.id, "timeline"));
          batch.set(timelineRef, {
              action: form.action,
              remark: form.remark,
              date: Timestamp.now(),
              status: form.status,
              by: appUser?.name || "SRM"
          });

          await batch.commit();

          setIsModalOpen(false);
          setForm(initialForm);
          setCancelStage(0);
          alert(`Enquiry Created Successfully!\nID: ${enqId}`);

      } catch (e) {
          console.error(e);
          alert("Failed to save enquiry.");
      } finally {
          setSaving(false);
      }
  };

  const menuItems = [
      { label: "Add Enquiry", icon: Plus, onClick: () => setIsModalOpen(true) },
      { label: "Cards", icon: Layers, href: "/srm/cards" },
      { label: "Enquiries", icon: FileText, href: "/srm/enquiries" },
      { label: "Data", icon: Database, href: "/srm/data" },
  ];

  // Prevent flash of content while checking role
  if (loading || !appUser || appUser.role === "ADMIN") {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#8C7B6C] animate-pulse">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto">
        
        {/* 1. Header with Logout */}
        <div className="mb-10 mt-4 flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-serif font-bold text-[#2D241E]">
                    Welcome back, {appUser?.name?.split(" ")[0]}
                </h2>
                <p className="text-[#8C7B6C] mt-1">Ready to connect with your students today?</p>
            </div>
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-[#8C7B6C] hover:text-[#D96C6C] transition-colors font-bold text-xs uppercase tracking-wider mb-1"
            >
                <LogOut size={16} /> Sign Out
            </button>
        </div>

        {/* 2. The Grid (No Notification Badge) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {menuItems.map((item, idx) => {
                const CardContent = (
                    <div className="bg-[#C5A880] hover:bg-[#B89A72] active:scale-95 transition-all duration-300 aspect-square rounded-sm shadow-sm flex flex-col items-center justify-center gap-3 relative group cursor-pointer">
                        {/* Icon & Text */}
                        <div className="text-white opacity-90 group-hover:scale-110 transition-transform duration-300">
                            <item.icon size={32} strokeWidth={1.5} />
                        </div>
                        <span className="text-white font-medium text-lg tracking-wide drop-shadow-sm">
                            {item.label}
                        </span>
                    </div>
                );

                return item.onClick ? (
                    <button key={idx} onClick={item.onClick} className="w-full text-left">
                        {CardContent}
                    </button>
                ) : (
                    <Link key={idx} href={item.href!} className="w-full block">
                        {CardContent}
                    </Link>
                );
            })}
        </div>

        {/* --- NEW ENQUIRY MODAL --- */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-[#FDFDFD] w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden">
                    
                    <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                        <h2 className="text-xl font-serif font-bold text-[#2D241E]">New Enquiry</h2>
                        <button onClick={handleCancel} className="p-2 hover:bg-[#F5F0EB] text-[#8C7B6C] rounded-full transition-colors">
                            <X size={24}/>
                        </button>
                    </div>

                    <div className="p-6 space-y-6 overflow-y-auto">
                        
                        {/* Section 1: Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Student Name</label>
                                <input 
                                    className="w-full border-b border-[#E8E0D5] p-2 outline-none font-serif font-medium text-[#2D241E] focus:border-[#C5A880] transition-colors text-lg bg-transparent placeholder:text-[#E8E0D5]"
                                    placeholder="e.g. Rahul Sharma"
                                    value={form.name}
                                    onChange={e => setForm({...form, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Phone</label>
                                    <input 
                                        className="w-full border-b border-[#E8E0D5] p-2 outline-none font-medium text-[#4A4036] focus:border-[#C5A880] transition-colors bg-transparent placeholder:text-[#E8E0D5]"
                                        placeholder="98765..."
                                        value={form.phone}
                                        onChange={e => setForm({...form, phone: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Source</label>
                                    <select 
                                        className="w-full border-b border-[#E8E0D5] p-2 outline-none bg-transparent font-medium text-[#4A4036] focus:border-[#C5A880]"
                                        value={form.source}
                                        onChange={e => setForm({...form, source: e.target.value})}
                                    >
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Actions & Status */}
                        <div className="bg-[#F5F0EB] p-5 rounded-2xl space-y-4 border border-[#E8E0D5]">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Action Taken</label>
                                    <select 
                                        className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-[#FDFDFD] text-[#2D241E] focus:border-[#C5A880]"
                                        value={form.action}
                                        onChange={e => setForm({...form, action: e.target.value})}
                                    >
                                        {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Current Status</label>
                                    <select 
                                        className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-[#FDFDFD] text-[#2D241E] focus:border-[#C5A880]"
                                        value={form.status}
                                        onChange={e => setForm({...form, status: e.target.value})}
                                    >
                                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Remark</label>
                                <textarea 
                                    className="w-full p-3 rounded-xl border border-[#E8E0D5] outline-none text-sm resize-none h-24 bg-[#FDFDFD] text-[#4A4036] focus:border-[#C5A880] placeholder:text-[#D6CCC6]"
                                    placeholder="Conversation details..."
                                    value={form.remark}
                                    onChange={e => setForm({...form, remark: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Section 3: Next Steps */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Next Action</label>
                                <select
                                    className="w-full border-b border-[#E8E0D5] p-2 outline-none bg-transparent font-medium text-[#4A4036] focus:border-[#C5A880]"
                                    value={form.nextAction}
                                    onChange={e => setForm({...form, nextAction: e.target.value})}
                                >
                                    <option value="">Select Action...</option>
                                    <option value="Call back">Call back</option>
                                    <option value="Schedule demo">Schedule demo</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Date</label>
                                <input 
                                    type="date"
                                    className="w-full border-b border-[#E8E0D5] p-2 outline-none font-medium text-[#4A4036] focus:border-[#C5A880] bg-transparent"
                                    value={form.nextActionDate}
                                    onChange={e => setForm({...form, nextActionDate: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="mt-6 flex gap-3 pt-4 border-t border-[#E8E0D5] shrink-0 p-6 bg-white">
                        <button 
                            onClick={handleCancel}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2
                                ${cancelStage === 1 
                                    ? "bg-[#D96C6C]/10 text-[#D96C6C] border border-[#D96C6C]/20 hover:bg-[#D96C6C]/20" 
                                    : "text-[#8C7B6C] hover:bg-[#F5F0EB]"}`}
                        >
                            {cancelStage === 1 ? <><AlertCircle size={16} /> Discard?</> : "Cancel"}
                        </button>
                        
                        <button 
                            onClick={handleSaveEnquiry}
                            disabled={saving}
                            className="flex-[2] py-3 text-sm font-bold text-white bg-[#C5A880] rounded-xl hover:bg-[#B89A72] shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {saving ? "Saving..." : <><Save size={18} /> Save Enquiry</>}
                        </button>
                    </div>

                </div>
            </div>
        )}

    </div>
  );
}