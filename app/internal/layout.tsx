
import React from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex flex-col">
      {/* GLOBAL NAVBAR UNTUK INTERNAL CMS */}
      <nav className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
              <Gamepad2 size={18} />
            </div>
            <span className="font-bold text-white tracking-wide">
              MySehati <span className="text-indigo-400 font-black">CMS</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              Internal Portal
            </span>
          </div>
        </div>
      </nav>

      {/* KONTEN UTAMA (Dashboard Purchasing / MCX akan masuk ke sini) */}
      <div className="flex-1 w-full relative">
        {/* Glow Background Global Internal */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
        
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </div>
      
    </div>
  );
}