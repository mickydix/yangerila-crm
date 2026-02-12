"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Bell,
  Send,
  CheckCheck,
  User
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    Timestamp, 
    query, 
    where, 
    onSnapshot,
    orderBy,
    getDocs,
    addDoc,
    doc,
    writeBatch
} from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard";

export default function SRMNotificationsPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  // Notification & Enquiry States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeEnquiries, setActiveEnquiries] = useState<any[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  
  // Popup States
  const [selectedEnquiryForPopup, setSelectedEnquiryForPopup] = useState<any | null>(null);

  // --- 🛡️ THE BOUNCER ---
  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
  }, [appUser, loading, router]);

  // --- 📡 DATA FETCHING ---

  // 1. Listen for Notifications sent to this SRM
  useEffect(() => {
    if (!appUser?.srmId) return;

    const q = query(
      collection(db, "srm_notifications"), 
      where("srmId", "==", appUser.srmId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(docs);
    });

    return () => unsubscribe();
  }, [appUser]);

  // 2. Fetch Active Enquiries for the "Related Enquiry" dropdown
  useEffect(() => {
    if (!appUser?.srmId) return;

    const fetchEnquiries = async () => {
      const q = query(
        collection(db, "enquiries"), 
        where("srmId", "==", appUser.srmId),
        where("status", "not-in", ["JOINED", "NOT_JOINING"])
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActiveEnquiries(list);
    };

    fetchEnquiries();
  }, [appUser]);

  // --- Handlers ---

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.read && n.direction !== "outgoing");
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(note => {
      const ref = doc(db, "srm_notifications", note.id);
      batch.update(ref, { read: true });
    });

    try {
      await batch.commit();
    } catch (e) {
      console.error("Failed to mark read:", e);
    }
  };

  const handleNotificationClick = async (note: any) => {
    if (!note.enquiryId) return;

    const found = activeEnquiries.find(e => e.id === note.enquiryId);
    if (found) {
        setSelectedEnquiryForPopup(found);
    } else {
        const snap = await getDocs(query(collection(db, "enquiries"), where("enqId", "==", note.enquiryId)));
        if (!snap.empty) {
            setSelectedEnquiryForPopup({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
    }
    
    if (!note.read && note.direction !== "outgoing") {
        await writeBatch(db).update(doc(db, "srm_notifications", note.id), { read: true }).commit();
    }
  };

  const handleSendMessage = async () => {
    if (!messageText) return alert("Please type a message");
    
    setSending(true);
    try {
      const selectedEnqData = activeEnquiries.find(e => e.id === selectedEnquiry);
      const batch = writeBatch(db);

      // 1. Write to admin_notifications (for the Admin to see)
      const adminNoteRef = doc(collection(db, "admin_notifications"));
      batch.set(adminNoteRef, {
        srmId: appUser?.srmId || "Unknown",
        srmName: appUser?.name || "SRM",
        enquiryId: selectedEnquiry || null,
        enquiryName: selectedEnqData?.name || null,
        message: messageText,
        type: "message",
        createdAt: Timestamp.now(),
        read: false
      });

      // 2. Write to srm_notifications (so SRM sees it in their own history)
      const srmNoteRef = doc(collection(db, "srm_notifications"));
      batch.set(srmNoteRef, {
        srmId: appUser?.srmId || "Unknown",
        enquiryId: selectedEnquiry || null,
        enquiryName: selectedEnqData?.name || null,
        type: "message",
        message: messageText,
        fromName: appUser?.name || "SRM",
        direction: "outgoing", 
        createdAt: Timestamp.now(),
        read: true 
      });

      await batch.commit();

      setMessageText("");
      setSelectedEnquiry("");
      // Alert removed as requested

    } catch (e) {
      console.error(e);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading || !appUser) return null;

  return (
    <div className="h-screen flex flex-col p-4 max-w-4xl mx-auto space-y-6">
      
      {/* 1. Header with Back Button and Mark Read */}
      <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-4 mt-2">
          <div className="flex items-center gap-4">
            <Link href="/srm" className="p-2 hover:bg-[#F5F0EB] rounded-full text-[#8C7B6C] transition-colors">
                <ArrowLeft size={24} />
            </Link>
            <div className="flex items-center gap-2">
                <Bell size={24} className="text-[#C5A880]" />
                <h1 className="text-2xl font-serif font-bold text-[#2D241E]">Admin Messages</h1>
            </div>
          </div>
          
          <button 
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-xs font-bold text-[#C5A880] hover:text-[#2D241E] transition-colors uppercase tracking-widest bg-white border border-[#E8E0D5] px-4 py-2 rounded-xl shadow-sm"
          >
            <CheckCheck size={16} /> Mark all Read
          </button>
      </div>

      {/* 2. Message Feed (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA] rounded-2xl border border-[#E8E0D5]">
        {notifications.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#8C7B6C] italic text-sm">
            No messages yet.
          </div>
        ) : (
          notifications.map((note) => {
            const isOutgoing = note.direction === "outgoing";
            
            return (
              <div 
                  key={note.id} 
                  onClick={() => handleNotificationClick(note)}
                  className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
              >
                <div 
                    className={`p-5 rounded-2xl border transition-all relative cursor-pointer shadow-sm max-w-[90%] md:max-w-[75%] 
                        ${isOutgoing ? 'bg-[#2D241E] text-white border-[#2D241E]' : 'bg-white text-[#4A4036] border-[#E8E0D5]'}
                        ${!isOutgoing && !note.read ? 'ring-1 ring-[#C5A880]/20 border-[#C5A880]' : ''}
                        ${note.enquiryId ? 'hover:scale-[1.01] hover:shadow-md' : ''}`}
                >
                  {!isOutgoing && !note.read && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-[#C5A880] rounded-full animate-pulse" />
                  )}
                  
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isOutgoing ? 'text-[#C5A880]' : 'text-[#C5A880]'}`}>
                      {isOutgoing ? 'To: Admin' : `FROM: ${note.fromName}`}
                    </span>
                    <span className={`text-[10px] ${isOutgoing ? 'text-white/60' : 'text-[#8C7B6C]'}`}>
                      {note.createdAt ? format(note.createdAt.toDate(), "hh:mm a, dd MMM") : ""}
                    </span>
                  </div>
                  
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.message}</p>
                  
                  {note.enquiryName && (
                    <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold px-2 py-1 rounded-lg border 
                        ${isOutgoing ? 'bg-white/10 border-white/20 text-white' : 'bg-[#F5F0EB] border-[#E8E0D5] text-[#8C7B6C]'}`}>
                        <User size={12} /> STUDENT: {note.enquiryName}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Bottom Bar (Message Sending) */}
      <div className="bg-white p-6 border border-[#E8E0D5] rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[#8C7B6C] uppercase mb-1 ml-1">Related Enquiry</label>
            <select 
                value={selectedEnquiry}
                onChange={(e) => setSelectedEnquiry(e.target.value)}
                className="w-full bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-[#C5A880]"
            >
                <option value="">Select Student (Optional)...</option>
                {activeEnquiries.map(e => <option key={e.id} value={e.id}>{e.name} ({e.enqId})</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <textarea 
            placeholder="Type your reply or update for Admin..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1 bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#C5A880] resize-none h-12"
          />
          <button 
            onClick={handleSendMessage}
            disabled={sending || !messageText.trim()}
            className="bg-[#2D241E] text-white px-6 rounded-xl hover:bg-[#4A4036] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md h-12"
          >
            <Send size={20} />
            <span className="font-bold text-sm">Send</span>
          </button>
        </div>
      </div>

      {/* 4. Popup Card */}
      {selectedEnquiryForPopup && (
        <EnquiryActionCard 
            enquiry={selectedEnquiryForPopup}
            onClose={() => setSelectedEnquiryForPopup(null)}
            onUpdate={() => {}} 
        />
      )}
    </div>
  );
}