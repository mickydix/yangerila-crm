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
  Briefcase
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
  const [selectedSrmId, setSelectedSrmId] = useState<string | null>(null);
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
        
        // Auto-select first active srm
        const firstActive = list.find(s => s.status === "ACTIVE" || s.status === "NEW");
        if (firstActive && !selectedSrmId) setSelectedSrmId(firstActive.id);
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
              status: "NEW", // Important: Created as NEW so they can set password
              joiningDate: Timestamp.now(),
              phone: "" // Placeholder
          };
          
          const ref = await addDoc(collection(db, "srms"), newSRM);
          
          // Update Local State
          setSrms(prev => [{ id: ref.id, ...newSRM } as SRM, ...prev]);
          setIsAddModalOpen(false);
          setAddForm({ name: "", email: "", ycsId: "" });
          setSelectedSrmId(ref.id); // Switch to new SRM

      } catch (e) {
          console.error(e);
          alert("Failed to add SRM");
      }
  };

  const handleUpdateSRM = async () => {
      if (!selectedSrmId || !editForm) return;
      try {
          await updateDoc(doc(db, "srms", selectedSrmId), editForm);
          
          // Update Local
          setSrms(prev => prev.map(s => s.id === selectedSrmId ? { ...s, ...editForm } : s));
          setIsEditMode(false);
      } catch (e) {
          console.error(e);
          alert("Update failed");
      }
  };

  const handleRemoveSRM = async () => {
      if (!selectedSrmId) return;
      if (!confirm("Are you sure? This will move the SRM to 'Ex-SRMs'.")) return;

      try {
          const batchOp = writeBatch(db);
          
          // 1. Mark SRM as LEFT
          const srmRef = doc(db, "srms", selectedSrmId);
          batchOp.update(srmRef, {
              status: "LEFT",
              leavingDate: Timestamp.now()
          });

          await batchOp.commit();

          // Update Local State
          setSrms(prev => prev.map(s => s.id === selectedSrmId ? { ...s, status: "LEFT", leavingDate: Timestamp.now() } : s));
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

  const selectedSRM = srms.find(s => s.id === selectedSrmId);

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-[#FDFDFD] border border-[#E8E0D5] rounded-3xl overflow-hidden shadow-sm">
      
      {/* --- LEFT SIDE: LIST --- */}
      <div className="w-96 bg-[#FDFDFD] border-r border-[#E8E0D5] flex flex-col h-full shrink-0">
        
        {/* Header & Add Button */}
        <div className="p-6 border-b border-[#E8E0D5] space-y-5">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-serif font-bold text-[#2D241E]">SRM Team</h1>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="p-2.5 bg-[#2D241E] text-white rounded-xl hover:bg-[#4A4036] transition-colors shadow-lg shadow-[#2D241E]/20 active:scale-95"
                >
                    <UserPlus size={18} />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7B6C]" size={18} />
                <input 
                    placeholder="Search name or ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#F5F0EB] border border-[#E8E0D5] rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#C5A880] text-[#4A4036] placeholder:text-[#B0A090]"
                />
            </div>

            {/* Tabs */}
            <div className="flex bg-[#F5F0EB] p-1.5 rounded-xl border border-[#E8E0D5]">
                <button 
                    onClick={() => setFilterStatus("ACTIVE")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        filterStatus === "ACTIVE" 
                        ? "bg-white shadow-sm text-[#2D241E] ring-1 ring-black/5" 
                        : "text-[#8C7B6C] hover:text-[#4A4036]"
                    }`}
                >
                    Active Team
                </button>
                <button 
                    onClick={() => setFilterStatus("LEFT")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        filterStatus === "LEFT" 
                        ? "bg-white shadow-sm text-[#2D241E] ring-1 ring-black/5" 
                        : "text-[#8C7B6C] hover:text-[#4A4036]"
                    }`}
                >
                    Ex-Employees
                </button>
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
            {loading ? (
                <div className="p-8 text-center text-[#8C7B6C] text-sm">Loading staff...</div>
            ) : filteredSRMs.length === 0 ? (
                <div className="p-8 text-center text-[#8C7B6C] text-sm italic">No records found.</div>
            ) : (
                filteredSRMs.map(s => (
                    <div 
                        key={s.id}
                        onClick={() => setSelectedSrmId(s.id)}
                        className={`px-6 py-4 border-b border-[#E8E0D5] cursor-pointer transition-all flex items-center gap-4 group
                            ${selectedSrmId === s.id ? "bg-[#F5F0EB]" : "hover:bg-[#F9F7F5]"}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-serif text-lg font-bold overflow-hidden shadow-sm
                            ${selectedSrmId === s.id ? "bg-[#2D241E] text-white" : "bg-[#F5F0EB] text-[#8C7B6C]"}`}>
                            {s.profileImage ? <img src={s.profileImage} className="w-full h-full object-cover" /> : s.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold text-sm ${selectedSrmId === s.id ? "text-[#2D241E]" : "text-[#4A4036]"}`}>
                                {s.name}
                            </h3>
                            <p className="text-xs text-[#8C7B6C] font-medium">{s.ycsId}</p>
                        </div>
                        {s.status === "ACTIVE" ? <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" /> : 
                         s.status === "NEW" ? <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" title="Pending Setup"/> :
                         <div className="w-2 h-2 rounded-full bg-red-400" />}
                    </div>
                ))
            )}
        </div>
      </div>

      {/* --- RIGHT SIDE: DETAILS --- */}
      <div className="flex-1 bg-[#FAFAFA] relative overflow-hidden flex flex-col">
         {/* Background Decoration */}
         <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#C5A880]/10 mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none"></div>

         {selectedSRM ? (
             <div className="h-full flex flex-col w-full p-8 overflow-y-auto relative z-10">
                 
                 {/* Top Profile Card */}
                 <div className="bg-white rounded-3xl p-8 border border-[#E8E0D5] shadow-sm mb-6 relative">
                     {/* Edit Toggle */}
                     {filterStatus === "ACTIVE" && (
                         <div className="absolute top-8 right-8 flex gap-2">
                             {isEditMode ? (
                                 <>
                                     <button onClick={() => setIsEditMode(false)} className="p-2 text-[#8C7B6C] hover:bg-[#F5F0EB] rounded-lg"><X size={20}/></button>
                                     <button onClick={handleUpdateSRM} className="p-2 bg-[#2D241E] text-white rounded-lg hover:bg-[#4A4036]"><Save size={20}/></button>
                                 </>
                             ) : (
                                 <button 
                                     onClick={() => { setIsEditMode(true); setEditForm(selectedSRM); }}
                                     className="p-2 text-[#8C7B6C] hover:text-[#2D241E] hover:bg-[#F5F0EB] rounded-lg transition-colors"
                                 >
                                     <Edit2 size={20} />
                                 </button>
                             )}
                         </div>
                     )}

                     <div className="flex items-start gap-8">
                         <div className="w-32 h-32 rounded-full bg-[#F5F0EB] border-4 border-white shadow-xl flex items-center justify-center text-4xl font-serif font-bold text-[#8C7B6C] overflow-hidden shrink-0">
                            {selectedSRM.profileImage ? <img src={selectedSRM.profileImage} className="w-full h-full object-cover" /> : selectedSRM.name.charAt(0)}
                         </div>
                         <div className="flex-1 pt-2 space-y-2">
                             {isEditMode ? (
                                 <input 
                                     value={editForm.name || ""} 
                                     onChange={e => setEditForm({...editForm, name: e.target.value})}
                                     className="text-3xl font-serif font-bold text-[#2D241E] bg-transparent border-b border-[#C5A880] outline-none w-full pb-1"
                                 />
                             ) : (
                                 <h1 className="text-3xl font-serif font-bold text-[#2D241E]">{selectedSRM.name}</h1>
                             )}
                             
                             <div className="flex items-center gap-3 text-[#8C7B6C] font-medium">
                                 <span className="bg-[#2D241E] text-white px-2 py-1 rounded text-xs font-bold tracking-wide">{selectedSRM.ycsId}</span>
                                 <span>•</span>
                                 <span className="text-sm">Joined {selectedSRM.joiningDate ? format(selectedSRM.joiningDate.toDate(), "PPP") : "N/A"}</span>
                             </div>

                             {selectedSRM.status === "LEFT" && (
                                 <div className="mt-4 inline-flex items-center gap-2 text-red-700 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg text-sm font-bold">
                                     <LogOut size={16} /> Left on {selectedSRM.leavingDate ? format(selectedSRM.leavingDate.toDate(), "PPP") : "Unknown"}
                                 </div>
                             )}
                             {selectedSRM.status === "NEW" && (
                                 <div className="mt-4 inline-flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold">
                                     <ShieldCheck size={16} /> Setup Pending
                                 </div>
                             )}
                         </div>
                     </div>
                     
                     {/* Contact Grid */}
                     <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-[#E8E0D5]">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-[#F5F0EB] flex items-center justify-center text-[#4A4036]"><Phone size={18} /></div>
                             <div className="flex-1">
                                 <div className="text-xs font-bold text-[#8C7B6C] uppercase tracking-wider">Phone</div>
                                 {isEditMode ? (
                                     <input 
                                         value={editForm.phone || ""}
                                         onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                         className="font-medium text-[#2D241E] w-full border-b border-[#C5A880] bg-transparent outline-none" 
                                         placeholder="Add number"
                                     />
                                 ) : (
                                     <div className="font-medium text-[#2D241E]">{selectedSRM.phone || "--"}</div>
                                 )}
                             </div>
                         </div>
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-[#F5F0EB] flex items-center justify-center text-[#4A4036]"><Mail size={18} /></div>
                             <div className="flex-1">
                                 <div className="text-xs font-bold text-[#8C7B6C] uppercase tracking-wider">Email</div>
                                 {isEditMode ? (
                                     <input 
                                         value={editForm.email || ""}
                                         onChange={e => setEditForm({...editForm, email: e.target.value})}
                                         className="font-medium text-[#2D241E] w-full border-b border-[#C5A880] bg-transparent outline-none" 
                                     />
                                 ) : (
                                     <div className="font-medium text-[#2D241E] truncate">{selectedSRM.email}</div>
                                 )}
                             </div>
                         </div>
                         {selectedSRM.phone && (
                            <a href={`https://wa.me/${selectedSRM.phone}`} target="_blank" className="col-span-2 flex items-center gap-3 text-[#2D241E] hover:bg-[#F5F0EB] p-3 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-[#E8E0D5]">
                                <div className="w-10 h-10 rounded-full bg-[#25D366]/20 text-[#128C7E] flex items-center justify-center"><MessageCircle size={18} /></div>
                                <div>
                                    <div className="text-xs font-bold text-[#128C7E] uppercase">Quick Action</div>
                                    <div className="font-bold">Chat on WhatsApp</div>
                                </div>
                            </a>
                         )}
                     </div>
                 </div>

                 {/* Stats or placeholder (Future expansion) */}
                 <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-6 rounded-3xl border border-[#E8E0D5] shadow-sm">
                        <div className="flex items-center gap-2 text-[#8C7B6C] mb-2">
                             <Briefcase size={16} />
                             <span className="text-xs font-bold uppercase">Role</span>
                        </div>
                        <div className="text-xl font-serif font-bold text-[#2D241E]">Student Relationship Manager</div>
                     </div>
                 </div>
                 
                 {/* Remove Button */}
                 {isEditMode && filterStatus === "ACTIVE" && (
                     <div className="mt-auto pt-6 text-right">
                         <button 
                            onClick={handleRemoveSRM}
                            className="text-red-500 font-bold text-sm hover:bg-red-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ml-auto"
                         >
                             <Trash2 size={16} /> Move to Ex-Employees
                         </button>
                     </div>
                 )}

             </div>
         ) : (
             <div className="h-full flex flex-col items-center justify-center text-[#C5A880]">
                 <User size={64} className="mb-4 opacity-20" />
                 <p className="font-serif italic text-lg opacity-60">Select a team member to view details.</p>
             </div>
         )}
      </div>

      {/* --- ADD MODAL --- */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D241E]/40 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-[#FDFDFD] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 border border-[#E8E0D5]">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-serif font-bold text-[#2D241E]">Add New SRM</h3>
                      <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-[#F5F0EB] text-[#8C7B6C] rounded-full transition-colors">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Full Name</label>
                          <input 
                              value={addForm.name}
                              onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                              className="w-full bg-[#F5F0EB] p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] text-[#2D241E] font-medium placeholder:text-[#B0A090]"
                              placeholder="e.g. Sarah Smith"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">Email Address</label>
                          <input 
                              type="email"
                              value={addForm.email}
                              onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                              className="w-full bg-[#F5F0EB] p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] text-[#2D241E] font-medium placeholder:text-[#B0A090]"
                              placeholder="Used for login"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-[#8C7B6C] uppercase mb-1">YCS ID</label>
                          <input 
                              value={addForm.ycsId}
                              onChange={(e) => setAddForm({...addForm, ycsId: e.target.value})}
                              className="w-full bg-[#F5F0EB] p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-[#C5A880] text-[#2D241E] font-medium placeholder:text-[#B0A090]"
                              placeholder="Unique ID (e.g. SRM-01)"
                          />
                      </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                      <button 
                          onClick={() => setIsAddModalOpen(false)}
                          className="flex-1 py-3 text-sm font-bold text-[#8C7B6C] hover:bg-[#F5F0EB] rounded-xl transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleAddSRM}
                          className="flex-[2] py-3 text-sm font-bold text-white bg-[#C5A880] rounded-xl hover:bg-[#B89A72] shadow-lg transition-colors"
                      >
                          Create Account
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}