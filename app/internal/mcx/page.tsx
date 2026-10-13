"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Palette, Image as ImageIcon, ArrowRight, LayoutDashboard, LogOut } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status: string;
  tvBackgroundUrl?: string;
  mobileBannerUrl?: string;
  revisionNote?: string;
  submittedAt?: string;
  revisedAt?: string;
  approvedAt?: string;
}

export default function MCXDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const q = query(collection(db, "Speen_Campaigns"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Campaign[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Campaign);
      });
      setCampaigns(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  if (!currentUser) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Memuat...</div>;

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER MCX */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-600/20 border border-pink-500/30 rounded-xl flex items-center justify-center text-pink-400">
              <Palette size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard MCX</h1>
              <p className="text-sm text-slate-400">Kelola aset visual, banner, dan warna roda UI.</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-rose-400 transition-colors bg-slate-800 hover:bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700">
            <LogOut size={16} /> Keluar
          </button>
        </div>

        {/* DAFTAR PROGRAM UNTUK DIDESAIN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <ImageIcon size={20} className="text-pink-400" /> Antrean Desain Event
          </h2>

          {campaigns.length === 0 ? (
            <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <Palette size={48} className="text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">Belum ada antrean event promosi.</p>
              <p className="text-slate-500 text-sm mt-1">Tunggu tim Purchasing membuat event baru.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {campaigns.map((camp) => {
                const isLocked = camp.status === "LIVE" || camp.status === "APPROVED" || camp.status === "WAITING_APPROVAL";

                return (
                  <div key={camp.id} className="bg-slate-800/50 border border-slate-700 hover:border-pink-500/50 rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 group">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white">{camp.name}</h3>
                        <StatusBadge status={camp.status} />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">Periode: {camp.startDate} s/d {camp.endDate}</p>
                    </div>
                    
                    <div className="mt-2 pt-4 border-t border-slate-700 flex flex-col gap-3">
                      
                      {/* INFO WAKTU / TIMESTAMP */}
                      <div className="text-[11px] text-slate-400 flex flex-col gap-1">
                        {camp.status === "WAITING_APPROVAL" && (
                          <p>Kirim Review: <span className="text-slate-300 font-medium">{camp.submittedAt || "Belum ada data"}</span></p>
                        )}
                        {camp.status === "REVISION" && (
                          <p>Revisi Terakhir: <span className="text-slate-300 font-medium">{camp.revisedAt || "Belum ada data"}</span></p>
                        )}
                        {(camp.status === "APPROVED" || camp.status === "LIVE") && (
                          <p>Di-approve Pada: <span className="text-slate-300 font-medium">{camp.approvedAt || "Belum ada data"}</span></p>
                        )}
                      </div>

                      {/* TOMBOL AKSI */}
                      <div className="flex justify-end">
                        <button 
                          onClick={() => router.push(`/internal/mcx/${camp.id}`)}
                          disabled={isLocked}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-lg 
                          ${isLocked 
                            ? "bg-slate-700/50 text-slate-500 cursor-not-allowed shadow-none" 
                            : "bg-pink-600 hover:bg-pink-500 text-white"
                          }`}
                        >
                          Atur Desain <ArrowRight size={16} className={isLocked ? "opacity-50" : ""} />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
} // INI PENUTUP YANG SEBELUMNYA KURANG

function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-800 text-slate-400";
  let label = status;

  if (status === "WAITING_DESIGN") {
    colorClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    label = "Butuh Desain";
  } else if (status === "WAITING_APPROVAL") {
    colorClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    label = "Menunggu Acc Purchasing";
  } else if (status === "REVISION") {
    colorClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    label = "Revisi Desain";
  } else if (status === "LIVE") {
    colorClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    label = "Live / Aktif";
  } else if (status === "APPROVED") {
    colorClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    label = "Approved";
  }

  return (
    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
      {label}
    </span>
  );
}