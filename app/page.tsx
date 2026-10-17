"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Settings } from "lucide-react";
import { db } from "../lib/firebase"; // <-- Sesuaikan path ini jika error
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";

export default function LandingPage() {
  const router = useRouter();
  const [liveCampaignId, setLiveCampaignId] = useState<string | null>(null);
  const [isCheckingLive, setIsCheckingLive] = useState(true);

  // Efek Real-Time untuk mencari program yang sedang LIVE
  useEffect(() => {
    setIsCheckingLive(true);
    const q = query(
      collection(db, "Speen_Campaigns"),
      where("status", "==", "LIVE"),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          setLiveCampaignId(docSnap.id);
        } else {
          setLiveCampaignId(null);
        }
        setIsCheckingLive(false);
      },
      (error) => {
        console.error("Gagal mengecek program LIVE:", error);
        setIsCheckingLive(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fungsi untuk memutar BGM gaca.mp3 tanpa duplikasi suara
  const playGacaMusic = () => {
    if (typeof window !== "undefined") {
      const win = window as any;
      if (!win.__gacaAudio) {
        win.__gacaAudio = new Audio("/sounds/gaca.mp3");
        win.__gacaAudio.loop = true; // Putar berulang terus selama di layar TV
        win.__gacaAudio.volume = 0.6; // Volume 60% agar tidak menutupi efek spin-tick & win-tada
      }
      win.__gacaAudio.play().catch((err: any) => {
        console.warn("Gagal memutar gaca.mp3:", err);
      });
    }
  };

  // Fungsi saat tombol TV diklik
  const handleTVClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (isCheckingLive) {
      alert("Sedang mengecek status program... Silakan tunggu sebentar.");
      return;
    }

    if (liveCampaignId) {
      // 1. Putar lagu gaca.mp3 tepat saat tombol ditekan
      playGacaMusic();

      // 2. Arahkan ke halaman TV dengan ID tersebut
      router.push(`/tv/${liveCampaignId}`);
    } else {
      alert(
        "Belum ada program yang berstatus LIVE saat ini.\nSilakan aktifkan (ON) program di Dashboard Purchasing terlebih dahulu."
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-200">
      
      {/* Background Ornaments */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none z-0"></div>

      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center">
        
        {/* LOGO AREA (Sudah Menggunakan logo.png) */}
        <div className="w-24 h-24 bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl flex items-center justify-center mb-8 relative p-2">
          {/* Efek Glow di belakang Logo */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-30 animate-pulse"></div>
          
          <img 
            src="/logo.png" 
            alt="MySehati Logo" 
            className="w-full h-full object-contain relative z-10 drop-shadow-md"
            onError={(e) => {
              // Jika logo belum ada, jangan merusak layout
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* JUDUL */}
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-6 drop-shadow-lg tracking-tight">
          Omnichannel Gamification
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
          Sistem manajemen terpusat untuk MySehati Spin Wheel. Kelola event, atur probabilitas hadiah, dan sesuaikan desain visual secara real-time.
        </p>

        {/* MENU / TOMBOL MASUK */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          
          {/* Tombol Internal */}
          <Link href="/login" className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center transition-all group shadow-xl hover:shadow-[0_10px_40px_rgba(79,70,229,0.2)]">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Portal Internal</h2>
            <p className="text-sm text-slate-400 mb-6 text-center">Akses khusus tim Purchasing dan divisi desain MCX.</p>
            <div className="flex items-center text-indigo-400 font-bold text-sm uppercase tracking-wider group-hover:gap-3 gap-2 transition-all">
              Masuk Sistem <ArrowRight size={16} />
            </div>
          </Link>

          {/* Tombol TV (Sudah Dibuat Pintar + Auto BGM gaca.mp3) */}
          <button 
             onClick={handleTVClick} 
             className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center transition-all group shadow-xl hover:shadow-[0_10px_40px_rgba(16,185,129,0.2)] text-left w-full cursor-pointer relative"
          >
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Settings size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 text-center w-full">Monitor TV Kiosk</h2>
            <p className="text-sm text-slate-400 mb-6 text-center">
              Lihat tampilan simulasi roda putar untuk TV toko.
              {!isCheckingLive && liveCampaignId && (
                <span className="block mt-2 text-xs text-emerald-400 font-bold animate-pulse">Program LIVE terdeteksi!</span>
              )}
            </p>
            <div className="flex justify-center w-full">
                <div className="flex items-center text-emerald-400 font-bold text-sm uppercase tracking-wider group-hover:gap-3 gap-2 transition-all">
                  Buka Layar <ArrowRight size={16} />
                </div>
            </div>
          </button>

        </div>
        
        {/* Footer */}
        <p className="mt-16 text-xs text-slate-500 font-medium">
          © 2026 MySehati. Hak Cipta Dilindungi.
        </p>

      </div>
    </main>
  );
}