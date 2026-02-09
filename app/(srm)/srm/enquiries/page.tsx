"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  Search, 
  Phone, 
  MessageCircle, 
  Clock, 
  ArrowLeft,
  Mail,
  ArrowUpDown,
  Calendar as CalendarIcon,
  ListFilter,
  Eye,
  Check,
  ChevronDown 
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, differenceInDays, parse } from "date-fns";
import { useAuth } from "@/lib/useAuth"; 

import EnquiryActionCard from "@/components/EnquiryActionCard"; 

// --- Types ---
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
};

// --- Config (Updated Colors) ---
const STATUS_CONFIG = [
    { label: "Follow Up", value: "CALL_AGAIN", color: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" },
    { label: "Ready for Demo", value: "READY_DEMO", color: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]" },
    { label: "Demo Taken", value: "DEMO_TAKEN", color: "bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]" },
    { label: "Ready for Admission", value: "READY_ADMISSION", color: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]" },
];

export default function EnquiryListPage() {
  const { appUser } = useAuth(); 
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActionDate" | "nextActionDate">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isAllTime, setIsAllTime] = useState(false); 

  // Column Visibility State
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [visibleCols, setVisibleCols] = useState({
      created: true,
      age: true,
      nameId: true,
      status: true,
      lastAction: true,
      nextAction: true
  });

  // Status Filter Menu State
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Date Filter Menu State
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
            setShowColumnMenu(false);
        }
        if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
            setShowStatusMenu(false);
        }
        if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
            setShowDateMenu(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Data 
  useEffect(() => {
    const fetchData = async () => {
      if (!appUser?.srmId) return;

      setLoading(true);
      setEnquiries([]); 
      
      try {
        let q = query(
            collection(db, "enquiries"), 
            where("srmId", "==", appUser.srmId),
            where("status", "in", ["CALL_AGAIN", "READY_DEMO", "DEMO_TAKEN", "READY_ADMISSION"])
        );

        if (!isAllTime) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const date = new Date(year, month - 1);
            const start = Timestamp.fromDate(startOfMonth(date));
            const end = Timestamp.fromDate(endOfMonth(date));

            q = query(q, where("createdAt", ">=", start), where("createdAt", "<=", end));
        }

        q = query(q, orderBy("createdAt", "desc"));
        
        const snap = await getDocs(q);
        setEnquiries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enquiry)));
      } catch (e) { 
          console.error("Fetch error:", e); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchData();
  }, [selectedMonth, isAllTime, appUser]); 

  const handleEnquiryUpdate = (updated: Enquiry) => {
      if (updated.status === "JOINED" || updated.status === "NOT_JOINING") {
          setEnquiries(prev => prev.filter(e => e.id !== updated.id));
      } else {
          setEnquiries(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
  };

  const formatDate = (ts: any, fmt: string = "dd MMM") => ts ? format(ts.toDate(), fmt) : "--";
  const getDaysOld = (ts: any) => ts ? differenceInDays(new Date(), ts.toDate()) : 0;
  
  const getStatusBadge = (status: string) => {
      const config = STATUS_CONFIG.find(s => s.value === status);
      return <span className={`px-2 py-1 rounded text-[10px] font-bold border ${config ? config.color : "bg-gray-100"}`}>{config ? config.label : status}</span>;
  };

  const handleSort = (field: "createdAt" | "lastActionDate" | "nextActionDate") => {
      if (sortBy === field) {
          setSortOrder(sortOrder === "asc" ? "desc" : "asc"); 
      } else {
          setSortBy(field);
          setSortOrder("desc"); 
      }
  };

  const filteredList = useMemo(() => {
      let result = enquiries;
      
      if (activeFilter !== "ALL") result = result.filter(e => e.status === activeFilter);
      
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
  }, [enquiries, activeFilter, searchTerm, sortBy, sortOrder]);

  const activeStatusConfig = STATUS_CONFIG.find(s => s.value === activeFilter);
  const filterButtonStyle = activeFilter === "ALL" 
      ? "bg-[#2D241E] text-white border-[#2D241E]" 
      : `${activeStatusConfig?.color} ring-1 ring-black/5`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
        <div className="space-y-4">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <Link href="/srm" className="p-2 hover:bg-[#E8E0D5] rounded-full transition-colors text-[#4A4036]">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-serif font-bold text-[#2D241E]">Active Enquiries</h1>
            </div>
            
            {/* Row 1: Search & Visibility Toggle */}
            <div className="flex w-full gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search by Name or Enquiry ID..." 
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
                                    { key: "age", label: "Age" },
                                    { key: "nameId", label: "Name & ID" },
                                    { key: "status", label: "Status" },
                                    { key: "lastAction", label: "Last Action & Remark" },
                                    { key: "nextAction", label: "Next Action & Date" },
                                ].map((col) => (
                                    <button
                                        key={col.key}
                                        onClick={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key as keyof typeof visibleCols] }))}
                                        className="w-full flex items-center justify-between px-2 py-2 text-sm rounded-lg hover:bg-[#F5F0EB] text-[#4A4036] transition-colors"
                                    >
                                        <span>{col.label}</span>
                                        {visibleCols[col.key as keyof typeof visibleCols] && (
                                            <Check size={16} className="text-[#15803D]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Dropdown Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Status Filter Dropdown */}
                <div className="relative inline-block text-left" ref={statusMenuRef}>
                    <button 
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border shadow-sm ${filterButtonStyle}`}
                    >
                        <span>{activeFilter === "ALL" ? "All Active" : activeStatusConfig?.label}</span>
                        <ChevronDown size={16} />
                    </button>

                    {showStatusMenu && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={() => { setActiveFilter("ALL"); setShowStatusMenu(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === "ALL" ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                            >
                                All Active
                                {activeFilter === "ALL" && <Check size={14} />}
                            </button>
                            
                            {STATUS_CONFIG.map(status => (
                                <button 
                                    key={status.value} 
                                    onClick={() => { setActiveFilter(status.value); setShowStatusMenu(false); }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${activeFilter === status.value ? status.color + " ring-1 ring-black/5" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                                >
                                    {status.label}
                                    {activeFilter === status.value && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Date Filter Dropdown */}
                <div className="relative inline-block text-left" ref={dateMenuRef}>
                    <button 
                        onClick={() => setShowDateMenu(!showDateMenu)}
                        className={`flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E8E0D5] rounded-lg text-sm font-bold transition-all shadow-sm text-[#4A4036] hover:bg-[#F5F0EB]`}
                    >
                        <CalendarIcon size={16} className="text-[#8C7B6C]" />
                        <span>{isAllTime ? "All Time" : format(parse(selectedMonth, "yyyy-MM", new Date()), "MMMM yyyy")}</span>
                        <ChevronDown size={16} className="text-[#8C7B6C]" />
                    </button>

                    {showDateMenu && (
                        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E8E0D5] z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                            <button 
                                onClick={() => { setIsAllTime(true); setShowDateMenu(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all flex justify-between items-center mb-1 ${isAllTime ? "bg-[#2D241E] text-white" : "hover:bg-[#F5F0EB] text-[#4A4036]"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <ListFilter size={16} /> All Time
                                </div>
                                {isAllTime && <Check size={14} />}
                            </button>
                            
                            <div className="px-3 py-2">
                                <div className="text-[10px] font-bold text-[#8C7B6C] uppercase tracking-wider mb-2">Select Specific Month</div>
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

        {/* List Table */}
        <div className="bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#F5F0EB] border-b border-[#E8E0D5] text-xs uppercase tracking-wider text-[#8C7B6C] font-bold select-none">
                            {visibleCols.created && (
                                <th 
                                    className="p-4 w-32 cursor-pointer hover:bg-[#E8E0D5] transition-colors group"
                                    onClick={() => handleSort("createdAt")}
                                >
                                    <div className="flex items-center gap-1">
                                        Created
                                        <ArrowUpDown size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortBy === "createdAt" ? "opacity-100 text-[#2D241E]" : ""}`} />
                                    </div>
                                </th>
                            )}

                            {visibleCols.age && <th className="p-4 w-24 text-center">Age</th>}
                            {visibleCols.nameId && <th className="p-4">Name & ID</th>}
                            {visibleCols.status && <th className="p-4">Status</th>}
                            
                            {activeFilter === "READY_DEMO" && <th className="p-4 text-center">Link Sent?</th>}
                            
                            {activeFilter === "READY_ADMISSION" ? (
                                <th className="p-4 w-1/4">Invitation Date</th>
                            ) : (
                                <>
                                    {visibleCols.lastAction && (
                                        <th 
                                            className="p-4 w-1/4 cursor-pointer hover:bg-[#E8E0D5] transition-colors group"
                                            onClick={() => handleSort("lastActionDate")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Last Action
                                                <ArrowUpDown size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortBy === "lastActionDate" ? "opacity-100 text-[#2D241E]" : ""}`} />
                                            </div>
                                        </th>
                                    )}

                                    {visibleCols.nextAction && (
                                        <th 
                                            className="p-4 w-1/4 cursor-pointer hover:bg-[#E8E0D5] transition-colors group"
                                            onClick={() => handleSort("nextActionDate")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Next Action
                                                <ArrowUpDown size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortBy === "nextActionDate" ? "opacity-100 text-[#2D241E]" : ""}`} />
                                            </div>
                                        </th>
                                    )}
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                        {loading ? ( <tr><td colSpan={7} className="p-12 text-center text-[#8C7B6C]">Loading data...</td></tr> ) : 
                        filteredList.length === 0 ? ( <tr><td colSpan={7} className="p-12 text-center text-[#8C7B6C]">No active enquiries found.</td></tr> ) : (
                            filteredList.map((enq) => (
                                <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] transition-colors group cursor-pointer">
                                    {visibleCols.created && (
                                        <td className="p-4 text-sm font-medium text-[#4A4036]">{formatDate(enq.createdAt)}</td>
                                    )}
                                    {visibleCols.age && (
                                        <td className="p-4 text-center">
                                            <span className="bg-[#F5F0EB] text-[#8C7B6C] px-2 py-1 rounded text-xs font-bold border border-[#E8E0D5]">
                                                {getDaysOld(enq.createdAt)}d
                                            </span>
                                        </td>
                                    )}
                                    {visibleCols.nameId && (
                                        <td className="p-4">
                                            <div className="font-bold text-[#2D241E]">{enq.name}</div>
                                            <div className="text-xs font-mono text-[#8C7B6C] mt-0.5">{enq.enqId}</div>
                                        </td>
                                    )}
                                    {visibleCols.status && (
                                        <td className="p-4">{getStatusBadge(enq.status)}</td>
                                    )}
                                    {activeFilter === "READY_DEMO" && (
                                        <td className="p-4 text-center">{enq.linkSent ? <span className="text-[#5D7352] text-xs font-bold">Yes</span> : <span className="text-[#D96C6C] text-xs font-bold">No</span>}</td>
                                    )}
                                    {activeFilter === "READY_ADMISSION" ? (
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-[#F0FDF4] text-[#15803D] rounded-full">
                                                    <Mail size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[#2D241E]">{formatDate(enq.lastActionDate, "dd MMM yyyy")}</div>
                                                    <div className="text-xs text-[#8C7B6C] mt-0.5">Invitation Sent</div>
                                                </div>
                                            </div>
                                        </td>
                                    ) : (
                                        <>
                                            {visibleCols.lastAction && (
                                                <td className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 text-[#C5A880] shrink-0">{enq.lastAction === "Called" ? <Phone size={14} /> : <MessageCircle size={14} />}</div>
                                                        <div>
                                                            <div className="text-sm font-bold text-[#2D241E]">{enq.lastAction}<span className="text-[#8C7B6C] font-normal ml-2 text-xs">{formatDate(enq.lastActionDate)}</span></div>
                                                            <div className="text-xs text-[#8C7B6C] mt-0.5 line-clamp-1 italic">"{enq.lastRemark || "No remark"}"</div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            {visibleCols.nextAction && (
                                                <td className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 shrink-0 text-[#4A4036]">
                                                            <Clock size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-[#2D241E]">
                                                                {enq.nextAction}
                                                            </div>
                                                            <div className="text-xs font-medium mt-0.5 text-[#4A4036]">
                                                                {formatDate(enq.nextActionDate, "PPP")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                        </>
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
            />
        )}
    </div>
  );
}