"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode"); // The secret key from the email
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

    // Check if the code is valid
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email); // It works! We know who this is.
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        
        {/* --- STATE: LOADING --- */}
        {status === "loading" && (
            <div className="py-10 animate-pulse">
                <div className="h-4 w-1/2 bg-gray-200 rounded mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm">Verifying secure link...</p>
            </div>
        )}

        {/* --- STATE: ERROR --- */}
        {status === "error" && (
            <div className="py-6">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Link Invalid</h2>
                <p className="text-gray-500 mb-6">{errorMsg}</p>
                <button 
                    onClick={() => router.push("/login")}
                    className="text-black font-bold hover:underline"
                >
                    Back to Login
                </button>
            </div>
        )}

        {/* --- STATE: SUCCESS --- */}
        {status === "success" && (
            <div className="py-6 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
                <p className="text-gray-500 mb-6">Your password has been updated successfully.</p>
                <button 
                    onClick={() => router.push("/login")}
                    className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                    Login with New Password
                </button>
            </div>
        )}

        {/* --- STATE: INPUT (The Real Form) --- */}
        {status === "input" && (
            <div className="animate-in slide-in-from-bottom-4 duration-500 text-left">
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Reset Password</h1>
                <p className="text-sm text-gray-500 text-center mb-8">for {email}</p>

                <div className="space-y-4">
                    
                    {/* New Password */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">New Password</label>
                        <div className="relative mt-1">
                            <input 
                                type={showPassword ? "text" : "password"}
                                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                placeholder="Min 6 chars"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <button 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3.5 text-gray-400 hover:text-black"
                            >
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Confirm Password</label>
                        <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-black focus:ring-1 focus:ring-black transition-all mt-1"
                            placeholder="Type it again"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleReset}
                        className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 shadow-lg mt-4 transition-all active:scale-[0.98]"
                    >
                        Save New Password
                    </button>

                </div>
            </div>
        )}

      </div>
    </div>
  );
}