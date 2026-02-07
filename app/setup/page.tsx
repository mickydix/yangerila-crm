"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldCheck } from "lucide-react";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const email = searchParams.get("email");
  const srmDocId = searchParams.get("id");
  const name = searchParams.get("name");

  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!password || !confirmPass) return alert("Please fill all fields.");
    if (password !== confirmPass) return alert("Passwords do not match.");
    if (password.length < 6) return alert("Password must be at least 6 characters.");
    if (!email || !srmDocId) return alert("Missing account details. Please restart.");

    setLoading(true);
    try {
        const auth = getAuth();
        
        // 1. Create Authentication User
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        // 2. Create 'users' document (For Role Management)
        await setDoc(doc(db, "users", uid), {
            email: email,
            role: "SRM", // <--- Assigns them the SRM role
            srmId: srmDocId, // Links to their data
            name: name,
            createdAt: new Date()
        });

        // 3. Update the existing SRM document to ACTIVE
        await updateDoc(doc(db, "srms", srmDocId), {
            status: "ACTIVE",
            uid: uid,
            joiningDate: new Date() // Sets official joining date
        });

        alert("Account Activated! Redirecting...");
        router.push("/srm");

    } catch (error: any) {
        console.error(error);
        alert(error.message || "Activation failed");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
        
        <div className="text-center mb-8">
            <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Account Setup</h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">Welcome, {name}</p>
        </div>

        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Create Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm Password</label>
                <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
                />
            </div>
        </div>

        <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full mt-8 bg-green-600 text-white rounded-xl py-3.5 text-sm font-bold shadow-lg hover:bg-green-700 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
        >
            {loading ? "Activating..." : "Activate Account"}
        </button>

        <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
                Secure SSL Connection
            </p>
        </div>
    </div>
  );
}

export default function SetupPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 font-sans relative overflow-hidden">
             {/* Background Decoration */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-100 mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-green-100 mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            </div>
            
            <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
                <SetupContent />
            </Suspense>
        </div>
    );
}