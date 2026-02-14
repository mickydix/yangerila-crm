"use client";

import { useState, useEffect } from "react";
import { 
  Phone, 
  MessageCircle, 
  Clock, 
  X, 
  Save, 
  History, 
  ArrowLeft,
  Mail,
  CheckCircle,
  CalendarDays,
  BarChart3,
  RefreshCcw
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    getDocs, 
    orderBy, 
    doc, 
    Timestamp, 
    writeBatch,
    where,
    getCountFromServer,
    addDoc,
    deleteDoc
} from "firebase/firestore";
import { format, differenceInDays } from "date-fns";
import { useAuth } from "@/lib/useAuth";

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
  srmName?: string; 
  srmId?: string; // Ensure srmId is available
};

type HistoryItem = {
    id: string;
    action: string;
    remark: string;
    date: any;
    status: string;
    by: string;
};

// --- Config (Earth Tones) ---
const STATUS_CONFIG = [
    { label: "Follow Up", value: "CALL_AGAIN", headerBg: "bg-[#C5A880]", light: "bg-[#FEF9C3] text-[#854D0E]", border: "border-[#FDE047]", dot: "bg-[#C5A880]" },
    { label: "Ready for Demo", value: "READY_DEMO", headerBg: "bg-[#8C7B6C]", light: "bg-[#E0F2FE] text-[#075985]", border: "border-[#BAE6FD]", dot: "bg-[#8C7B6C]" },
    { label: "Demo Taken", value: "DEMO_TAKEN", headerBg: "bg-[#6B5B50]", light: "bg-[#F5F3FF] text-[#5B21B6]", border: "border-[#DDD6FE]", dot: "bg-[#6B5B50]" },
    { label: "Ready for Admission", value: "READY_ADMISSION", headerBg: "bg-[#7D9D75]", light: "bg-[#DCFCE7] text-[#166534]", border: "border-[#BBF7D0]", dot: "bg-[#7D9D75]" },
    { label: "Joined", value: "JOINED", headerBg: "bg-[#2D241E]", light: "bg-[#E8F2F2] text-[#2D241E]", border: "border-[#2D241E]", dot: "bg-[#2D241E]" },
    { label: "Not Joining", value: "NOT_JOINING", headerBg: "bg-[#9E9085]", light: "bg-[#F0EBE8] text-[#70645C]", border: "border-[#D6CCC6]", dot: "bg-[#9E9085]" },
];

const INTENT_LEVELS = ["Low (Not Interested)", "Medium (Maybe Later)", "High (Future Prospect)"];

interface Props {
    enquiry: Enquiry;
    onClose: () => void;
    onUpdate: (updatedEnquiry: Enquiry) => void;
    isInline?: boolean;
    priorityLabel?: string;
}

