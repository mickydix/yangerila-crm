"use client";

import { useState, useEffect } from "react";
import { X, Save, AlertCircle, CalendarDays, RefreshCcw } from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    where, 
    doc, 
    Timestamp, 
    writeBatch, 
    getCountFromServer,
    getDocs
} from "firebase/firestore";
import { format } from "date-fns";

const SOURCES = ["Instagram", "Facebook", "Referral", "Google", "Walk-in", "Justdial", "Other"];
const STATUSES = [
    { label: "Follow Up", value: "CALL_AGAIN" },
    { label: "Ready for Demo", value: "READY_DEMO" },
    { label: "Demo Taken", value: "DEMO_TAKEN" },
    { label: "Ready for Admission", value: "READY_ADMISSION" },
    { label: "Not Joining", value: "NOT_JOINING" },
];

interface SRMSelection {
    id: string;
    name: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newEnquiry: any) => void;
    appUserName: string;
}

export default function AddEnquiryModal({ isOpen, onClose, onSuccess, appUserName }: Props) {
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
        nextAction: "Call back",
        nextActionDate: "",
        nextActionTime: "",
        assignedSRMId: ""
    };
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        const fetchSRMs = async () => {
            const q = query(collection(db, "srms"), where("status", "==", "ACTIVE"));
            const snap = await getDocs(q);
            setAvailableSRMs(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
        };
        if (isOpen) fetchSRMs();
    }, [isOpen]);

    // Redesign logic: Auto-update Next Action text based on status
    useEffect(() => {
        if (form.status === "READY_DEMO") {
            setForm(prev => ({ ...prev, nextAction: "Demo class date" }));
        } else {
            setForm(prev => ({ ...prev, nextAction: "Call back" }));
        }
    }, [form.status]);

    const formatTimeTo12h = (time24: string) => {
        if (!time24) return "";
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    const handleCancel = () => {
        if (form.name && cancelStage === 0) {
            setCancelStage(1);
        } else {
            onClose();
            setForm(initialForm);
            setCancelStage(0);
        }
    };

    const handleSave = async () => {
        if (!form.name || !form.phone || !form.nextActionDate || !form.assignedSRMId) {
            return alert("Please fill Name, Phone, Next Action Date and assign an SRM.");
        }

        setSaving(true);
        try {
            const now = new Date();
            const yearLastDigit = now.getFullYear().toString().slice(-1);
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));
            
            const q = query(
                collection(db, "enquiries"),
                where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
                where("createdAt", "<=", Timestamp.fromDate(endOfDay))
            );
            
            const snapshot = await getCountFromServer(q);
            const count = snapshot.data().count; 
            const suffix = String.fromCharCode(97 + count); 
            const enqId = `Q${yearLastDigit}${month}${day}${suffix}`;

            const selectedSRM = availableSRMs.find(s => s.id === form.assignedSRMId);

            // Combine Date and Time
            let combinedDate = new Date(form.nextActionDate);
            if (form.nextActionTime) {
                const [h, m] = form.nextActionTime.split(":").map(Number);
                combinedDate.setHours(h, m);
            }

            const batch = writeBatch(db);
            const newEnqRef = doc(collection(db, "enquiries"));

            // Format remark for timeline/lastRemark
            let finalRemark = form.remark;
            if (form.nextAction === "Demo class date") {
                const timeStr = form.nextActionTime ? ` at ${formatTimeTo12h(form.nextActionTime)}` : "";
                finalRemark += ` (Demo Class on ${format(combinedDate, "dd MMM yyyy")}${timeStr})`;
            }

            const parentData = {
                name: form.name,
                phone: form.phone,
                source: form.source,
                enqId: enqId,
                status: form.status,
                lastAction: form.action,
                lastActionDate: null, 
                lastRemark: finalRemark,
                nextAction: form.nextAction,
                nextActionDate: Timestamp.fromDate(combinedDate),
                srmId: form.assignedSRMId,
                srmName: selectedSRM?.name || "Unknown",
                createdAt: Timestamp.now(),
            };

            batch.set(newEnqRef, parentData);

            const timelineRef = doc(collection(db, "enquiries", newEnqRef.id, "timeline"));
            batch.set(timelineRef, {
                action: form.action,
                remark: finalRemark,
                date: Timestamp.now(),
                status: form.status,
                by: `Admin (${appUserName})`
            });

            const srmNoteRef = doc(collection(db, "srm_notifications"));
            batch.set(srmNoteRef, {
                srmId: form.assignedSRMId,
                enquiryId: newEnqRef.id,
                enquiryName: form.name,
                fromName: appUserName,
                type: "system",
                status: form.status,
                message: `Admin allotted you a new Enquiry - "${form.name}"`,
                createdAt: Timestamp.now(),
                read: false
            });

            await batch.commit();
            onSuccess({ id: newEnqRef.id, ...parentData });
            setForm(initialForm);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save enquiry.");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#FDFDFD] w-full max-w-lg rounded-xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] overflow-hidden border border-[#E8E0D5]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-serif font-bold text-[#2D241E]">Admin: Add & Assign Lead</h2>
                    <button onClick={handleCancel} className="p-2 hover:bg-[#F5F0EB] text-[#8C7B6C] rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Student Name</label>
                            <input className="w-full border-b border-[#E8E0D5] p-2 outline-none font-serif font-medium text-[#2D241E] focus:border-[#C5A880] transition-colors text-lg bg-transparent" placeholder="e.g. Rahul Sharma" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Phone</label>
                                <input className="w-full border-b border-[#E8E0D5] p-2 outline-none font-medium text-[#4A4036] focus:border-[#C5A880] transition-colors bg-transparent" placeholder="98765..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Source</label>
                                <select className="w-full border-b border-[#E8E0D5] p-2 outline-none bg-transparent font-medium text-[#4A4036] focus:border-[#C5A880]" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#F5F0EB] p-5 rounded-2xl space-y-4 border border-[#E8E0D5]">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#C5A880] uppercase mb-1">Assign to SRM</label>
                                <select className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-white text-[#2D241E] focus:border-[#C5A880]" value={form.assignedSRMId} onChange={e => setForm({...form, assignedSRMId: e.target.value})}>
                                    <option value="">Select SRM...</option>
                                    {availableSRMs.map(srm => <option key={srm.id} value={srm.id}>{srm.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Initial Status</label>
                                <select className="w-full p-2.5 rounded-lg border border-[#E8E0D5] outline-none font-bold text-sm bg-white text-[#2D241E] focus:border-[#C5A880]" value={form.status} onChange={e => setForm({...form, status: e.target.value as any})}>
                                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Admin Remark</label>
                            <textarea className="w-full p-3 rounded-xl border border-[#E8E0D5] outline-none text-sm resize-none h-24 bg-white text-[#4A4036] focus:border-[#C5A880] placeholder:text-[#D6CCC6]" placeholder="Special instructions for SRM..." value={form.remark} onChange={e => setForm({...form, remark: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-3 p-4 rounded-xl border bg-white border-[#E8E0D5]">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#8C7B6C] uppercase tracking-wider opacity-80"><CalendarDays size={14} /><span>Next Step Planning</span></div>
                        
                        {form.status === "READY_DEMO" ? (
                            <div className="space-y-3">
                                <div className="text-sm font-bold text-[#4A4036]">Demo class date and time</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="date" value={form.nextActionDate} onChange={e => setForm({...form, nextActionDate: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                                    <input type="time" value={form.nextActionTime} onChange={e => setForm({...form, nextActionTime: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 items-center">
                                <div className="p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036]/50 italic">Call back</div>
                                <input type="date" value={form.nextActionDate} onChange={e => setForm({...form, nextActionDate: e.target.value})} className="w-full p-2.5 bg-[#F5F0EB] rounded-lg font-bold text-sm text-[#4A4036] outline-none" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex gap-3 pt-4 border-t border-[#E8E0D5] shrink-0 p-6 bg-white">
                    <button onClick={handleCancel} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${cancelStage === 1 ? "bg-[#D96C6C]/10 text-[#D96C6C] border border-[#D96C6C]/20 hover:bg-[#D96C6C]/20" : "text-[#8C7B6C] hover:bg-[#F5F0EB]"}`}>
                        {cancelStage === 1 ? <><AlertCircle size={16} /> Discard?</> : "Cancel"}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] py-3 text-sm font-bold text-white bg-[#C5A880] rounded-xl hover:bg-[#B89A72] shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        {saving ? "Saving..." : <><Save size={18} /> Save & Assign</>}
                    </button>
                </div>
            </div>
        </div>
    );
}