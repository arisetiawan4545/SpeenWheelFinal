"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, QrCode, Ticket } from "lucide-react";

export default function KasirLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex flex-col pb-20">
      {/* Header Mobile Ringkas */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-5 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-lg font-black text-white tracking-wide">
          MySehati <span className="text-indigo-400">Kasir</span>
        </h1>
        <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/50 rounded-full flex items-center justify-center shadow-inner">
           <span className="text-[10px] font-bold text-indigo-400">KSR</span>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 w-full relative p-4 sm:p-6">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[250px] h-[250px] bg-indigo-600/15 blur-[100px] rounded-full pointer-events-none z-0"></div>
        <div className="relative z-10 w-full h-full max-w-md mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 pb-safe">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          
          <Link href="/kasir" className={`flex flex-col items-center justify-center w-full transition-colors group ${isActive('/kasir') ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-300'}`}>
            <Home size={22} className="mb-1 group-active:scale-95 transition-transform" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Beranda</span>
          </Link>
          
          <Link href="/kasir/beri-akses" className="flex flex-col items-center justify-center w-full transition-colors relative group">
            <div className={`p-3 rounded-2xl -mt-8 border-[4px] border-[#0f172a] shadow-lg group-active:scale-95 transition-transform ${isActive('/kasir/beri-akses') ? 'bg-indigo-500 shadow-indigo-500/40 text-white' : 'bg-indigo-600 shadow-indigo-600/30 text-slate-100'}`}>
              <QrCode size={26} />
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${isActive('/kasir/beri-akses') ? 'text-indigo-400' : 'text-slate-400'}`}>Akses</span>
          </Link>

          <Link href="/kasir/redeem" className={`flex flex-col items-center justify-center w-full transition-colors group ${isActive('/kasir/redeem') ? 'text-indigo-400' : 'text-slate-400 hover:text-indigo-300'}`}>
            <Ticket size={22} className="mb-1 group-active:scale-95 transition-transform" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Redeem</span>
          </Link>
          
        </div>
      </nav>
    </div>
  );
}