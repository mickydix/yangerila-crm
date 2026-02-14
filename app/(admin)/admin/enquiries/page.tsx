"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, Calendar, User, Phone, MessageCircle, Eye, Check, ChevronDown, Users, Plus, X, ArrowLeft, ListFilter
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, where, limit, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard"; 
import AddEnquiryModal from "@/components/AddEnquiryModal"; // IMPORT THE NEW COMPONENT
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";

// --- Types ---
type Enquiry = {
  id: string; name: string; phone: string;
  status: "CALL_AGAIN" | "READY_DEMO" | "DEMO_TAKEN" | "READY_ADMISSION" | "NOT_JOINING" | "JOINED";
  srmName?: string; srmId?: string; lastRemark: string; createdAt: any;
  enqId: string; lastAction: string; lastActionDate: any;
  nextAction: string; nextActionDate: any; linkSent?: boolean;
};

const ADMIN_STATUS_CONFIG = [
    { label: "Follow Up", value: "CALL_AGAIN", color: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
    { label: "Ready for Demo", value: "READY_DEMO", color: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]" },
    { label: "Demo Taken", value: "DEMO_TAKEN", color: "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]" },
    { label: "Ready for Admission", value: "READY_ADMISSION", color: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]" },
];

export default function AdminEnquiriesPage() {
  const { appUser } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [activeSRM, setActiveSRM] = useState<string>("ALL"); 
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isAllTime, setIsAllTime] = useState(false);

  // Menu states
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [showSRMMenu, setShowSRMMenu] = useState(false); 
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const srmMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCols, setVisibleCols] = useState({
      date: true, student: true, status: true, remark: true, handledBy: true
  });

  const srmList = useMemo(() => {
    const names = enquiries.map(e => e.srmName).filter((name): name is string => !!name);
    return Array.from(new Set(names)).sort();
  }, [enquiries]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) setShowColumnMenu(false);
        if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) setShowStatusMenu(false);
        if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) setShowDateMenu(false);
        if (srmMenuRef.current && !srmMenuRef.current.contains(event.target as Node)) setShowSRMMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchEnquiries = async () => {
      setLoading(true);
      try {
        let q = query(collection(db, "enquiries"), where("status", "in", ["CALL_AGAIN", "READY_DEMO", "DEMO_TAKEN", "READY_ADMISSION"]));
        if (!isAllTime) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const date = new Date(year, month - 1);
            q = query(q, where("createdAt", ">=", Timestamp.fromDate(startOfMonth(date))), where("createdAt", "<=", Timestamp.fromDate(endOfMonth(date))));
        }
        q = query(q, orderBy("createdAt", "desc"), limit(500));
        const snapshot = await getDocs(q);
        setEnquiries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Enquiry[]);
      } catch (error) {
        console.error("Error:", error);
      } finally { setLoading(false); }
    };
    fetchEnquiries();
  }, [selectedMonth, isAllTime]);

  const handleEnquiryUpdate = (updated: Enquiry) => {
      if (updated.status === "JOINED" || updated.status === "NOT_JOINING") {
          setEnquiries(prev => prev.filter(e => e.id !== updated.id));
      } else {
          setEnquiries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
      }
  };

  const handleNewEnquiryAdded = (newEnq: Enquiry) => {
      setEnquiries(prev => [newEnq, ...prev]);
  };

  const formatDate = (ts: any) => ts ? format(ts.toDate(), "dd MMM") : "--";

  const filteredData = useMemo(() => {
      let result = [...enquiries];
      if (activeFilter !== "ALL") result = result.filter(e => e.status === activeFilter);
      if (activeSRM !== "ALL") result = result.filter(e => e.srmName === activeSRM); 
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(e => e.name.toLowerCase().includes(lower) || e.enqId.toLowerCase().includes(lower));
      }
      return result;
  }, [enquiries, activeFilter, activeSRM, searchTerm]);

  const activeStatusConfig = ADMIN_STATUS_CONFIG.find(s => s.value === activeFilter);
  const filterButtonStyle = activeFilter === "ALL" ? "bg-[#2D241E] text-white border-[#2D241E]" : `${activeStatusConfig?.color} border`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <Link href="/admin" className="inline-flex items-center gap-2 text-[#8C7B6C] hover:text-[#2D241E] transition-colors font-bold text-xs uppercase tracking-widest mb-2"><ArrowLeft size={16} /> Back to Dashboard</Link>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div><h1 className="text-3xl font-serif font-bold text-[#2D241E]">Active Enquiries</h1><p className="text-[#8C7B6C] text-sm">Real-time feed across all SRMs</p></div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#C5A880] hover:bg-[#B89A72] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95"><Plus size={18} /> Add Enquiry</button>
        </div>

        <div className="flex w-full gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search Student..." className="w-full pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] transition-all shadow-sm placeholder:text-[#B0A090]" />
            </div>
            <div className="relative" ref={columnMenuRef}>
                <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="h-full px-3.5 bg-white border border-[#E8E0D5] rounded-xl hover:bg-[#F5F0EB] transition-colors text-[#4A4036] shadow-sm flex items-center justify-center"><Eye size={20} /></button>
                {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2">
                        <div className="text-xs font-bold text-[#8C7B6C] px-2 py-1 uppercase tracking-wider mb-1">Show Columns</div>
                        {[{ key: "date", label: "Date" }, { key: "student", label: "Student" }, { key: "status", label: "Status" }, { key: "remark", label: "Last Remark" }, { key: "handledBy", label: "Handled By" }].map((col) => (
                            <button key={col.key} onClick={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key as keyof typeof visibleCols] }))} className="w-full flex items-center justify-between px-2 py-2 text-sm rounded-lg hover:bg-[#F5F0EB] text-[#4A4036] transition-colors">
                                <span>{col.label}</span>{visibleCols[col.key as keyof typeof visibleCols] && <Check size={16} className="text-[#15803D]" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="flex flex-wrap gap-3">
            <div className="relative inline-block text-left" ref={statusMenuRef}>
                <button onClick={() => setShowStatusMenu(!showStatusMenu)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border shadow-sm ${filterButtonStyle}`}>
                    <span>{activeFilter === "ALL" ? "All Status" : activeStatusConfig?.label}</span><ChevronDown size={16} />
                </button>
                {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2">
                        <button onClick={() => { setActiveFilter("ALL"); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold flex justify-between items-center mb-1 ${activeFilter === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>All Status {activeFilter === "ALL" && <Check size={14} />}</button>
                        {ADMIN_STATUS_CONFIG.map(status => (
                            <button key={status.value} onClick={() => { setActiveFilter(status.value); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold flex justify-between items-center mb-1 ${activeFilter === status.value ? status.color : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>{status.label} {activeFilter === status.value && <Check size={14} />}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative inline-block text-left" ref={srmMenuRef}>
                <button onClick={() => setShowSRMMenu(!showSRMMenu)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-bold transition-all shadow-sm ${activeSRM === "ALL" ? "bg-white border-[#E8E0D5] text-[#4A4036] hover:bg-[#F5F0EB]" : "bg-[#2D241E] border-[#2D241E] text-white"}`}><Users size={16} /><span>{activeSRM === "ALL" ? "All SRMs" : activeSRM}</span><ChevronDown size={16} /></button>
                {showSRMMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2">
                        <button onClick={() => { setActiveSRM("ALL"); setShowSRMMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold flex justify-between items-center mb-1 ${activeSRM === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>All SRMs {activeSRM === "ALL" && <Check size={14} />}</button>
                        {srmList.map(name => (
                            <button key={name} onClick={() => { setActiveSRM(name); setShowSRMMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold flex justify-between items-center mb-1 ${activeSRM === name ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>{name} {activeSRM === name && <Check size={14} />}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative inline-block text-left" ref={dateMenuRef}>
                <button onClick={() => setShowDateMenu(!showDateMenu)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E0D5] rounded-lg text-sm font-bold transition-all shadow-sm text-[#4A4036] hover:bg-[#F5F0EB]"><Calendar size={16} /><span>{isAllTime ? "All Time" : format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM yyyy")}</span><ChevronDown size={16} /></button>
                {showDateMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2">
                        <button onClick={() => { setIsAllTime(true); setShowDateMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold flex justify-between items-center mb-1 ${isAllTime ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}><div className="flex items-center gap-2"><ListFilter size={16} /> All Time</div>{isAllTime && <Check size={14} />}</button>
                        <div className="px-3 py-2 border-t border-[#E8E0D5] mt-1"><div className="text-[10px] font-bold text-[#8C7B6C] uppercase mb-2">Select Month</div><input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setIsAllTime(false); setShowDateMenu(false); }} className="w-full px-3 py-2 bg-[#F5F0EB] border border-[#E8E0D5] rounded-lg text-sm font-bold text-[#4A4036] outline-none" /></div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="bg-[#FDFDFD] rounded-3xl border border-[#E8E0D5] shadow-sm overflow-hidden">
        {loading ? (<div className="p-12 text-center text-[#8C7B6C]">Loading records...</div>) : filteredData.length === 0 ? (<div className="p-12 text-center text-[#8C7B6C]">No active enquiries found.</div>) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-[#F5F0EB] text-[#8C7B6C] text-xs uppercase tracking-wider border-b border-[#E8E0D5]">{visibleCols.date && <th className="p-4 font-bold">Date</th>}{visibleCols.student && <th className="p-4 font-bold">Student</th>}{visibleCols.status && <th className="p-4 font-bold">Status</th>}{visibleCols.remark && <th className="p-4 font-bold">Last Remark</th>}{visibleCols.handledBy && <th className="p-4 font-bold text-right">Handled By</th>}</tr></thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredData.map((enq) => (
                  <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] transition-colors group cursor-pointer">
                    {visibleCols.date && (<td className="p-4 whitespace-nowrap"><div className="flex items-center gap-2 text-[#4A4036] font-medium"><Calendar size={14} className="text-[#C5A880]" />{formatDate(enq.createdAt)}</div><span className="text-[10px] text-[#8C7B6C] pl-6 block">{enq.enqId}</span></td>)}
                    {visibleCols.student && (<td className="p-4"><div className="font-bold text-[#2D241E] text-base">{enq.name}</div><div className="flex items-center gap-2 text-xs text-[#8C7B6C] mt-0.5"><Phone size={12} /> {enq.phone}</div></td>)}
                    {visibleCols.status && (<td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold border ${ADMIN_STATUS_CONFIG.find(s => s.value === enq.status)?.color || "bg-gray-100"}`}>{enq.status.replace("_", " ")}</span></td>)}
                    {visibleCols.remark && (<td className="p-4 max-w-xs"><div className="flex items-start gap-2"><MessageCircle size={14} className="text-[#C5A880] mt-0.5 shrink-0" /><p className="text-sm text-[#4A4036] line-clamp-2 italic">"{enq.lastRemark || "No remarks"}"</p></div></td>)}
                    {visibleCols.handledBy && (<td className="p-4 text-right"><div className="inline-flex items-center gap-2 bg-[#F5F0EB] px-3 py-1.5 rounded-lg border border-[#E8E0D5]"><User size={14} className="text-[#8C7B6C]" /><span className="text-xs font-bold text-[#4A4036]">{enq.srmName || "Unknown"}</span></div></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEnquiry && (<EnquiryActionCard enquiry={selectedEnquiry} onClose={() => setSelectedEnquiry(null)} onUpdate={handleEnquiryUpdate} priorityLabel={`Assigned to: ${selectedEnquiry.srmName || "SRM"}`} />)}

      {/* CALL THE NEW COMPONENT HERE */}
      <AddEnquiryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleNewEnquiryAdded} 
        appUserName={appUser?.name || "Admin"}
      />
    </div>
  );
}