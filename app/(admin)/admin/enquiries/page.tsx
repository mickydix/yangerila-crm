"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, 
  Calendar, 
  User, 
  Phone, 
  MessageCircle,
  ArrowUpDown,
  ListFilter,
  Eye,
  Check,
  ChevronDown,
  Users,
  Plus,
  X,
  AlertCircle,
  Save
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  limit,
  Timestamp,
  doc,
  getCountFromServer,
  writeBatch
} from "firebase/firestore";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard"; 
import { useAuth } from "@/lib/useAuth";

type Enquiry = {
  id: string;
  name: string;
  phone: string;
  status: "CALL_AGAIN" | "READY_DEMO" | "DEMO_TAKEN" | "READY_ADMISSION" | "NOT_JOINING" | "JOINED";
  srmName?: string;
  srmId?: string;
  lastRemark: string;
  createdAt: any;
  enqId: string;
  lastAction: string;
  lastActionDate: any;
  nextAction: string;
  nextActionDate: any;
  linkSent?: boolean;
};

// Types for SRM selection
type SRMSelection = {
    id: string;
    name: string;
};

const ADMIN_STATUS_CONFIG = [
    { label: "Follow Up", value: "CALL_AGAIN", color: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
    { label: "Ready for Demo", value: "READY_DEMO", color: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]" },
    { label: "Demo Taken", value: "DEMO_TAKEN", color: "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]" },
    { label: "Ready for Admission", value: "READY_ADMISSION", color: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]" },
];

const SOURCES = ["Instagram", "Facebook", "Referral", "Google", "Walk-in", "Justdial", "Other"];
const ACTIONS = ["Called", "Sent Message"];
const STATUSES = [
    { label: "Follow Up", value: "CALL_AGAIN" },
    { label: "Ready for Demo", value: "READY_DEMO" },
    { label: "Demo Taken", value: "DEMO_TAKEN" },
    { label: "Ready for Admission", value: "READY_ADMISSION" },
    { label: "Not Joining", value: "NOT_JOINING" },
];

export default function AdminEnquiriesPage() {
  const { appUser } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  // --- ADD ENQUIRY MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelStage, setCancelStage] = useState<0 | 1>(0);
  const [availableSRMs, setAvailableSRMs] = useState<SRMSelection[]>([]);

  const initialForm = {
      name: "",
      phone: "",
      source: SOURCES[0],
      action: "Called",
      remark: "",
      status: "CALL_AGAIN",
      nextAction: "",
      nextActionDate: "",
      assignedSRMId: ""
  };
  const [form, setForm] = useState(initialForm);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [activeSRM, setActiveSRM] = useState<string>("ALL"); 
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isAllTime, setIsAllTime] = useState(false);

  // UI State for Menus
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const [showSRMMenu, setShowSRMMenu] = useState(false); 
  const srmMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCols, setVisibleCols] = useState({
      date: true,
      student: true,
      status: true,
      remark: true,
      handledBy: true
  });

  const srmList = useMemo(() => {
    const names = enquiries
      .map(e => e.srmName)
      .filter((name): name is string => !!name);
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

  // Fetch SRMs for the assignment dropdown
  useEffect(() => {
    const fetchSRMs = async () => {
        const q = query(collection(db, "srms"), where("status", "==", "ACTIVE"));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setAvailableSRMs(list);
    };
    fetchSRMs();
  }, []);

  useEffect(() => {
    const fetchEnquiries = async () => {
      setLoading(true);
      try {
        let q = query(
          collection(db, "enquiries"), 
          where("status", "in", ["CALL_AGAIN", "READY_DEMO", "DEMO_TAKEN", "READY_ADMISSION"])
        );

        if (!isAllTime) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const date = new Date(year, month - 1);
            const start = Timestamp.fromDate(startOfMonth(date));
            const end = Timestamp.fromDate(endOfMonth(date));
            q = query(q, where("createdAt", ">=", start), where("createdAt", "<=", end));
        }

        q = query(q, orderBy("createdAt", "desc"), limit(500));
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Enquiry[];

        setEnquiries(data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
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
      if (!form.name || !form.phone || !form.nextActionDate || !form.assignedSRMId) {
          return alert("Please fill Name, Phone, Next Action Date and assign an SRM.");
      }
      
      setSaving(true);
      try {
          const now = new Date();
          const yearLastDigit = now.getFullYear().toString().slice(-1);
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          
          const startOfDayDate = new Date(now.setHours(0, 0, 0, 0));
          const endOfDayDate = new Date(now.setHours(23, 59, 59, 999));
          
          const q = query(
              collection(db, "enquiries"),
              where("createdAt", ">=", Timestamp.fromDate(startOfDayDate)),
              where("createdAt", "<=", Timestamp.fromDate(endOfDayDate))
          );
          
          const snapshot = await getCountFromServer(q);
          const count = snapshot.data().count; 
          const suffix = String.fromCharCode(97 + count); 
          const enqId = `Q${yearLastDigit}${month}${day}${suffix}`;

          const selectedSRM = availableSRMs.find(s => s.id === form.assignedSRMId);

          const batch = writeBatch(db);
          const newEnqRef = doc(collection(db, "enquiries"));
          
          const parentData = {
              name: form.name,
              phone: form.phone,
              source: form.source,
              enqId: enqId,
              status: form.status,
              lastAction: form.action,
              lastActionDate: null, 
              lastRemark: form.remark,
              nextAction: form.nextAction || "Follow up",
              nextActionDate: Timestamp.fromDate(new Date(form.nextActionDate)),
              srmId: form.assignedSRMId,
              srmName: selectedSRM?.name || "Unknown",
              createdAt: Timestamp.now(),
          };

          batch.set(newEnqRef, parentData);

          const timelineRef = doc(collection(db, "enquiries", newEnqRef.id, "timeline"));
          batch.set(timelineRef, {
              action: form.action,
              remark: form.remark,
              date: Timestamp.now(),
              status: form.status,
              by: `Admin (${appUser?.name || "Admin"})`
          });

          await batch.commit();

          // Update local list
          setEnquiries(prev => [{ id: newEnqRef.id, ...parentData } as Enquiry, ...prev]);

          setIsModalOpen(false);
          setForm(initialForm);
          setCancelStage(0);
          alert(`Enquiry Created & Assigned Successfully!\nID: ${enqId}\nAssigned to: ${selectedSRM?.name}`);

      } catch (e) {
          console.error(e);
          alert("Failed to save enquiry.");
      } finally {
          setSaving(false);
      }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "--";
    return format(ts.toDate(), "dd MMM");
  };

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
  const filterButtonStyle = activeFilter === "ALL" 
      ? "bg-[#2D241E] text-white border-[#2D241E]" 
      : `${activeStatusConfig?.color} ring-1 ring-black/5`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif font-bold text-[#2D241E]">Active Enquiries</h1>
            <p className="text-[#8C7B6C] text-sm">Real-time feed of open cases across all SRMs</p>
          </div>
          {/* --- ADD ENQUIRY BUTTON --- */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#C5A880] hover:bg-[#B89A72] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#C5A880]/20 transition-all active:scale-95"
          >
            <Plus size={18} /> Add Enquiry
          </button>
        </div>

        <div className="flex w-full gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                <input 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    placeholder="Search Student Name or ID..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] transition-all shadow-sm placeholder:text-[#B0A090]" 
                />
            </div>

            <div className="relative" ref={columnMenuRef}>
                <button 
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="h-full px-3.5 bg-white border border-[#E8E0D5] rounded-xl hover:bg-[#F5F0EB] transition-colors text-[#4A4036] shadow-sm flex items-center justify-center"
                >
                    <Eye size={20} />
                </button>
                
                {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-xs font-bold text-[#8C7B6C] px-2 py-1 uppercase tracking-wider mb-1">Show Columns</div>
                        <div className="space-y-1">
                            {[
                                { key: "date", label: "Date" },
                                { key: "student", label: "Student" },
                                { key: "status", label: "Status" },
                                { key: "remark", label: "Last Remark" },
                                { key: "handledBy", label: "Handled By" },
                            ].map((col) => (
                                <button
                                    key={col.key}
                                    onClick={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key as keyof typeof visibleCols] }))}
                                    className="w-full flex items-center justify-between px-2 py-2 text-sm rounded-lg hover:bg-[#F5F0EB] text-[#4A4036] transition-colors"
                                >
                                    <span>{col.label}</span>
                                    {visibleCols[col.key as keyof typeof visibleCols] && <Check size={16} className="text-[#15803D]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="flex flex-wrap gap-3">
            <div className="relative inline-block text-left" ref={statusMenuRef}>
                <button 
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border shadow-sm ${filterButtonStyle}`}
                >
                    <span>{activeFilter === "ALL" ? "All Status" : activeStatusConfig?.label}</span>
                    <ChevronDown size={16} />
                </button>

                {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => { setActiveFilter("ALL"); setShowStatusMenu(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                        >
                            All Status {activeFilter === "ALL" && <Check size={14} />}
                        </button>
                        
                        {ADMIN_STATUS_CONFIG.map(status => (
                            <button 
                                key={status.value} 
                                onClick={() => { setActiveFilter(status.value); setShowStatusMenu(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === status.value ? status.color + " ring-1 ring-black/5" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                            >
                                {status.label} {activeFilter === status.value && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative inline-block text-left" ref={srmMenuRef}>
                <button 
                    onClick={() => setShowSRMMenu(!showSRMMenu)}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-bold transition-all shadow-sm ${activeSRM === "ALL" ? "bg-white border-[#E8E0D5] text-[#4A4036] hover:bg-[#F5F0EB]" : "bg-[#2D241E] border-[#2D241E] text-white"}`}
                >
                    <Users size={16} className={activeSRM === "ALL" ? "text-[#8C7B6C]" : "text-white"} />
                    <span>{activeSRM === "ALL" ? "All SRMs" : activeSRM}</span>
                    <ChevronDown size={16} className={activeSRM === "ALL" ? "text-[#8C7B6C]" : "text-white"} />
                </button>

                {showSRMMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => { setActiveSRM("ALL"); setShowSRMMenu(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeSRM === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                        >
                            All SRMs {activeSRM === "ALL" && <Check size={14} />}
                        </button>
                        
                        {srmList.map(name => (
                            <button 
                                key={name} 
                                onClick={() => { setActiveSRM(name); setShowSRMMenu(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeSRM === name ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                            >
                                {name} {activeSRM === name && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative inline-block text-left" ref={dateMenuRef}>
                <button 
                    onClick={() => setShowDateMenu(!showDateMenu)}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E0D5] rounded-lg text-sm font-bold transition-all shadow-sm text-[#4A4036] hover:bg-[#F5F0EB]`}
                >
                    <Calendar size={16} className="text-[#8C7B6C]" />
                    <span>{isAllTime ? "All Time" : format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM yyyy")}</span>
                    <ChevronDown size={16} className="text-[#8C7B6C]" />
                </button>

                {showDateMenu && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => { setIsAllTime(true); setShowDateMenu(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${isAllTime ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                        >
                            <div className="flex items-center gap-2"><ListFilter size={16} /> All Time</div>
                            {isAllTime && <Check size={14} />}
                        </button>

                        <div className="px-3 py-2 border-t border-[#E8E0D5] mt-1">
                            <div className="text-[10px] font-bold text-[#8C7B6C] uppercase tracking-wider mb-2">Select Month</div>
                            <input 
                                type="month" 
                                value={selectedMonth}
                                onChange={(e) => {
                                    setSelectedMonth(e.target.value);
                                    setIsAllTime(false);
                                    setShowDateMenu(false);
                                }}
                                className="w-full px-3 py-2 bg-[#F5F0EB] border border-[#E8E0D5] rounded-lg text-sm font-bold text-[#4A4036] outline-none focus:ring-2 focus:ring-[#C5A880]"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="bg-[#FDFDFD] rounded-3xl border border-[#E8E0D5] shadow-sm overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-[#8C7B6C]">Loading records...</div>
        ) : filteredData.length === 0 ? (
           <div className="p-12 text-center text-[#8C7B6C]">No active enquiries found for these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F0EB] text-[#8C7B6C] text-xs uppercase tracking-wider border-b border-[#E8E0D5]">
                  {visibleCols.date && <th className="p-4 font-bold">Date</th>}
                  {visibleCols.student && <th className="p-4 font-bold">Student</th>}
                  {visibleCols.status && <th className="p-4 font-bold">Status</th>}
                  {visibleCols.remark && <th className="p-4 font-bold">Last Remark</th>}
                  {visibleCols.handledBy && <th className="p-4 font-bold text-right">Handled By</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredData.map((enq) => (
                  <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] transition-colors group cursor-pointer">
                    {visibleCols.date && (
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-[#4A4036] font-medium">
                          <Calendar size={14} className="text-[#C5A880]" />
                          {formatDate(enq.createdAt)}
                        </div>
                        <span className="text-[10px] text-[#8C7B6C] pl-6 block">{enq.enqId}</span>
                      </td>
                    )}
                    {visibleCols.student && (
                      <td className="p-4">
                        <div className="font-bold text-[#2D241E] text-base">{enq.name}</div>
                        <div className="flex items-center gap-2 text-xs text-[#8C7B6C] mt-0.5">
                          <Phone size={12} /> {enq.phone}
                        </div>
                      </td>
                    )}
                    {visibleCols.status && (
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${ADMIN_STATUS_CONFIG.find(s => s.value === enq.status)?.color || "bg-gray-100"}`}>
                          {enq.status.replace("_", " ")}
                        </span>
                      </td>
                    )}
                    {visibleCols.remark && (
                      <td className="p-4 max-w-xs">
                         <div className="flex items-start gap-2">
                            <MessageCircle size={14} className="text-[#C5A880] mt-0.5 shrink-0" />
                            <p className="text-sm text-[#4A4036] line-clamp-2 italic">"{enq.lastRemark || "No remarks"}"</p>
                         </div>
                      </td>
                    )}
                    {visibleCols.handledBy && (
                      <td className="p-4 text-right">
                         <div className="inline-flex items-center gap-2 bg-[#F5F0EB] px-3 py-1.5 rounded-lg border border-[#E8E0D5]">
                            <User size={14} className="text-[#8C7B6C]" />
                            <span className="text-xs font-bold text-[#4A4036]">{enq.srmName || "Unknown"}</span>
                         </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedEnquiry && (
        <EnquiryActionCard 
            enquiry={selectedEnquiry}
            onClose={() => setSelectedEnquiry(null)}
            onUpdate={handleEnquiryUpdate}
            priorityLabel={`Assigned to: ${selectedEnquiry.srmName || "SRM"}`} 
        />
      )}

      {/* --- ADMIN ADD ENQUIRY MODAL --- */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-[#FDFDFD] w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden border border-[#E8E0D5]">
                  
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                      <h2 className="text-xl font-serif font-bold text-[#2D241E]">Admin: Add & Assign Lead</h2>
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

                      {/* Section 2: Assignment & Status */}
                      <div className="bg-[#F5F0EB] p-5 rounded-2xl space-y-4 border border-[#E8E0D5]">
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-[#C5A880] uppercase mb-1">Assign to SRM</label>
                                  <select 
                                      className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-white text-[#2D241E] focus:border-[#C5A880]"
                                      value={form.assignedSRMId}
                                      onChange={e => setForm({...form, assignedSRMId: e.target.value})}
                                  >
                                      <option value="">Select SRM...</option>
                                      {availableSRMs.map(srm => <option key={srm.id} value={srm.id}>{srm.name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Initial Status</label>
                                  <select 
                                      className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-white text-[#2D241E] focus:border-[#C5A880]"
                                      value={form.status}
                                      onChange={e => setForm({...form, status: e.target.value as any})}
                                  >
                                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                  </select>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Admin Remark</label>
                              <textarea 
                                  className="w-full p-3 rounded-xl border border-[#E8E0D5] outline-none text-sm resize-none h-24 bg-white text-[#4A4036] focus:border-[#C5A880] placeholder:text-[#D6CCC6]"
                                  placeholder="Special instructions for SRM..."
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
                          {saving ? "Saving..." : <><Save size={18} /> Save & Assign</>}
                      </button>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
}