export default function EnquiryActionCard({ enquiry, onClose, onUpdate, isInline = false, priorityLabel }: Props) {
    const { appUser } = useAuth();
    
    // UI State
    const [showHistory, setShowHistory] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    // Form Inputs
    const [formAction, setFormAction] = useState("Called");
    const [formRemark, setFormRemark] = useState("");
    const [formStatus, setFormStatus] = useState(enquiry.status);
    
    // Specific Status States
    const [formLinkSent, setFormLinkSent] = useState(enquiry.linkSent || false);
    const [formIntentLevel, setFormIntentLevel] = useState(INTENT_LEVELS[0]);

    const [formNextDate, setFormNextDate] = useState(""); 
    const [formNextTime, setFormNextTime] = useState(""); // Added for demo time
    const [formNextAction, setFormNextAction] = useState("Call back");
    const [formEmail, setFormEmail] = useState("");

    // --- 🛡️ SAME AS BEFORE LOGIC ---
    const [useSameAsBefore, setUseSameAsBefore] = useState(false);

    // Helper for 12-hour formatting
    const formatTimeTo12h = (time24: string) => {
        if (!time24) return "";
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    useEffect(() => {
        if (useSameAsBefore) {
            setFormNextAction(enquiry.nextAction || "Call back");
            if (enquiry.nextActionDate) {
                const dateObj = enquiry.nextActionDate.toDate();
                setFormNextDate(format(dateObj, "yyyy-MM-dd"));
                if (enquiry.nextAction === "Demo class date") {
                    setFormNextTime(format(dateObj, "HH:mm"));
                }
            }
        }
    }, [useSameAsBefore, enquiry]);

    // Redesign logic: Auto-update Next Action text based on status
    useEffect(() => {
        if (formStatus === "READY_DEMO") {
            setFormNextAction("Demo class date");
        } else {
            setFormNextAction("Call back");
        }
    }, [formStatus]);

    // --- Helpers ---
    const getEnquiryAge = (createdAt: any) => createdAt ? differenceInDays(new Date(), createdAt.toDate()) : 0;
    const formatDate = (ts: any, fmt: string = "dd MMM") => ts ? format(ts.toDate(), fmt) : "--";
    const getCardConfig = (status: string) => STATUS_CONFIG.find(s => s.value === status) || STATUS_CONFIG[0];

    // --- Actions ---
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const q = query(collection(db, "enquiries", enquiry.id, "timeline"), orderBy("date", "desc"));
            const snap = await getDocs(q);
            setHistoryList(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryItem)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleToggleHistory = () => {
        if (!showHistory) fetchHistory();
        setShowHistory(!showHistory);
    };

    const handleSave = async () => {
        // Validation
        if (!formRemark && formStatus !== "NOT_JOINING" && formStatus !== "JOINED" && !formLinkSent) return alert("Please enter a remark.");
        
        // Date Validation
        if (formStatus !== "NOT_JOINING" && formStatus !== "JOINED" && formStatus !== "READY_ADMISSION") {
            if (!formNextDate) return alert("Please select a date.");
        }

        setSaving(true);
        try {
            const now = Timestamp.now();

            // Combine Date and Optional Time
            let combinedDate = formNextDate ? new Date(formNextDate) : null;
            if (combinedDate && formNextTime) {
                const [hours, mins] = formNextTime.split(":").map(Number);
                combinedDate.setHours(hours, mins);
            }
            const nextDateTs = combinedDate ? Timestamp.fromDate(combinedDate) : null;
            
            const batch = writeBatch(db);

            // --- 1. Start with User's Remark ---
            let finalRemark = formRemark;
            
            // --- 2. Compare Statuses ---
            if (enquiry.status !== formStatus) {
                const oldLabel = STATUS_CONFIG.find(s => s.value === enquiry.status)?.label || enquiry.status;
                const newLabel = STATUS_CONFIG.find(s => s.value === formStatus)?.label || formStatus;
                finalRemark += ` (Status: ${oldLabel} ➝ ${newLabel})`;
            }

            let linkSentUpdate = formLinkSent;
            let nextActionText = formNextAction;

            // --- 3. Handle Not Joining (Intent Level) ---
            if (formStatus === "NOT_JOINING") {
                finalRemark += ` (Intent: ${formIntentLevel})`;
            }

            // --- 🛡️ NEW CLEANUP LOGIC: Remove from Admissions if status changes ---
            if (enquiry.status === "READY_ADMISSION" && formStatus !== "READY_ADMISSION" && formStatus !== "JOINED") {
                const studentQuery = query(
                    collection(db, "students"), 
                    where("enquiryId", "==", enquiry.id), 
                    where("status", "==", "NEW")
                );
                const studentSnap = await getDocs(studentQuery);
                studentSnap.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                linkSentUpdate = false;
            }

            // --- 4. Handle Admission Logic ---
            if (formStatus === "READY_ADMISSION") {
                nextActionText = "Onboard Student"; 
                
                if (formLinkSent && !enquiry.linkSent) {
                    const today = new Date();
                    const yearLastDigit = today.getFullYear().toString().slice(-1);
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    
                    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
                    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

                    const countQ = query(
                        collection(db, "students"),
                        where("joiningDate", ">=", Timestamp.fromDate(startOfDay)),
                        where("joiningDate", "<=", Timestamp.fromDate(endOfDay))
                    );
                    const snapshot = await getCountFromServer(countQ);
                    const count = snapshot.data().count; 
                    
                    const suffix = String.fromCharCode(65 + count); 
                    const newYcsId = `S${yearLastDigit}${month}${day}${suffix}`; 

                    const newStudentData = {
                        name: enquiry.name,
                        email: formEmail,
                        ycsId: newYcsId, 
                        status: "NEW", 
                        joiningDate: now,
                        phoneNumbers: [{ number: enquiry.phone, label: "Primary", hasWhatsapp: false }],
                        enquiryId: enquiry.id 
                    };

                    const studentRef = doc(collection(db, "students"));
                    batch.set(studentRef, newStudentData);
                    
                    finalRemark = formRemark ? `${formRemark} (Pending admission)` : "Pending admission";
                    linkSentUpdate = true;
                }
            }

            if (formNextAction === "Demo class date" && formNextDate) {
                const prettyDate = format(new Date(formNextDate), "dd MMM yyyy");
                const prettyTime = formNextTime ? ` at ${formatTimeTo12h(formNextTime)}` : "";
                finalRemark += ` (Demo Class on ${prettyDate}${prettyTime})`;
            }

            const updateData = {
                status: formStatus,
                lastAction: formAction,
                lastRemark: finalRemark, 
                lastActionDate: now,
                nextAction: nextActionText, 
                nextActionDate: nextDateTs, 
                linkSent: linkSentUpdate 
            };

            const enqRef = doc(db, "enquiries", enquiry.id);
            batch.update(enqRef, updateData);

            const timelineRef = doc(collection(db, "enquiries", enquiry.id, "timeline"));
            batch.set(timelineRef, {
                action: formAction,
                remark: finalRemark,
                date: now,
                status: formStatus,
                by: appUser?.name || "SRM",
                meta: formEmail || null
            });

            // --- 🔔 5. SYSTEM NOTIFICATION TRIGGER ---
            const userRole = appUser?.role?.toUpperCase();
            
            if (userRole === "ADMIN") {
                if (enquiry.srmId) {
                    const srmNoteRef = doc(collection(db, "srm_notifications"));
                    
                    // --- Build Dynamic Admin -> SRM Message ---
                    let adminToSrmMsg = "";
                    if (formStatus === "JOINED") {
                        adminToSrmMsg = `Congrats! Your Enquiry "${enquiry.name}" has taken admission!`;
                    } else {
                        adminToSrmMsg = `${appUser?.name || "Admin"} updated enquiry "${enquiry.name}"\nRemark - "${formRemark || 'No remark'}"`;
                    }

                    batch.set(srmNoteRef, {
                        srmId: enquiry.srmId,
                        enquiryId: enquiry.id,
                        enquiryName: enquiry.name,
                        fromName: appUser?.name || "Admin",
                        type: "system",
                        status: formStatus,
                        message: adminToSrmMsg,
                        createdAt: now,
                        read: false
                    });
                }
            } else if (userRole === "SRM") {
                const adminNoteRef = doc(collection(db, "admin_notifications"));
                
                let srmToAdminMsg = `${appUser?.name || "SRM"} updated enquiry "${enquiry.name}"`;
                if (formStatus === "READY_DEMO" && formNextDate) {
                    const timeStr = formNextTime ? ` at ${formatTimeTo12h(formNextTime)}` : "";
                    srmToAdminMsg += `\nDemo class on ${format(new Date(formNextDate), "dd MMM yyyy")}${timeStr}`;
                } else if (formStatus === "READY_ADMISSION") {
                    srmToAdminMsg += `\nJoining link sent. Check admissions page`;
                } else if (formStatus === "NOT_JOINING") {
                    srmToAdminMsg += `\nNot joining. Intent - ${formIntentLevel}`;
                } else {
                    srmToAdminMsg += `\nStatus: ${STATUS_CONFIG.find(s => s.value === formStatus)?.label}`;
                }

                batch.set(adminNoteRef, {
                    srmId: appUser?.srmId || "Unknown",
                    srmName: appUser?.name || "SRM",
                    enquiryId: enquiry.id,
                    enquiryName: enquiry.name,
                    type: "system",
                    status: formStatus,
                    message: srmToAdminMsg,
                    createdAt: now,
                    read: false
                });
            }

            await batch.commit();
            onUpdate({ ...enquiry, ...updateData });
            onClose();

            if (formStatus === "READY_ADMISSION" && !enquiry.linkSent && formLinkSent) {
                alert("Invitation Sent & Student Created Successfully!");
            }

        } catch (e) {
            console.error(e);
            alert("Failed to save.");
        } finally {
            setSaving(false);
        }
    };

    const handleCloseAttempt = () => {
        if (formRemark && !confirmClose) {
            setConfirmClose(true);
        } else {
            onClose();
        }
    };

    const config = getCardConfig(formStatus);

    const wrapperClasses = isInline 
        ? "w-full h-full flex flex-col" 
        : "fixed inset-0 z-50 flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in";

    const cardClasses = isInline
        ? "bg-[#FDFDFD] w-full rounded-2xl shadow-sm overflow-hidden flex flex-col border border-[#E8E0D5] h-full" 
        : "bg-[#FDFDFD] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 h-[650px] max-h-[90vh] border border-[#E8E0D5]";

    return (
        <div className={wrapperClasses}>
            <div className={cardClasses}>
                
                {/* Header */}
                <div className={`${getCardConfig(enquiry.status).headerBg} px-6 py-5 flex justify-between items-center text-white shadow-sm shrink-0 transition-colors duration-300`}>
                    <div className="flex items-center gap-2">
                        {showHistory ? (
                            <button onClick={() => setShowHistory(false)} className="flex items-center gap-1.5 font-bold text-sm hover:opacity-80"><ArrowLeft size={18} /> Back</button>
                        ) : (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    {enquiry.status === 'JOINED' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    <span className="font-bold text-base tracking-wide uppercase font-serif">{getCardConfig(enquiry.status).label}</span>
                                </div>
                                {priorityLabel && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-90 bg-black/20 px-2 py-0.5 rounded w-fit mt-1">
                                        {priorityLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={handleCloseAttempt} className="opacity-80 hover:opacity-100 p-1.5 rounded-full hover:bg-white/20 transition-all">
                        {isInline ? <span className="text-xs font-bold uppercase tracking-wider border border-white/30 px-2.5 py-1 rounded">Skip</span> : <X size={22} />}
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-6 overflow-y-auto flex-1 bg-[#FDFDFD]">
                    
                    {showHistory ? (
                        <div className="space-y-5">
                            <h3 className="font-serif font-bold text-[#2D241E] text-base">Activity Log</h3>
                            {loadingHistory ? <p className="text-center text-sm text-[#8C7B6C] animate-pulse">Loading...</p> : (
                                <div className="relative border-l border-[#E8E0D5] ml-2 space-y-5">
                                    {historyList.map(item => {
                                        const itemConfig = STATUS_CONFIG.find(s => s.value === item.status);
                                        return (
                                            <div key={item.id} className="relative pl-5">
                                                <div className={`absolute -left-[4px] top-1.5 w-2 h-2 rounded-full border border-white ring-1 ring-[#E8E0D5] ${itemConfig?.dot || "bg-gray-400"}`} />
                                                <div className="flex justify-between items-baseline mb-1 pr-1">
                                                    <div className="text-xs font-bold text-[#8C7B6C] uppercase tracking-wider">{formatDate(item.date, "dd MMM")}</div>
                                                    <div className="text-xs font-bold text-[#C5A880]">{item.by || "SRM"}</div>
                                                </div>
                                                <div className="bg-[#F9F7F5] p-3 rounded-xl text-sm border border-[#E8E0D5]">
                                                    <div className="font-bold text-[#4A4036] flex justify-between mb-1">
                                                        <span>{item.action}</span>
                                                    </div>
                                                    <p className="text-[#4A4036] italic leading-snug">"{item.remark}"</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                    <>
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-[#2D241E] leading-tight">{enquiry.name}</h2>
                                <p className="text-sm text-[#8C7B6C] font-mono tracking-wide mt-0.5">{enquiry.phone}</p>
                            </div>
                            <span className="text-xs font-bold text-[#8C7B6C] uppercase bg-[#F5F0EB] px-2 py-1 rounded border border-[#E8E0D5]">{getEnquiryAge(enquiry.createdAt)}d Old</span>
                        </div>

                        <div className="bg-[#F9F7F5] rounded-xl p-4 border border-[#E8E0D5]">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#8C7B6C] uppercase mb-2 tracking-wider">
                                <Clock size={14} />
                                <span>{enquiry.lastAction}</span>
                                <span className="text-[#E8E0D5]">•</span>
                                <span>{formatDate(enquiry.lastActionDate)}</span>
                            </div>
                            <p className="text-[#4A4036] italic text-sm leading-snug border-l-2 border-[#C5A880] pl-3 line-clamp-3">"{enquiry.lastRemark}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <a href={`tel:${enquiry.phone}`} className="flex items-center justify-center gap-2 bg-[#2D241E] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#4A4036] transition shadow-sm active:scale-95">
                                <Phone size={16} /> Call
                            </a>
                            <a href={`https://wa.me/${enquiry.phone}`} target="_blank" className="flex items-center justify-center gap-2 bg-[#F5F0EB] text-[#4A4036] border border-[#E8E0D5] py-3 rounded-xl font-bold text-sm hover:bg-[#E8E0D5]/80 transition shadow-sm active:scale-95">
                                <MessageCircle size={16} /> WhatsApp
                            </a>
                        </div>

                        <div className="border-t border-[#E8E0D5] my-1"></div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1.5 ml-1">Action</label>
                                    <select 
                                        value={formAction} 
                                        onChange={e => setFormAction(e.target.value)}
                                        className="w-full p-3 bg-[#F5F0EB] rounded-xl font-bold text-sm text-[#4A4036] outline-none focus:ring-1 focus:ring-[#C5A880] transition-all appearance-none"
                                    >
                                        <option>Called</option>
                                        <option>Sent Message</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1.5 ml-1">New Status</label>
                                    <select 
                                        value={formStatus} 
                                        onChange={e => setFormStatus(e.target.value as any)}
                                        className={`w-full p-3 rounded-xl font-bold text-sm text-[#4A4036] outline-none border focus:ring-0 ${config.light} ${config.border}`}
                                    >
                                        {STATUS_CONFIG.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1.5 ml-1">Remark</label>
                                <textarea 
                                    value={formRemark}
                                    onChange={e => setFormRemark(e.target.value)}
                                    placeholder="What happened?"
                                    className="w-full p-3 bg-[#F5F0EB] rounded-xl text-sm text-[#4A4036] outline-none focus:ring-1 focus:ring-[#C5A880] resize-none h-24 placeholder:text-[#B0A090]"
                                />
                            </div>
                        </div>

                        <div className="animate-in slide-in-from-top-2 duration-300">
                            {formStatus === "READY_ADMISSION" ? (
                                <div className="space-y-4">
                                    <div className="space-y-1.5 bg-[#EFF5EC] p-4 rounded-xl border border-[#CAD9C3]">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={formLinkSent}
                                                    onChange={(e) => setFormLinkSent(e.target.checked)}
                                                    className="peer w-6 h-6 border-2 border-[#8CA67E] rounded-md bg-white checked:bg-[#5D7352] checked:border-[#5D7352] appearance-none transition-all cursor-pointer"
                                                />
                                                <CheckCircle size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="block text-sm font-bold text-[#5D7352] group-hover:text-[#4A5D41] transition-colors">
                                                    Admission & Payment Links Sent
                                                </span>
                                                <span className="text-xs text-[#8C7B6C]">
                                                    Check this box only after sending details.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1.5 ml-1">Student Email (Optional)</label>
                                        <input 
                                            type="email"
                                            value={formEmail}
                                            onChange={e => setFormEmail(e.target.value)}
                                            placeholder="rahul@example.com"
                                            className="w-full p-3 bg-[#F5F0EB] rounded-xl text-sm text-[#4A4036] outline-none focus:ring-1 focus:ring-[#C5A880]"
                                        />
                                    </div>
                                </div>
                            ) : formStatus === "NOT_JOINING" ? (
                                <div className="space-y-1.5 bg-[#F0EBE8] p-4 rounded-xl border border-[#D6CCC6]">
                                    <label className="flex items-center gap-2 text-xs font-bold text-[#70645C] uppercase tracking-wider mb-1">
                                        <BarChart3 size={14} /> Intent Level
                                    </label>
                                    <select 
                                        value={formIntentLevel}
                                        onChange={e => setFormIntentLevel(e.target.value)}
                                        className="w-full p-2.5 bg-white/50 border border-[#D6CCC6] rounded-lg text-sm text-[#4A4036] font-medium outline-none focus:bg-white transition-all"
                                    >
                                        {INTENT_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                                    </select>
                                </div>
                            ) : formStatus === "JOINED" ? (
                                <div className="p-3 bg-[#E8F2F2] text-[#2D241E] rounded-xl text-sm font-medium text-center border border-[#BED9D8]">Joined! No further action.</div>
                            ) : (
                                <div className={`space-y-3 p-4 rounded-xl border bg-white border-[#E8E0D5]`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-xs font-bold text-[#8C7B6C] uppercase tracking-wider opacity-80">
                                          <CalendarDays size={14} />
                                          <span>Next Step Planning</span>
                                      </div>
                                      <label className="flex items-center gap-2 cursor-pointer group">
                                          <input 
                                              type="checkbox"
                                              checked={useSameAsBefore}
                                              onChange={(e) => setUseSameAsBefore(e.target.checked)}
                                              className="w-3.5 h-3.5 border-2 border-[#E8E0D5] rounded bg-white checked:bg-[#C5A880] checked:border-[#C5A880] appearance-none transition-all cursor-pointer"
                                          />
                                          <span className="text-[10px] font-bold text-[#8C7B6C] group-hover:text-[#4A4036] transition-colors flex items-center gap-1">
                                              <RefreshCcw size={10} className={useSameAsBefore ? "animate-spin-slow" : ""} />
                                              Same as before
                                          </span>
                                      </label>
                                    </div>
                                    
                                    {/* DYNAMIC NEXT STEP UI */}
                                    {formStatus === "READY_DEMO" ? (
                                        <div className="space-y-3">
                                            <div className="text-sm font-bold text-[#4A4036]">Demo class date and time</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <input 
                                                    type="date" 
                                                    value={formNextDate} 
                                                    onChange={e => { setFormNextDate(e.target.value); setUseSameAsBefore(false); }} 
                                                    className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" 
                                                />
                                                <input 
                                                    type="time" 
                                                    value={formNextTime} 
                                                    onChange={e => { setFormNextTime(e.target.value); setUseSameAsBefore(false); }} 
                                                    className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" 
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 items-center">
                                            <div className="p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036]/50 italic">Call back</div>
                                            <input 
                                                type="date" 
                                                value={formNextDate} 
                                                onChange={e => { setFormNextDate(e.target.value); setUseSameAsBefore(false); }} 
                                                className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" 
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white p-5 border-t border-[#E8E0D5] flex items-center justify-between gap-4 shrink-0">
                    <button onClick={handleToggleHistory} className="flex items-center gap-1.5 text-[#8C7B6C] hover:text-[#4A4036] font-bold text-xs uppercase tracking-wide transition-colors">
                        {showHistory ? <><ArrowLeft size={16} /> Back</> : <><History size={16} /> History</>}
                    </button>
                    <div className="flex items-center gap-3 ml-auto">
                        {!isInline && (
                            <button onClick={handleCloseAttempt} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${confirmClose ? "bg-red-50 text-red-600 border border-red-100" : "text-[#8C7B6C] hover:bg-[#F5F0EB]"}`}>
                                {confirmClose ? "Discard?" : "Close"}
                            </button>
                        )}
                        <button 
                            onClick={handleSave} 
                            disabled={saving} 
                            className={`px-6 py-3 text-white rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all active:scale-95 
                                ${formStatus === "READY_ADMISSION" && !enquiry.linkSent ? "bg-[#7D9D75] hover:bg-[#5D7352]" : "bg-[#2D241E] hover:bg-[#4A4036]"}`}
                        >
                            {saving ? "..." : <><Save size={16} /> Save</>}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}