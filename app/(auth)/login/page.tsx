
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Lock, Mail, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
   
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDocRef = doc(db, "Speen_Users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const role = userData.role;


        if (role === "purchasing") {
          router.push("/internal/purchasing");
        } else if (role === "mcx") {
          router.push("/internal/mcx");
        } else {
          setError("Akses ditolak: Divisi tidak dikenali.");
          auth.signOut();
        }
      } else {
        setError("Akun ini belum terdaftar di database internal (Speen_Users).");
        auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError("Login gagal. Periksa kembali Email dan Password Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden font-sans text-slate-200">
      {/* Background Glow Efék */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none z-0"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-slate-800 border border-slate-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
              <ShieldCheck size={32} className="text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">MySehati Portal</h1>
            <p className="text-sm text-slate-400 mt-1">Spin Wheel Management System</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Staf</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={16} className="text-slate-500" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="w-full bg-slate-800/80 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="email@mysehati.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={16} className="text-slate-500" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="w-full bg-slate-800/80 border border-slate-600 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(79,70,229,0.3)] active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:active:scale-100"
            >
              {isLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Memeriksa Akses...</>
              ) : (
                "Masuk ke Dashboard"
              )}
            </button>
          </form>
          
        </div>
      </div>
    </main>
  );
}