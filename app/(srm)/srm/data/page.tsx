"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ListFilter
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/lib/useAuth";

import EnquiryActionCard from "@/components/EnquiryActionCard"; 

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

// --- Config ---
const DATA_STATUS_CONFIG = [
    { label: "Joined", value: "JOINED", color: "bg-[#E8F2F2] text-[#2D241E] border-[#BED9D8]" },
    { label: "Not Joining", value: "NOT_JOINING", color: "bg-[#F0EBE8] text-[#70645C] border-[#D6CCC6]" },
];

export default function SRMDataPage() {
  const { appUser } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"createdAt" | "lastActionDate">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      if (!appUser?.srmId) return;

      setLoading(true);
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const date = new Date(year, month - 1);
        const start = Timestamp.fromDate(startOfMonth(date));
        const end = Timestamp.fromDate(endOfMonth(date));

        const q = query(
            collection(db, "enquiries"), 
            where("srmId", "==", appUser.srmId),
            where("status", "in", ["JOINED", "NOT_JOINING"]), 
            where("createdAt", ">=", start),
            where("createdAt", "<=", end),
            orderBy("createdAt", "desc")
        );
        
        const snap = await getDocs(q);
        setEnquiries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enquiry)));
      } catch (e) { 
          console.error("Fetch error:", e); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchData();
  }, [selectedMonth, appUser]);

  const handleEnquiryUpdate = (updated: Enquiry) => {
      if (updated.status !== "JOINED" && updated.status !== "NOT_JOINING") {
          setEnquiries(prev => prev.filter(e => e.id !== updated.id));
      } else {
          setEnquiries(prev => prev.map(e => e.id === updated.id ? updated : e));
      }
  };

  const formatDate = (ts: any, fmt: string = "dd MMM") => ts ? format(ts.toDate(), fmt) : "--";
  
  const getStatusBadge = (status: string) => {
      const config = DATA_STATUS_CONFIG.find(s => s.value === status);
      return <span className={`px-2 py-1 rounded text-[10px] font-bold border ${config ? config.color : "bg-gray-100"}`}>{config ? config.label : status}</span>;
  };

  const handleSort = (field: "createdAt" | "lastActionDate") => {
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/srm" className="p-2 hover:bg-[#E8E0D5] rounded-full transition-colors text-[#4A4036]">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-serif font-bold text-[#2D241E]">Archived Data</h1>
            </div>
            
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
                    <input 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search by Name or Enquiry ID..." 
                        className="w-full pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] transition-all shadow-sm placeholder:text-[#B0A090]" 
                    />
                </div>

                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C] pointer-events-none">
                        <CalendarIcon size={18} />
                    </div>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] font-bold text-[#4A4036] cursor-pointer shadow-sm"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveFilter("ALL")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${activeFilter === "ALL" ? "bg-[#2D241E] text-white border-[#2D241E]" : "bg-white text-[#8C7B6C] border-[#E8E0D5] hover:bg-[#F5F0EB]"}`}>All Closed</button>
                {DATA_STATUS_CONFIG.map(status => (
                    <button key={status.value} onClick={() => setActiveFilter(status.value)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${activeFilter === status.value ? "ring-1 ring-black/10 " + status.color : "bg-white text-[#8C7B6C] border-[#E8E0D5] hover:bg-[#F5F0EB]"}`}>{status.label}</button>
                ))}
            </div>
        </div>

        <div className="bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#F5F0EB] border-b border-[#E8E0D5] text-xs uppercase tracking-wider text-[#8C7B6C] font-bold select-none">
                            <th 
                                className="p-4 w-40 cursor-pointer hover:bg-[#E8E0D5] transition-colors group"
                                onClick={() => handleSort("createdAt")}
                            >
                                <div className="flex items-center gap-1">
                                    Date Created
                                    <ArrowUpDown size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortBy === "createdAt" ? "opacity-100 text-[#2D241E]" : ""}`} />
                                </div>
                            </th>
                            
                            <th className="p-4">Name & ID</th>
                            <th className="p-4">Final Status</th>
                            
                            <th 
                                className="p-4 w-1/4 cursor-pointer hover:bg-[#E8E0D5] transition-colors group"
                                onClick={() => handleSort("lastActionDate")}
                            >
                                <div className="flex items-center gap-1">
                                    Closed On
                                    <ArrowUpDown size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${sortBy === "lastActionDate" ? "opacity-100 text-[#2D241E]" : ""}`} />
                                </div>
                            </th>

                            <th className="p-4 w-1/3">Closing Remark</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E0D5]">
                        {loading ? ( <tr><td colSpan={5} className="p-12 text-center text-[#8C7B6C]">Loading data...</td></tr> ) : 
                        filteredList.length === 0 ? ( <tr><td colSpan={5} className="p-12 text-center text-[#8C7B6C]">No data found for this month.</td></tr> ) : (
                            filteredList.map((enq) => (
                                <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] transition-colors group cursor-pointer">
                                    <td className="p-4 text-sm font-medium text-[#4A4036]">{formatDate(enq.createdAt)}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-[#2D241E]">{enq.name}</div>
                                        <div className="text-xs font-mono text-[#8C7B6C] mt-0.5">{enq.enqId}</div>
                                    </td>
                                    <td className="p-4">{getStatusBadge(enq.status)}</td>
                                    
                                    <td className="p-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 shrink-0 ${enq.status === 'JOINED' ? 'text-[#5D7352]' : 'text-[#8C7B6C]'}`}>
                                                {enq.status === 'JOINED' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-[#2D241E]">{formatDate(enq.lastActionDate, "dd MMM yyyy")}</div>
                                                <div className="text-xs text-[#8C7B6C] mt-0.5">{enq.status === 'JOINED' ? "Conversion Date" : "Closure Date"}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="text-sm text-[#4A4036] italic line-clamp-2">
                                            "{enq.lastRemark || "No closing remark"}"
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
            />
        )}
    </div>
  );
}