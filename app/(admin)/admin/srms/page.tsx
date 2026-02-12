"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  MessageCircle, 
  Edit2, 
  Trash2, 
  Save, 
  X,
  User,
  LogOut,
  ShieldCheck,
  Briefcase,
  ArrowLeft 
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    getDocs, 
    addDoc, 
    updateDoc, 
    doc, 
    Timestamp, 
    writeBatch 
} from "firebase/firestore";
import { format } from "date-fns";
import Link from "next/link";

// --- Types ---
type SRM = {
  id: string;
  name: string;
  email: string;
  ycsId: string;
  phone?: string;
  status: "ACTIVE" | "LEFT" | "NEW";
  joiningDate: any; 
  leavingDate?: any; 
  profileImage?: string;
};

export default function AdminSRMsPage() {
  // State
  const [srms, setSrms] = useState<SRM[]>([]);
  const [selectedSRM, setSelectedSRM] = useState<SRM | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [filterStatus, setFilterStatus] = useState<"ACTIVE" | "LEFT">("ACTIVE");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Forms
  const [addForm, setAddForm] = useState({ name: "", email: "", ycsId: "" });
  const [editForm, setEditForm] = useState<Partial<SRM>>({});

  // --- 1. Fetch SRMs ---
  useEffect(() => {
    const fetchSRMs = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "srms"));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SRM));
        
        // Sort by joining date desc
        list.sort((a, b) => b.joiningDate?.toMillis() - a.joiningDate?.toMillis());
        setSrms(list);
      } catch (e) {
        console.error("Error fetching SRMs", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSRMs();
  }, []);

  // --- 2. Actions ---

  const handleAddSRM = async () => {
      if (!addForm.name || !addForm.email || !addForm.ycsId) return alert("All fields required");
      try {
          const newSRM = {
              ...addForm,
              status: "NEW" as const, 
              joiningDate: Timestamp.now(),
              phone: "" 
          };
          const ref = await addDoc(collection(db, "srms"), newSRM);
          setSrms(prev => [{ id: ref.id, ...newSRM } as SRM, ...prev]);
          setIsAddModalOpen(false);
          setAddForm({ name: "", email: "", ycsId: "" });
      } catch (e) {
          console.error(e);
          alert("Failed to add SRM");
      }
  };

  const handleUpdateSRM = async () => {
      if (!selectedSRM || !editForm) return;
      try {
          await updateDoc(doc(db, "srms", selectedSRM.id), editForm);
          setSrms(prev => prev.map(s => s.id === selectedSRM.id ? { ...s, ...editForm } : s));
          setSelectedSRM(prev => prev ? { ...prev, ...editForm } : null);
          setIsEditMode(false);
      } catch (e) {
          console.error(e);
          alert("Update failed");
      }
  };

  const handleRemoveSRM = async () => {
      if (!selectedSRM) return;
      if (!confirm("Are you sure? This will move the SRM to 'Ex-SRMs'.")) return;

      try {
          const batchOp = writeBatch(db);
          const srmRef = doc(db, "srms", selectedSRM.id);
          
          // Explicitly typing the status to solve the TS error
          const newStatus: "LEFT" = "LEFT";
          const leavingDate = Timestamp.now();

          batchOp.update(srmRef, {
              status: newStatus,
              leavingDate: leavingDate
          });

          await batchOp.commit();

          // Update Local State with fixed types
          setSrms(prev => prev.map(s => 
              s.id === selectedSRM.id 
              ? { ...s, status: newStatus, leavingDate: leavingDate } 
              : s
          ));
          
          setSelectedSRM(null);
          setFilterStatus("LEFT"); 

      } catch (e) {
          console.error(e);
          alert("Failed to remove SRM");
      }
  };

  // --- 3. Filtering ---
  const filteredSRMs = useMemo(() => {
      return srms.filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.ycsId.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = filterStatus === "ACTIVE" 
              ? (s.status === "ACTIVE" || s.status === "NEW") 
              : s.status === "LEFT";
          return matchesSearch && matchesStatus;
      });
  }, [srms, searchTerm, filterStatus]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* --- BACK BUTTON --- */}
      <Link 
        href="/admin" 
        className="inline-flex items-center gap-2 text-[#8C7B6C] hover:text-[#2D241E] transition-colors font-bold text-xs uppercase tracking-widest mb-2"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#2D241E]">SRM Team</h1>
          <p className="text-[#8C7B6C] text-sm">Manage access and profiles for your SRM team</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-[#2D241E] hover:bg-[#4A4036] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#2D241E]/20 transition-all active:scale-95"
        >
          <UserPlus size={18} /> Add SRM
        </button>
      </div>

      {/* Filter & Search Row */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={20} />
          <input 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Search name or ID..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-[#E8E0D5] rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] transition-all shadow-sm placeholder:text-[#B0A090]" 
          />
        </div>
        <div className="flex bg-[#F5F0EB] p-1 rounded-xl border border-[#E8E0D5]">
          {["ACTIVE", "LEFT"].map((status) => (
            <button 
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
                filterStatus === status 
                ? "bg-white shadow-sm text-[#2D241E]" 
                : "text-[#8C7B6C] hover:text-[#4A4036]"
              }`}
            >
              {status === "ACTIVE" ? "Active Team" : "Ex-Employees"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-[#8C7B6C]">Loading team members...</div>
          ) : filteredSRMs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#8C7B6C] italic">No SRMs found.</div>
          ) : (
            filteredSRMs.map(s => (
              <div 
                key={s.id}
                onClick={() => setSelectedSRM(s)}
                className="bg-white border border-[#E8E0D5] p-5 rounded-2xl hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-[#F5F0EB] flex items-center justify-center font-serif text-xl font-bold text-[#8C7B6C] overflow-hidden group-hover:bg-[#2D241E] group-hover:text-white transition-colors">
                  {s.profileImage ? <img src={s.profileImage} className="w-full h-full object-cover" /> : s.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#2D241E]">{s.name}</h3>
                  <p className="text-xs text-[#8C7B6C] font-medium">{s.ycsId}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-500' : s.status === 'NEW' ? 'bg-blue-500' : 'bg-red-400'}`} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- SRM DETAILS POPUP MODAL --- */}
      {selectedSRM && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#FDFDFD] w-full max-w-2xl rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden border border-[#E8E0D5]">
            <div className="flex justify-between items-center p-6 border-b border-[#E8E0D5]">
              <h2 className="text-xl font-serif font-bold text-[#2D241E]">SRM Profile</h2>
              <button 
                onClick={() => { setSelectedSRM(null); setIsEditMode(false); }} 
                className="p-2 hover:bg-[#F5F0EB] text-[#8C7B6C] rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Profile Header in Modal */}
              <div className="flex items-center gap-8">
                <div className="w-24 h-24 rounded-full bg-[#F5F0EB] flex items-center justify-center text-3xl font-serif font-bold text-[#8C7B6C] overflow-hidden shadow-inner">
                  {selectedSRM.profileImage ? <img src={selectedSRM.profileImage} className="w-full h-full object-cover" /> : selectedSRM.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                  {isEditMode ? (
                    <input 
                      value={editForm.name ?? selectedSRM.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="text-2xl font-serif font-bold text-[#2D241E] border-b border-[#C5A880] bg-transparent outline-none w-full"
                    />
                  ) : (
                    <h3 className="text-2xl font-serif font-bold text-[#2D241E]">{selectedSRM.name}</h3>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="bg-[#2D241E] text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">{selectedSRM.ycsId}</span>
                    <span className="text-xs text-[#8C7B6C] font-medium italic">Joined {format(selectedSRM.joiningDate.toDate(), "dd MMM yyyy")}</span>
                  </div>
                </div>
                {filterStatus === "ACTIVE" && !isEditMode && (
                  <button onClick={() => { setIsEditMode(true); setEditForm(selectedSRM); }} className="p-3 bg-[#F5F0EB] text-[#8C7B6C] rounded-xl hover:text-[#2D241E] transition-colors">
                    <Edit2 size={20} />
                  </button>
                )}
              </div>

              {/* Data Fields in Modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F9F7F5] p-6 rounded-2xl border border-[#E8E0D5]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8C7B6C] uppercase tracking-wider">Email Address</label>
                  {isEditMode ? (
                    <input value={editForm.email ?? selectedSRM.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-white border border-[#E8E0D5] p-2 rounded-lg text-sm" />
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-medium text-[#4A4036]"><Mail size={14} className="text-[#C5A880]"/> {selectedSRM.email}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8C7B6C] uppercase tracking-wider">Phone Number</label>
                  {isEditMode ? (
                    <input value={editForm.phone ?? selectedSRM.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-white border border-[#E8E0D5] p-2 rounded-lg text-sm" />
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-medium text-[#4A4036]"><Phone size={14} className="text-[#C5A880]"/> {selectedSRM.phone || "Not set"}</div>
                  )}
                </div>
              </div>

              {/* Action Buttons in Modal */}
              {isEditMode ? (
                <div className="flex gap-3">
                  <button onClick={handleUpdateSRM} className="flex-1 bg-[#2D241E] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18}/> Save Changes</button>
                  <button onClick={handleRemoveSRM} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Remove SRM"><Trash2 size={20}/></button>
                </div>
              ) : (
                selectedSRM.phone && (
                  <a href={`https://wa.me/${selectedSRM.phone}`} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-all">
                    <MessageCircle size={20} /> Chat on WhatsApp
                  </a>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD SRM MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4">
          <div className="bg-[#FDFDFD] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-[#E8E0D5]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold text-[#2D241E]">New Team Member</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#8C7B6C] hover:text-[#2D241E]"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <input value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="Full Name" className="w-full bg-[#F5F0EB] p-3 rounded-xl outline-none border border-transparent focus:border-[#C5A880]" />
              <input value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="Email" className="w-full bg-[#F5F0EB] p-3 rounded-xl outline-none border border-transparent focus:border-[#C5A880]" />
              <input value={addForm.ycsId} onChange={e => setAddForm({...addForm, ycsId: e.target.value})} placeholder="YCS ID (e.g. SRM-01)" className="w-full bg-[#F5F0EB] p-3 rounded-xl outline-none border border-transparent focus:border-[#C5A880]" />
              <button onClick={handleAddSRM} className="w-full bg-[#C5A880] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#C5A880]/20 hover:bg-[#B89A72] transition-colors mt-4">Create Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}