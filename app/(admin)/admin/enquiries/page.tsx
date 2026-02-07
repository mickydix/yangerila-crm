"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Phone, 
  MessageCircle
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  limit
} from "firebase/firestore";
import EnquiryActionCard from "@/components/EnquiryActionCard"; 

type Enquiry = {
  id: string;
  name: string;
  phone: string;
  status: "CALL_AGAIN" | "READY_DEMO" | "DEMO_TAKEN" | "READY_ADMISSION" | "NOT_JOINING" | "JOINED";
  srmName?: string;
  lastRemark: string;
  createdAt: any;
  enqId: string;
  lastAction: string;
  lastActionDate: any;
  nextAction: string;
  nextActionDate: any;
  linkSent?: boolean;
};

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

  useEffect(() => {
    const fetchEnquiries = async () => {
      try {
        // QUERY: Get only ACTIVE statuses
        const q = query(
          collection(db, "enquiries"), 
          where("status", "in", ["CALL_AGAIN", "READY_DEMO", "DEMO_TAKEN", "READY_ADMISSION"]),
          orderBy("createdAt", "desc"), 
          limit(100)
        );
        
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
  }, []);

  const handleEnquiryUpdate = (updated: Enquiry) => {
      // If status changes to Closed, remove from this list immediately
      if (updated.status === "JOINED" || updated.status === "NOT_JOINING") {
          setEnquiries(prev => prev.filter(e => e.id !== updated.id));
      } else {
          setEnquiries(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
      }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "--";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "READY_ADMISSION": return "bg-[#7D9D75] text-white border-[#7D9D75]";
      case "READY_DEMO": return "bg-[#8C7B6C] text-white border-[#8C7B6C]";
      case "CALL_AGAIN": return "bg-[#C5A880] text-white border-[#C5A880]";
      default: return "bg-[#F5F0EB] text-[#8C7B6C] border-[#E8E0D5]";
    }
  };

  const filteredData = filter === "ALL" 
    ? enquiries 
    : enquiries.filter(e => e.status === filter);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#2D241E]">Active Enquiries</h1>
          <p className="text-[#8C7B6C] text-sm">Real-time feed of open cases</p>
        </div>

        <div className="flex gap-3">
           <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#8C7B6C]">
                <Filter size={16} />
              </div>
              <select 
                className="pl-10 pr-4 py-2.5 bg-white border border-[#E8E0D5] rounded-xl text-sm font-bold text-[#4A4036] focus:outline-none focus:border-[#C5A880] appearance-none cursor-pointer shadow-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="CALL_AGAIN">Follow Up</option>
                <option value="READY_DEMO">Ready for Demo</option>
                <option value="READY_ADMISSION">Ready for Admission</option>
              </select>
           </div>
        </div>
      </div>

      <div className="bg-[#FDFDFD] rounded-3xl border border-[#E8E0D5] shadow-sm overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-[#8C7B6C]">Loading records...</div>
        ) : filteredData.length === 0 ? (
           <div className="p-12 text-center text-[#8C7B6C]">No active enquiries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F0EB] text-[#8C7B6C] text-xs uppercase tracking-wider border-b border-[#E8E0D5]">
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Student</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Last Remark</th>
                  <th className="p-4 font-bold text-right">Handled By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {filteredData.map((enq) => (
                  <tr key={enq.id} onClick={() => setSelectedEnquiry(enq)} className="hover:bg-[#F9F7F5] transition-colors group cursor-pointer">
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-[#4A4036] font-medium">
                        <Calendar size={14} className="text-[#C5A880]" />
                        {formatDate(enq.createdAt)}
                      </div>
                      <span className="text-[10px] text-[#8C7B6C] pl-6 block">{enq.enqId}</span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[#2D241E] text-base">{enq.name}</div>
                      <div className="flex items-center gap-2 text-xs text-[#8C7B6C] mt-0.5">
                        <Phone size={12} /> {enq.phone}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(enq.status)}`}>
                        {enq.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 max-w-xs">
                       <div className="flex items-start gap-2">
                          <MessageCircle size={14} className="text-[#C5A880] mt-0.5 shrink-0" />
                          <p className="text-sm text-[#4A4036] line-clamp-2 italic">"{enq.lastRemark || "No remarks"}"</p>
                       </div>
                    </td>
                    <td className="p-4 text-right">
                       <div className="inline-flex items-center gap-2 bg-[#F5F0EB] px-3 py-1.5 rounded-lg border border-[#E8E0D5]">
                          <User size={14} className="text-[#8C7B6C]" />
                          <span className="text-xs font-bold text-[#4A4036]">{enq.srmName || "Unknown"}</span>
                       </div>
                    </td>
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
    </div>
  );
}