"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode"); 
  const auth = getAuth();

  // State
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Status
  const [status, setStatus] = useState<"loading" | "input" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Verify the Code on Load
  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      setErrorMsg("Invalid or missing reset link.");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email); 
        setStatus("input");
      })
      .catch((e) => {
        console.error(e);
        setStatus("error");
        setErrorMsg("This link has expired or already been used.");
      });
  }, [oobCode, auth]);

  // 2. Handle the Reset
  const handleReset = async () => {
    if (newPassword.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }
    if (newPassword !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
      await confirmPasswordReset(auth, oobCode!, newPassword);
      setStatus("success");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to reset password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center relative overflow-hidden">
        
        {/* Top Decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-black via-gray-500 to-black"></div>

        {/* --- STATE: LOADING --- */}
        {status === "loading" && (
            <div className="py-12 animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest">Verifying Secure Link...</p>
            </div>
        )}

        {/* --- STATE: ERROR --- */}
        {status === "error" && (
            <div className="py-6">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50">
                    <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Link Invalid</h2>
                <p className="text-gray-500 mb-8 text-sm">{errorMsg}</p>
                <button 
                    onClick={() => router.push("/login")}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-all"
                >
                    Return to Login
                </button>
            </div>
        )}

        {/* --- STATE: SUCCESS --- */}
        {status === "success" && (
            <div className="py-6 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-50">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
                <p className="text-gray-500 mb-8 text-sm">You can now sign in with your new password.</p>
                <button 
                    onClick={() => router.push("/login")}
                    className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 shadow-lg transition-all"
                >
                    Back to Login
                </button>
            </div>
        )}

        {/* --- STATE: INPUT (The Form) --- */}
        {status === "input" && (
            <div className="animate-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="flex justify-center mb-4 text-gray-900">
                    <Lock size={32} strokeWidth={1.5} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Set New Password</h1>
                <p className="text-xs text-gray-400 text-center mb-8 uppercase tracking-wide">for {email}</p>

                <div className="space-y-5">
                    
                    {/* New Password */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">New Password</label>
                        <div className="relative mt-1 group">
                            <input 
                                type={showPassword ? "text" : "password"}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition-all"
                                placeholder="Min 6 chars"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <button 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3.5 text-gray-400 hover:text-black transition-colors"
                            >
                                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Confirm Password</label>
                        <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black transition-all mt-1"
                            placeholder="Retype password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleReset}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 shadow-lg mt-2 transition-all active:scale-[0.98]"
                    >
                        Update Password
                    </button>

                </div>
            </div>
        )}

      </div>
    </div>
  );
}

// Wrap in Suspense for Next.js build optimization
export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}