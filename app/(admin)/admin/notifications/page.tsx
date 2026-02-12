"use client";

import { useState, useEffect } from "react";
import { 
  Send, 
  Bell, 
  ArrowLeft,
  User,
  CheckCheck
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  where, 
  addDoc, 
  Timestamp,
  doc,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { format } from "date-fns";
import EnquiryActionCard from "@/components/EnquiryActionCard";

export default function AdminNotificationsPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();

  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [srms, setSrms] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  
  // Popup States
  const [selectedEnquiryForPopup, setSelectedEnquiryForPopup] = useState<any | null>(null);

  // Form States
  const [selectedSrm, setSelectedSrm] = useState("");
  const [selectedEnquiry, setSelectedEnquiry] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  // --- 🛡️ THE BOUNCER ---
  useEffect(() => {
    if (loading) return;
    if (!appUser) {
      router.replace("/login");
      return;
    }
  }, [appUser, loading, router]);

  // --- 📡 DATA FETCHING ---

  // 1. Listen for Notifications from SRMs
  useEffect(() => {
    const q = query(collection(db, "admin_notifications"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(docs);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch SRMs for dropdown
  useEffect(() => {
    const fetchSrms = async () => {
      const q = query(collection(db, "srms"), where("status", "==", "ACTIVE"));
      const snap = await getDocs(q);
      setSrms(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    };
    fetchSrms();
  }, []);

  // 3. Fetch Enquiries when SRM is selected (Excluding JOINED and NOT_JOINING)
  useEffect(() => {
    if (!selectedSrm) {
      setEnquiries([]);
      return;
    }
    const fetchEnquiries = async () => {
      const q = query(
        collection(db, "enquiries"), 
        where("srmId", "==", selectedSrm),
        // Filter out completed/closed statuses
        where("status", "not-in", ["JOINED", "NOT_JOINING"])
      );
      const snap = await getDocs(q);
      setEnquiries(snap.docs.map(d => ({ 
        id: d.id, 
        name: d.data().name, 
        enqId: d.data().enqId 
      })));
    };
    fetchEnquiries();
  }, [selectedSrm]);

  const handleMarkAllRead = async () => {
    // Only mark incoming messages (not outgoing) that are currently unread
    const unread = notifications.filter(n => !n.read && n.direction !== "outgoing");
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(note => {
      const ref = doc(db, "admin_notifications", note.id);
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

    try {
      const enqRef = doc(db, "enquiries", note.enquiryId);
      const enqSnap = await getDoc(enqRef);

      if (enqSnap.exists()) {
        setSelectedEnquiryForPopup({ id: enqSnap.id, ...enqSnap.data() });
      } else {
        alert("Enquiry details not found.");
      }

      // Also mark this specific notification as read if it isn't already
      if (!note.read && note.direction !== "outgoing") {
        await writeBatch(db).update(doc(db, "admin_notifications", note.id), { read: true }).commit();
      }
    } catch (error) {
      console.error("Error fetching enquiry:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedSrm || !messageText) return alert("Select SRM and type a message");
    
    setSending(true);
    try {
      const selectedEnqData = enquiries.find(e => e.id === selectedEnquiry);
      const selectedSrmData = srms.find(s => s.id === selectedSrm);
      const batch = writeBatch(db);

      // Write 1: To srm_notifications
      const srmNoteRef = doc(collection(db, "srm_notifications"));
      batch.set(srmNoteRef, {
        srmId: selectedSrm,
        enquiryId: selectedEnquiry || null,
        enquiryName: selectedEnqData?.name || null,
        type: "message",
        message: messageText,
        fromName: appUser?.name || "Admin", 
        createdAt: Timestamp.now(),
        read: false
      });

      // Write 2: To admin_notifications
      const adminNoteRef = doc(collection(db, "admin_notifications"));
      batch.set(adminNoteRef, {
        srmId: selectedSrm,
        srmName: selectedSrmData?.name || "SRM",
        enquiryId: selectedEnquiry || null,
        enquiryName: selectedEnqData?.name || null,
        type: "message",
        message: messageText,
        direction: "outgoing",
        createdAt: Timestamp.now(),
        read: true // Sent messages are read by the sender
      });

      await batch.commit();

      setMessageText("");
      setSelectedEnquiry("");
      // CONFIRMATION POPUP REMOVED AS REQUESTED
    } catch (e) {
      console.error(e);
      alert("Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading || !appUser) return null;

  return (
    <div className="h-screen flex flex-col p-4 max-w-5xl mx-auto space-y-6">
      
      {/* Header with Back Button and Mark Read */}
      <div className="flex items-center justify-between border-b border-[#E8E0D5] pb-4 mt-2">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 hover:bg-white rounded-full text-[#8C7B6C] transition-colors">
              <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
              <Bell size={24} className="text-[#C5A880]" />
              <h1 className="text-2xl font-serif font-bold text-[#2D241E]">SRM Notifications</h1>
          </div>
        </div>

        <button 
          onClick={handleMarkAllRead}
          className="flex items-center gap-2 text-xs font-bold text-[#C5A880] hover:text-[#2D241E] transition-colors uppercase tracking-widest bg-white border border-[#E8E0D5] px-4 py-2 rounded-xl shadow-sm"
        >
          <CheckCheck size={16} /> Mark all Read
        </button>
      </div>

      {/* Main Notification Box */}
      <div className="flex-1 bg-white border border-[#E8E0D5] rounded-3xl shadow-sm flex flex-col overflow-hidden mb-4">
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAFAFA]">
          {notifications.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#8C7B6C] italic text-sm">
              No notifications yet.
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
                    className={`p-5 rounded-2xl border shadow-sm max-w-[85%] md:max-w-[70%] transition-all relative
                      ${isOutgoing ? 'bg-[#2D241E] text-white border-[#2D241E]' : 'bg-white text-[#4A4036] border-[#E8E0D5]'}
                      ${!isOutgoing && !note.read ? 'border-[#C5A880] ring-1 ring-[#C5A880]/20' : ''}
                      ${note.enquiryId ? 'cursor-pointer hover:shadow-md' : ''}`}
                  >
                    {!isOutgoing && !note.read && (
                      <div className="absolute top-3 right-3 w-2 h-2 bg-[#C5A880] rounded-full animate-pulse" />
                    )}

                    <div className="flex justify-between items-start mb-2 gap-4">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isOutgoing ? 'text-[#C5A880]' : 'text-[#C5A880]'}`}>
                        {isOutgoing ? `To: ${note.srmName}` : note.srmName}
                      </span>
                      <span className={`text-[10px] ${isOutgoing ? 'text-white/60' : 'text-[#8C7B6C]'}`}>
                        {note.createdAt ? format(note.createdAt.toDate(), "hh:mm a, dd MMM") : ""}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.message}</p>
                    {note.enquiryName && (
                      <div className={`mt-3 text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1 border 
                        ${isOutgoing ? 'bg-white/10 border-white/20 text-white' : 'bg-[#F5F0EB] border-[#E8E0D5] text-[#8C7B6C]'}`}>
                        <User size={10} /> Enquiry: {note.enquiryName}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Input Section */}
        <div className="p-6 border-t border-[#E8E0D5] bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8C7B6C] uppercase ml-1">Send To SRM</label>
                <select 
                  value={selectedSrm}
                  onChange={(e) => setSelectedSrm(e.target.value)}
                  className="w-full bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-[#C5A880]"
                >
                  <option value="">Select SRM Team Member...</option>
                  {srms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8C7B6C] uppercase ml-1">Reference Enquiry (Optional)</label>
                <select 
                  value={selectedEnquiry}
                  onChange={(e) => setSelectedEnquiry(e.target.value)}
                  disabled={!selectedSrm}
                  className="w-full bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-[#C5A880] disabled:opacity-50"
                >
                  <option value="">Select Enquiry...</option>
                  {enquiries.map(e => <option key={e.id} value={e.id}>{e.name} ({e.enqId})</option>)}
                </select>
            </div>
          </div>

          <div className="flex gap-3">
            <textarea 
              placeholder="Type a message to send to the selected SRM..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#C5A880] resize-none h-14"
            />
            <button 
              onClick={handleSendMessage}
              disabled={sending || !selectedSrm || !messageText}
              className="bg-[#2D241E] text-white px-6 rounded-xl hover:bg-[#4A4036] transition-colors disabled:opacity-50 flex items-center justify-center shadow-lg"
            >
              <Send size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Enquiry Action Popup */}
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