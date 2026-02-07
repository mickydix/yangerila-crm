"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Calendar as CalendarIcon, 
  ArrowUpDown, 
  CheckCircle, 
  XCircle,
  User,
  ListFilter
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard"; 

// --- FIXED TYPE DEFINITION ---
type Enquiry = {
  id: string;
  enqId: string;
  name: string;
  phone: string;
  status: "JOINED" | "NOT_JOINING"; // Specific statuses for this page
  createdAt: any; 
  lastAction: string;
  lastActionDate: any;
  lastRemark: string;
  srmName: string;
  // These are required by the Component, even if unused for closed cases
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
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isAllTime, setIsAllTime] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActionDate">("lastActionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Query: Status is JOINED or NOT_JOINING
        let q = query(
            collection(db, "enquiries"), 
            where("status", "in", ["JOINED", "NOT_JOINING"])
        );

        // Date Filter
        if (!isAllTime) {
            const [year, month] = selectedMonth.split("-").map(Number);
            const date = new Date(year, month - 1);
            const start = Timestamp.fromDate(startOfMonth(date));
            const end = Timestamp.fromDate(endOfMonth(date));
            
            // Filter based on when they were CLOSED (lastActionDate), not created
            q = query(q, where("lastActionDate", ">=", start), where("lastActionDate", "<=", end));
        }

        const snap = await getDocs(q);
        // Force type casting to ensure TS is happy
        setEnquiries(snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            // Ensure these exist to prevent crashes if DB is missing them
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

  // Handle Updates (If you edit a closed card)
  const handleEnquiryUpdate = (updated: any) => {
      // If status changes back to active, remove it from this view
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-4">
            <h1 className="text-3xl font-serif font-bold text-[#2D241E]">Archived Data</h1>
            
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search by Name or ID..." 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880]" 
                    />
                </div>
                
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-[#E8E0D5]">
                    <div className="relative">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${isAllTime ? "text-gray-300" : "text-[#8C7B6C]"}`}>
                            <CalendarIcon size={18} />
                        </div>
                        <input 
                            type="month" 
                            disabled={isAllTime}
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className={`pl-12 pr-4 py-2 bg-transparent outline-none font-bold cursor-pointer rounded-lg ${isAllTime ? "text-gray-300" : "text-[#4A4036]"}`}
                        />
                    </div>
                    <button 
                        onClick={() => setIsAllTime(!isAllTime)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isAllTime ? "bg-[#2D241E] text-white" : "bg-[#F5F0EB] text-[#8C7B6C]"}`}
                    >
                        <ListFilter size={16} /> All Time
                    </button>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setActiveFilter("ALL")} className={`px-4 py-2 rounded-lg text-sm font-bold border ${activeFilter === "ALL" ? "bg-[#2D241E] text-white border-[#2D241E]" : "bg-white text-[#8C7B6C] border-[#E8E0D5]"}`}>All Closed</button>
                {STATUS_CONFIG.map(s => (
                    <button key={s.value} onClick={() => setActiveFilter(s.value)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${activeFilter === s.value ? "ring-1 ring-black/10 " + s.color : "bg-white text-[#8C7B6C] border-[#E8E0D5]"}`}>{s.label}</button>
                ))}
            </div>
        </div>

        <div className="bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#F5F0EB] border-b border-[#E8E0D5] text-xs uppercase tracking-wider text-[#8C7B6C] font-bold">
                            <th className="p-4 w-40 cursor-pointer hover:bg-[#E8E0D5]" onClick={() => handleSort("createdAt")}>
                                <div className="flex items-center gap-1">Created <ArrowUpDown size={12}/></div>
                            </th>
                            <th className="p-4">Student</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 w-40 cursor-pointer hover:bg-[#E8E0D5]" onClick={() => handleSort("lastActionDate")}>
                                <div className="flex items-center gap-1">Closed On <ArrowUpDown size={12}/></div>
                            </th>
                            <th className="p-4">Remark</th>
                            <th className="p-4 text-right">SRM</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                        {loading ? <tr><td colSpan={6} className="p-12 text-center text-[#8C7B6C]">Loading...</td></tr> : 
                        filteredList.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-[#8C7B6C]">No records found.</td></tr> : (
                            filteredList.map((enq) => (
                                <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] cursor-pointer">
                                    <td className="p-4 text-sm font-medium text-[#4A4036]">{formatDate(enq.createdAt)}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-[#2D241E]">{enq.name}</div>
                                        <div className="text-xs font-mono text-[#8C7B6C] mt-0.5">{enq.enqId}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${STATUS_CONFIG.find(s => s.value === enq.status)?.color}`}>
                                            {STATUS_CONFIG.find(s => s.value === enq.status)?.label}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-[#2D241E]">
                                            {enq.status === 'JOINED' ? <CheckCircle size={14} className="text-teal-600"/> : <XCircle size={14} className="text-gray-400"/>}
                                            {formatDate(enq.lastActionDate)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-[#4A4036] italic truncate max-w-xs">"{enq.lastRemark}"</td>
                                    <td className="p-4 text-right">
                                        <div className="inline-flex items-center gap-2 bg-[#F5F0EB] px-2 py-1 rounded text-xs font-bold text-[#4A4036]">
                                            <User size={12}/> {enq.srmName}
                                        </div>
                                    </td>
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