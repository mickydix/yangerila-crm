"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link"; 
import { 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy
} from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";
import { isToday, isTomorrow, isBefore, startOfDay } from "date-fns";
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

type BucketType = "DEMO" | "ADMISSION" | "FOLLOWUP" | "BACKLOG";

export default function CardsPage() {
  const { appUser } = useAuth();
  
  const [allEnquiries, setAllEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BucketType>("DEMO");
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // --- 1. Fetch Active Enquiries ---
  useEffect(() => {
    const fetchCards = async () => {
      if (!appUser?.srmId) return;

      setLoading(true);
      try {
        const q = query(
            collection(db, "enquiries"), 
            where("srmId", "==", appUser.srmId),
            where("status", "in", ["CALL_AGAIN", "READY_DEMO", "DEMO_TAKEN", "READY_ADMISSION"]),
            orderBy("nextActionDate", "asc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Enquiry));
        setAllEnquiries(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, [appUser]); 

  // --- 2. Sorting & Segmentation Logic ---
  const buckets = useMemo(() => {
      const todayStart = startOfDay(new Date());
      
      const demoList: Enquiry[] = [];
      const admissionList: Enquiry[] = [];
      const followupList: Enquiry[] = [];
      const backlogList: Enquiry[] = [];

      allEnquiries.forEach(enq => {
          const lastActionDate = enq.lastActionDate?.toDate ? enq.lastActionDate.toDate() : null;
          if (lastActionDate && isToday(lastActionDate)) return; 

          const date = enq.nextActionDate?.toDate ? enq.nextActionDate.toDate() : null;
          
          if (enq.status === "READY_DEMO") {
              if (date && (isBefore(date, todayStart) || isToday(date) || isTomorrow(date))) {
                  demoList.push(enq);
              }
              return;
          }
          if (enq.status === "READY_ADMISSION") {
              admissionList.push(enq);
              return;
          }
          if (enq.status === "DEMO_TAKEN") {
              admissionList.push(enq);
              return;
          }
          if (enq.status === "CALL_AGAIN" && date && !isBefore(date, todayStart)) {
              followupList.push(enq);
              return;
          }
          if (enq.status === "CALL_AGAIN" && date && isBefore(date, todayStart)) {
              backlogList.push(enq);
              return;
          }
      });

      const sortWithRotation = (list: Enquiry[], scoreFn?: (e: Enquiry) => number) => {
          return list.sort((a, b) => {
              const indexA = skippedIds.indexOf(a.id);
              const indexB = skippedIds.indexOf(b.id);
              
              const isSkippedA = indexA !== -1;
              const isSkippedB = indexB !== -1;

              if (!isSkippedA && isSkippedB) return -1;
              if (isSkippedA && !isSkippedB) return 1;

              if (isSkippedA && isSkippedB) {
                  return indexA - indexB;
              }

              if (scoreFn) {
                  return scoreFn(a) - scoreFn(b);
              } else {
                  const dateA = a.nextActionDate?.toMillis() || 0;
                  const dateB = b.nextActionDate?.toMillis() || 0;
                  return dateA - dateB;
              }
          });
      };

      sortWithRotation(demoList, (e) => {
           const d = e.nextActionDate?.toDate();
           if (d && isToday(d)) return 0; 
           if (d && isTomorrow(d)) return 1; 
           return 2; 
      });

      sortWithRotation(admissionList, (e) => {
          if (e.status === "READY_ADMISSION" && !e.linkSent) return 0;
          if (e.status === "DEMO_TAKEN") return 1;
          return 2;
      });

      sortWithRotation(followupList, (e) => e.nextActionDate?.toMillis() || 0);
      sortWithRotation(backlogList, (e) => e.nextActionDate?.toMillis() || 0);

      return { DEMO: demoList, ADMISSION: admissionList, FOLLOWUP: followupList, BACKLOG: backlogList };
  }, [allEnquiries, skippedIds]); 

  // --- 3. Interaction Handlers ---
  const handleUpdate = (updatedEnquiry: Enquiry) => {
      setAllEnquiries(prev => prev.filter(e => e.id !== updatedEnquiry.id));
      setSkippedIds(prev => prev.filter(id => id !== updatedEnquiry.id));
  };

  const handleSkip = () => {
      const currentList = buckets[activeTab];
      if (currentList.length === 0) return;
      const cardToSkip = currentList[0];
      setSkippedIds(prev => {
          const others = prev.filter(id => id !== cardToSkip.id);
          return [...others, cardToSkip.id];
      });
  };

  const getBadgeLabel = (enq: Enquiry) => {
      const date = enq.nextActionDate?.toDate ? enq.nextActionDate.toDate() : null;
      const todayStart = startOfDay(new Date());

      if (enq.status === "READY_DEMO") {
          if (date && isToday(date)) return "📞 Call for Demo Class Today";
          if (date && isTomorrow(date)) return "⚠️ Remind for Demo Class Tomorrow";
          if (date && isBefore(date, todayStart)) return "📝 Update or Reschedule"; 
      }

      if (enq.status === "READY_ADMISSION") {
          if (!enq.linkSent) return "📩 Send Invitation"; 
          return "📝 Convince to Fill Form";
      }
      if (enq.status === "DEMO_TAKEN") return "🤝 Convince to Join Academy";

      if (enq.status === "CALL_AGAIN") {
          return "🗣️ Convince to Take Demo Class";
      }
      
      return "Action Required";
  };

  const currentCard = buckets[activeTab][0]; 

  if (loading) return (
      <div className="flex h-[100dvh] items-center justify-center text-[#8C7B6C] bg-[#F5F0EB] animate-pulse font-serif italic">
          Loading cards...
      </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F5F0EB] font-sans text-[#4A4036] overflow-hidden">
        
        {/* --- 1. Top Section --- */}
        <div className="shrink-0 pt-6 pb-4 px-4 space-y-4 flex flex-col items-center w-full max-w-xl mx-auto z-10">
            
            {/* Header */}
            <div className="flex items-center gap-4 w-full justify-center relative">
                <Link href="/srm" className="absolute left-0 p-2 rounded-full hover:bg-[#E8E0D5] text-[#4A4036] transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-serif font-bold text-[#2D241E]">Cards</h1>
            </div>

            {/* Filter Tabs (Horizontal Scroll) */}
            <div className="w-full overflow-x-auto no-scrollbar">
                <div className="flex gap-2 min-w-max px-1 justify-center">
                    <button 
                        onClick={() => setActiveTab("DEMO")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border
                            ${activeTab === "DEMO" 
                                ? "bg-[#2D241E] text-white border-[#2D241E] shadow-md" 
                                : "bg-transparent text-[#8C7B6C] border-[#C5A880]/30 hover:bg-[#E8E0D5]"}`}
                    >
                        Demo <span className="opacity-70 text-[10px]">({buckets.DEMO.length})</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab("ADMISSION")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border
                            ${activeTab === "ADMISSION" 
                                ? "bg-[#2D241E] text-white border-[#2D241E] shadow-md" 
                                : "bg-transparent text-[#8C7B6C] border-[#C5A880]/30 hover:bg-[#E8E0D5]"}`}
                    >
                        Admission <span className="opacity-70 text-[10px]">({buckets.ADMISSION.length})</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab("FOLLOWUP")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border
                            ${activeTab === "FOLLOWUP" 
                                ? "bg-[#2D241E] text-white border-[#2D241E] shadow-md" 
                                : "bg-transparent text-[#8C7B6C] border-[#C5A880]/30 hover:bg-[#E8E0D5]"}`}
                    >
                        Follow Up <span className="opacity-70 text-[10px]">({buckets.FOLLOWUP.length})</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab("BACKLOG")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border
                            ${activeTab === "BACKLOG" 
                                ? "bg-[#8C3A3A] text-white border-[#8C3A3A] shadow-md" 
                                : "bg-transparent text-[#8C7B6C] border-[#C5A880]/30 hover:bg-[#E8E0D5]"}`}
                    >
                        Backlog <span className="opacity-70 text-[10px]">({buckets.BACKLOG.length})</span>
                    </button>
                </div>
            </div>
        </div>

        {/* --- 2. Card Area (Maximized) --- */}
        <div className="flex-1 min-h-0 p-2 md:p-4 flex flex-col items-center justify-center w-full max-w-xl mx-auto">
            
            {currentCard ? (
                <div className="h-full w-full flex flex-col animate-in slide-in-from-bottom-4 duration-500 rounded-3xl overflow-hidden shadow-2xl">
                    <EnquiryActionCard 
                        key={currentCard.id}
                        enquiry={currentCard}
                        onClose={handleSkip} 
                        onUpdate={handleUpdate}
                        isInline={true} 
                        priorityLabel={getBadgeLabel(currentCard)}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 rounded-full bg-[#C5A880]/20 flex items-center justify-center mb-4 text-[#C5A880]">
                        <CheckCircle2 size={40} />
                    </div>

                    {activeTab === "DEMO" ? (
                        <>
                            <h2 className="text-xl font-serif font-bold text-[#2D241E]">All Demos Handled</h2>
                            <p className="text-[#8C7B6C] text-sm mt-2 max-w-xs mx-auto mb-6">
                                Great job! No upcoming demo tasks for now.
                            </p>
                            <Link 
                                href="/srm/enquiries" 
                                className="inline-flex items-center gap-2 text-[#4A4036] font-bold text-sm border-b border-[#C5A880] pb-0.5 hover:text-[#2D241E] transition-all"
                            >
                                View Schedule <ArrowRight size={14} />
                            </Link>
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-serif font-bold text-[#2D241E]">
                                {activeTab === "BACKLOG" ? "Backlog Cleared" : "All Done"}
                            </h2>
                            <p className="text-[#8C7B6C] text-sm mt-2 max-w-xs mx-auto">
                                {activeTab === "BACKLOG" ? "You're caught up." : `No cards in ${activeTab.toLowerCase()} list.`}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>

    </div>
  );
}