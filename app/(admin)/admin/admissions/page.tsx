"use client";

import { useState, useEffect } from "react";
import { Check, Calendar, ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { 
    collection, 
    query, 
    orderBy, 
    getDocs, 
    doc, 
    getDoc, // Added getDoc
    writeBatch,
    Timestamp,
    where
} from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth"; // Added useAuth

type Student = {
  id: string;
  name: string;
  ycsId: string;
  joiningDate: Timestamp;
  status: string;
  enquiryId: string;
};

export default function AdmissionsPage() {
  const { appUser } = useAuth(); // To get Admin name for notification
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(
            collection(db, "students"), 
            where("status", "==", "NEW"),
            orderBy("joiningDate", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
        setStudents(list);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleMarkJoined = async (student: Student) => {
    if (!confirm(`Confirm admission for ${student.name}?`)) return;
    
    setProcessingId(student.id);
    try {
      const batch = writeBatch(db);

      // --- 🔔 PREPARE NOTIFICATION DATA ---
      let targetSrmId = "";
      if (student.enquiryId) {
        const enqRef = doc(db, "enquiries", student.enquiryId);
        const enqSnap = await getDoc(enqRef);
        
        if (enqSnap.exists()) {
          const enqData = enqSnap.data();
          targetSrmId = enqData.srmId;

          // 1. Update Original Enquiry to JOINED
          batch.update(enqRef, { 
              status: "JOINED",
              lastAction: "Admin Confirmed",
              lastActionDate: Timestamp.now(),
              lastRemark: "Joined the Academy (Admin Confirmed)."
          });

          // 2. Create Celebration Notification for SRM 🔔
          if (targetSrmId) {
            const srmNoteRef = doc(collection(db, "srm_notifications"));
            batch.set(srmNoteRef, {
                srmId: targetSrmId,
                enquiryId: student.enquiryId,
                enquiryName: student.name,
                fromName: appUser?.name || "Admin",
                type: "system",
                status: "JOINED",
                message: `Congrats! Your Enquiry "${student.name}" has taken admission!`,
                createdAt: Timestamp.now(),
                read: false
            });
          }
        }
      }

      // 3. Update Student Status to ACTIVE
      const studentRef = doc(db, "students", student.id);
      batch.update(studentRef, { status: "ACTIVE" });

      await batch.commit();

      // REMOVE from list immediately
      setStudents(prev => prev.filter(s => s.id !== student.id));

    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (ts: Timestamp) => {
    if (!ts) return "--";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <Link 
        href="/admin" 
        className="inline-flex items-center gap-2 text-[#8C7B6C] hover:text-[#2D241E] transition-colors font-bold text-xs uppercase tracking-widest mb-2"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-serif font-bold text-[#2D241E]">Admissions</h1>
        <p className="text-[#8C7B6C] text-sm">Manage new student onboarding</p>
      </div>

      <div className="bg-[#FDFDFD] rounded-3xl border border-[#E8E0D5] shadow-sm overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-[#8C7B6C]">Loading list...</div>
        ) : students.length === 0 ? (
           <div className="p-12 text-center text-[#8C7B6C]">No pending admissions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F5F0EB] text-[#8C7B6C] text-xs uppercase tracking-wider border-b border-[#E8E0D5]">
                  <th className="p-5 font-bold w-16 text-center">S No.</th>
                  <th className="p-5 font-bold w-40">Date</th>
                  <th className="p-5 font-bold">Student Name</th>
                  <th className="p-5 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E0D5]">
                {students.map((student, index) => (
                  <tr key={student.id} className="hover:bg-[#F9F7F5] transition-colors">
                    <td className="p-5 text-center text-[#8C7B6C] font-mono text-sm">{index + 1}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-[#4A4036] font-medium">
                        <Calendar size={16} className="text-[#C5A880]" />
                        {formatDate(student.joiningDate)}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E8E0D5] flex items-center justify-center text-[#4A4036] font-bold">
                            {student.name.charAt(0)}
                        </div>
                        <div>
                            <div className="font-bold text-[#2D241E] text-base">{student.name}</div>
                            <div className="text-xs text-[#8C7B6C] font-mono bg-[#F5F0EB] px-1.5 py-0.5 rounded inline-block mt-1">
                                {student.ycsId}
                            </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                        <button 
                            onClick={() => handleMarkJoined(student)}
                            disabled={processingId === student.id}
                            className="bg-[#2D241E] text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-[#4A4036] shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {processingId === student.id ? "Updating..." : "Mark Joined"}
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}