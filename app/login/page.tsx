"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  
  // UI State (Added "reset" mode)
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ycsId, setYcsId] = useState("");

  const handleAction = async () => {
    setLoading(true);
    try {
      const auth = getAuth();

      // --- LOGIC: RESET PASSWORD ---
      if (mode === "reset") {
        if (!email) {
            alert("Please enter your email address.");
            setLoading(false);
            return;
        }
        await sendPasswordResetEmail(auth, email);
        alert(`Reset link sent to ${email}. Check your inbox!`);
        setMode("login"); // Go back to login screen
      }

      // --- LOGIC: LOG IN ---
      else if (mode === "login") {
        if (!email || !password) {
           alert("Please enter email and password.");
           setLoading(false);
           return;
        }

        const cred = await signInWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        // Check Role
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
           alert("User record not found in CRM.");
           setLoading(false);
           return;
        }

        const role = snap.data().role?.toUpperCase();
        if (role === "ADMIN") router.push("/admin");
        else if (role === "SRM") router.push("/srm");
        else {
           alert("Access Denied.");
           await auth.signOut();
        }

      } 
      // --- LOGIC: SIGN UP (VERIFY) ---
      else {
        if (!email || !ycsId) {
            alert("Email and YCS ID are required for verification.");
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "srms"),
            where("email", "==", email),
            where("ycsId", "==", ycsId),
            where("status", "==", "NEW")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
            alert("No pending account found. Please check your Email/ID or contact Admin.");
            setLoading(false);
            return;
        }

        const srmData = snap.docs[0].data();
        const srmDocId = snap.docs[0].id;
        
        router.push(`/setup?email=${encodeURIComponent(email)}&id=${srmDocId}&name=${encodeURIComponent(srmData.name)}`);
      }

    } catch (error: any) {
      console.error(error);
      // Firebase specific error handling for better UX
      if (error.code === 'auth/user-not-found') {
        alert("No user found with this email.");
      } else {
        alert(error.message || "Action failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900 font-sans relative overflow-hidden">
      
      {/* Background Decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden">
         <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-100 mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
         <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-100 mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Yangerila</h1>
          <p className="text-xs uppercase tracking-widest text-gray-500 mt-1 font-medium">
            {mode === "reset" ? "Reset Password" : "CRM Portal"}
          </p>
        </div>

        {/* Toggle Switch (Hidden in Reset Mode) */}
        {mode !== "reset" && (
            <div className="flex bg-gray-100/80 p-1 rounded-xl mb-6 border border-gray-200">
            <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                mode === "login" 
                    ? "bg-white text-black shadow-sm ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600"
                }`}
            >
                Log In
            </button>
            <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                mode === "signup" 
                    ? "bg-white text-black shadow-sm ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600"
                }`}
            >
                Verify Account
            </button>
            </div>
        )}

        {/* Inputs */}
        <div className="space-y-4">
          <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all placeholder:text-gray-400"
              />
          </div>

          {mode === "login" && (
             <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all placeholder:text-gray-400"
                />
                {/* FORGOT PASSWORD LINK */}
                <div className="text-right mt-2">
                    <button 
                        onClick={() => setMode("reset")} 
                        className="text-xs font-bold text-gray-400 hover:text-black transition-colors"
                    >
                        Forgot Password?
                    </button>
                </div>
             </div>
          )}

          {mode === "signup" && (
             <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                <input
                    placeholder="YCS ID (e.g. SRM-01)"
                    value={ycsId}
                    onChange={(e) => setYcsId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all placeholder:text-gray-400"
                />
             </div>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleAction}
          disabled={loading}
          className="w-full mt-6 bg-black text-white rounded-xl py-3.5 text-sm font-bold shadow-lg hover:bg-gray-800 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading 
            ? "Processing..." 
            : (mode === "login" ? "Sign In" : mode === "signup" ? "Verify & Continue" : "Send Reset Link")
          }
        </button>

        {/* Back Button for Reset Mode */}
        {mode === "reset" && (
            <button 
                onClick={() => setMode("login")}
                className="w-full mt-3 text-sm font-bold text-gray-500 hover:text-black py-2"
            >
                Back to Login
            </button>
        )}

        <div className="mt-6 text-center">
            <span className="text-xs text-gray-400 font-medium">
                {mode === "login" ? "Authorized Personnel Only" : mode === "signup" ? "Account activation requires Admin approval" : "Enter your email to receive a link"}
            </span>
        </div>

      </div>
    </div>
  );
}