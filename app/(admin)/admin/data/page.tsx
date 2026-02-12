"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, 
  Calendar as CalendarIcon, 
  ArrowUpDown, 
  CheckCircle, 
  XCircle,
  User,
  Users,
  ListFilter,
  Eye,
  Check,
  ChevronDown,
  ArrowLeft // Added for back button
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, parse } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard"; 
import Link from "next/link"; // Added for back button

// --- FIXED TYPE DEFINITION ---
type Enquiry = {
  id: string;
  enqId: string;
  name: string;
  phone: string;
  status: "JOINED" | "NOT_JOINING"; 
  createdAt: any; 
  lastAction: string;
  lastActionDate: any;
  lastRemark: string;
  srmName: string;
  nextAction: string;     
  nextActionDate: any;
  linkSent?: boolean;
};

const STATUS_CONFIG = [
    { label: "Joined", value: "JOINED", color: "bg-[#E8F2F2] text-[#2D241E] border-[#BED9D8]" },
    { label: "Not Joining", value: "NOT_JOINING", color: "bg-[#F0EBE8] text-[#70645C] border-[#D6CCC6]" },
];

export default function AdminDataPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [activeSRM, setActiveSRM] = useState<string>("ALL");
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
      created: true,
      student: true,
      status: true,
      closedOn: true,
      remark: true,
      srm: true
  });

  // Sorting
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActionDate">("lastActionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Automatically generate list of unique SRM names from current results
  const srmList = useMemo(() => {
    const names = enquiries
      .map(e => e.srmName)
      .filter((name): name is string => !!name);
    return Array.from(new Set(names)).sort();
  }, [enquiries]);

  // Handle outside clicks
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
    const fetchData = async () => {
      setLoading(true);
      try {
        let q = query(
            collection(db, "enquiries"), 
            where("status", "in", ["JOINED", "NOT_JOINING"])
        );

        if (!isAllTime) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const date = new Date(year, month - 1);
            const start = Timestamp.fromDate(startOfMonth(date));
            const end = Timestamp.fromDate(endOfMonth(date));
            q = query(q, where("lastActionDate", ">=", start), where("lastActionDate", "<=", end));
        }

        const snap = await getDocs(q);
        setEnquiries(snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            nextAction: d.data().nextAction || "",
            nextActionDate: d.data().nextActionDate || null
        } as Enquiry)));
      } catch (e) { 
          console.error("Fetch error:", e); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchData();
  }, [selectedMonth, isAllTime]);

  const handleEnquiryUpdate = (updated: any) => {
      if (updated.status !== "JOINED" && updated.status !== "NOT_JOINING") {
          setEnquiries(prev => prev.filter(e => e.id !== updated.id));
      } else {
          setEnquiries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
      }
  };

  const formatDate = (ts: any, fmt: string = "dd MMM") => ts ? format(ts.toDate(), fmt) : "--";
  
  const handleSort = (field: "createdAt" | "lastActionDate") => {
      if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      else { setSortBy(field); setSortOrder("desc"); }
  };

  const filteredList = useMemo(() => {
      let result = [...enquiries];
      if (activeFilter !== "ALL") result = result.filter(e => e.status === activeFilter);
      if (activeSRM !== "ALL") result = result.filter(e => e.srmName === activeSRM);
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(e => e.name.toLowerCase().includes(lower) || e.enqId.toLowerCase().includes(lower));
      }
      result.sort((a, b) => {
          const valA = a[sortBy]?.toMillis() || 0;
          const valB = b[sortBy]?.toMillis() || 0;
          return sortOrder === "asc" ? valA - valB : valB - valA;
      });
      return result;
  }, [enquiries, activeFilter, activeSRM, searchTerm, sortBy, sortOrder]);

  const activeStatusConfig = STATUS_CONFIG.find(s => s.value === activeFilter);
  const filterButtonStyle = activeFilter === "ALL" 
      ? "bg-[#2D241E] text-white border-[#2D241E]" 
      : `${activeStatusConfig?.color} ring-1 ring-black/5`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
        {/* --- BACK BUTTON --- */}
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 text-[#8C7B6C] hover:text-[#2D241E] transition-colors font-bold text-xs uppercase tracking-widest mb-2"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="space-y-4">
            <h1 className="text-3xl font-serif font-bold text-[#2D241E]">Archived Data</h1>
            
            {/* Row 1: Search & Visibility Toggle */}
            <div className="flex w-full gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search by Name or ID..." 
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
                                    { key: "created", label: "Created Date" },
                                    { key: "student", label: "Student" },
                                    { key: "status", label: "Status" },
                                    { key: "closedOn", label: "Closed On" },
                                    { key: "remark", label: "Remark" },
                                    { key: "srm", label: "SRM" },
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

            {/* Row 2: Dropdown Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Status Dropdown */}
                <div className="relative inline-block text-left" ref={statusMenuRef}>
                    <button 
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border shadow-sm ${filterButtonStyle}`}
                    >
                        <span>{activeFilter === "ALL" ? "All Closed" : activeStatusConfig?.label}</span>
                        <ChevronDown size={16} />
                    </button>

                    {showStatusMenu && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={() => { setActiveFilter("ALL"); setShowStatusMenu(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                            >
                                All Closed {activeFilter === "ALL" && <Check size={14} />}
                            </button>
                            {STATUS_CONFIG.map(s => (
                                <button key={s.value} onClick={() => { setActiveFilter(s.value); setShowStatusMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === s.value ? s.color + " ring-1 ring-black/5" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>
                                    {s.label} {activeFilter === s.value && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* SRM Dropdown */}
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
                            <button onClick={() => { setActiveSRM("ALL"); setShowSRMMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeSRM === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>
                                All SRMs {activeSRM === "ALL" && <Check size={14} />}
                            </button>
                            {srmList.map(name => (
                                <button key={name} onClick={() => { setActiveSRM(name); setShowSRMMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeSRM === name ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>
                                    {name} {activeSRM === name && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Date Dropdown */}
                <div className="relative inline-block text-left" ref={dateMenuRef}>
                    <button onClick={() => setShowDateMenu(!showDateMenu)} className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E0D5] rounded-lg text-sm font-bold transition-all shadow-sm text-[#4A4036] hover:bg-[#F5F0EB]`}>
                        <CalendarIcon size={16} className="text-[#8C7B6C]" />
                        <span>{isAllTime ? "All Time" : format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM yyyy")}</span>
                        <ChevronDown size={16} className="text-[#8C7B6C]" />
                    </button>

                    {showDateMenu && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => { setIsAllTime(true); setShowDateMenu(false); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${isAllTime ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}>
                                <div className="flex items-center gap-2"><ListFilter size={16} /> All Time</div>
                                {isAllTime && <Check size={14} />}
                            </button>
                            <div className="px-3 py-2 border-t border-[#E8E0D5] mt-1">
                                <div className="text-[10px] font-bold text-[#8C7B6C] uppercase tracking-wider mb-2">Select Month</div>
                                <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setIsAllTime(false); setShowDateMenu(false); }} className="w-full px-3 py-2 bg-[#F5F0EB] border border-[#E8E0D5] rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#C5A880]" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Table Section */}
        <div className="bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#F5F0EB] border-b border-[#E8E0D5] text-xs uppercase tracking-wider text-[#8C7B6C] font-bold select-none">
                            {visibleCols.created && (
                                <th className="p-4 w-40 cursor-pointer hover:bg-[#E8E0D5]" onClick={() => handleSort("createdAt")}>
                                    <div className="flex items-center gap-1">Created <ArrowUpDown size={12} className={sortBy === 'createdAt' ? 'text-[#2D241E]' : 'opacity-20'}/></div>
                                </th>
                            )}
                            {visibleCols.student && <th className="p-4">Student</th>}
                            {visibleCols.status && <th className="p-4">Status</th>}
                            {visibleCols.closedOn && (
                                <th className="p-4 w-40 cursor-pointer hover:bg-[#E8E0D5]" onClick={() => handleSort("lastActionDate")}>
                                    <div className="flex items-center gap-1">Closed On <ArrowUpDown size={12} className={sortBy === 'lastActionDate' ? 'text-[#2D241E]' : 'opacity-20'}/></div>
                                </th>
                            )}
                            {visibleCols.remark && <th className="p-4">Remark</th>}
                            {visibleCols.srm && <th className="p-4 text-right">SRM</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                        {loading ? <tr><td colSpan={6} className="p-12 text-center text-[#8C7B6C]">Loading...</td></tr> : 
                        filteredList.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-[#8C7B6C]">No records found.</td></tr> : (
                            filteredList.map((enq) => (
                                <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] cursor-pointer group transition-colors">
                                    {visibleCols.created && <td className="p-4 text-sm font-medium text-[#4A4036]">{formatDate(enq.createdAt)}</td>}
                                    {visibleCols.student && (
                                        <td className="p-4">
                                            <div className="font-bold text-[#2D241E]">{enq.name}</div>
                                            <div className="text-xs font-mono text-[#8C7B6C] mt-0.5">{enq.enqId}</div>
                                        </td>
                                    )}
                                    {visibleCols.status && (
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold border ${STATUS_CONFIG.find(s => s.value === enq.status)?.color}`}>
                                                {STATUS_CONFIG.find(s => s.value === enq.status)?.label}
                                            </span>
                                        </td>
                                    )}
                                    {visibleCols.closedOn && (
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm font-bold text-[#2D241E]">
                                                {enq.status === 'JOINED' ? <CheckCircle size={14} className="text-teal-600"/> : <XCircle size={14} className="text-[#8C7B6C]"/>}
                                                {formatDate(enq.lastActionDate)}
                                            </div>
                                        </td>
                                    )}
                                    {visibleCols.remark && <td className="p-4 text-sm text-[#4A4036] italic truncate max-w-xs">"{enq.lastRemark || "No remark"}"</td>}
                                    {visibleCols.srm && (
                                        <td className="p-4 text-right">
                                            <div className="inline-flex items-center gap-2 bg-[#F5F0EB] px-2 py-1 rounded text-xs font-bold text-[#4A4036]">
                                                <User size={12}/> {enq.srmName || "Unknown"}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {selectedEnquiry && (
            <EnquiryActionCard 
                enquiry={selectedEnquiry} 
                onClose={() => setSelectedEnquiry(null)} 
                onUpdate={handleEnquiryUpdate}
                priorityLabel={`Archived Record`}
            />
        )}
    </div>
  );
}