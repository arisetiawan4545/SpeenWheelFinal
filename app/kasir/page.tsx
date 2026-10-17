"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, COLLECTIONS } from "../../lib/firebase";
import { Loader2, Gift, ChevronDown, ChevronUp, Ticket, CheckCircle2, Bell } from "lucide-react";
import { SpeenCampaign, SpeenSlot, SpeenVoucher } from "../../types";

export default function KasirDashboard() {
  const [campaigns, setCampaigns] = useState<SpeenCampaign[]>([]);
  const [voucherStatuses, setVoucherStatuses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // State untuk melacak Accordion (Buka/Tutup)
  const [expandedCampaigns, setExpandedCampaigns] = useState<string[]>([]);
  const [expandedSlots, setExpandedSlots] = useState<string[]>([]);

  useEffect(() => {
    const fetchCampaignsAndSlots = async () => {
      try {
        const qCampaign = query(collection(db, COLLECTIONS.CAMPAIGNS), where("status", "==", "LIVE"));
        const campaignSnap = await getDocs(qCampaign);
        const activeCampaigns = campaignSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpeenCampaign));
        
        let currentVoucherStatus: Record<string, string> = {};

        const campaignsWithSlots = await Promise.all(
          activeCampaigns.map(async (camp) => {
            // Ambil Slot Hadiah
            const qSlots = query(collection(db, COLLECTIONS.SLOTS), where("campaignId", "==", camp.id));
            const slotsSnap = await getDocs(qSlots);
            const slotsData = slotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpeenSlot));
            
            // Ambil Data Voucher untuk cek status claim (berdasarkan campaign)
            const qVouchers = query(collection(db, COLLECTIONS.VOUCHERS), where("campaignId", "==", camp.id));
            const vouchersSnap = await getDocs(qVouchers);
            vouchersSnap.docs.forEach(doc => {
              const v = doc.data() as SpeenVoucher;
              if (v.voucherCode) {
                currentVoucherStatus[v.voucherCode] = v.status; // "AVAILABLE" atau "CLAIMED"
              }
            });

            return { ...camp, slots: slotsData };
          })
        );

        setVoucherStatuses(currentVoucherStatus);
        setCampaigns(campaignsWithSlots);
        
        // Buka otomatis campaign pertama saat halaman dimuat
        if (campaignsWithSlots.length > 0) {
          setExpandedCampaigns([campaignsWithSlots[0].id]);
        }
      } catch (error) {
        console.error("Gagal mengambil data program:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignsAndSlots();
  }, []);

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const toggleSlot = (id: string) => {
    setExpandedSlots(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-slate-400">Memuat program dan kuota...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-md mx-auto sm:max-w-full">
      
      {/* ========================================== */}
      {/* HEADER WEB MOBILE */}
      {/* ========================================== */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        {/* Dekorasi Background Glow */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            {/* Tempat Logo */}
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2 shadow-inner">
              <img 
                src="/logo.png" 
                alt="Speen Logo" 
                className="w-full h-full object-contain drop-shadow-md"
                // Mencegah image broken (alt text tampil) jika file logo belum ada
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            
            {/* Teks Header */}
            <div>
              <h1 className="text-xl font-black text-white tracking-wide">
                SPEEN<span className="text-indigo-400">KASIR</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Control Panel
              </p>
            </div>
          </div>
          
          {/* Icon Tambahan (Misal: Notifikasi / Pengaturan) */}
          <button className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <Bell size={18} />
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* KONTEN UTAMA */}
      {/* ========================================== */}
      <div className="px-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Program Aktif
        </h2>
        <p className="text-xs text-slate-400 mt-1">Pantau sisa kuota hadiah dan status voucher harian.</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-center">
          <p className="text-slate-400 text-sm">Tidak ada program Spin Wheel yang sedang aktif saat ini.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((camp) => {
            const isCampExpanded = expandedCampaigns.includes(camp.id);

            return (
              <div key={camp.id} className="bg-slate-800/80 border border-slate-700 rounded-2xl shadow-lg overflow-hidden transition-all duration-300">
                {/* HEADER CAMPAIGN (Bisa diklik) */}
                <div 
                  onClick={() => toggleCampaign(camp.id)}
                  className="flex justify-between items-center p-5 cursor-pointer bg-slate-800 hover:bg-slate-700/80 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-white">{camp.name}</h3>
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/30">Live</span>
                    </div>
                  </div>
                  <div className="text-slate-400">
                    {isCampExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* KONTEN SLOTS (Muncul jika Campaign dibuka) */}
                {isCampExpanded && (
                  <div className="p-4 pt-0 space-y-3 bg-slate-800/50 border-t border-slate-700/50 mt-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-3 mb-2 px-1">Daftar Hadiah:</p>
                    
                    {camp.slots && camp.slots.length > 0 ? (
                      camp.slots.map((slot, idx) => {
                        const isSlotExpanded = expandedSlots.includes(slot.id);

                        return (
                          <div key={idx} className="bg-slate-900/60 rounded-xl border border-slate-700/50 overflow-hidden">
                            {/* HEADER SLOT (Bisa diklik) */}
                            <div 
                              onClick={() => toggleSlot(slot.id)}
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/60 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${slot.color}20`, border: `1px solid ${slot.color}40` }}>
                                  <Gift size={14} style={{ color: slot.color }} />
                                </div>
                                <span className="text-sm font-medium text-slate-200">{slot.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold ${slot.quantity > 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                  {slot.quantity} sisa
                                </span>
                                <div className="text-slate-500">
                                  {isSlotExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </div>
                            </div>

                            {/* KONTEN KODE VOUCHER (Muncul jika Slot dibuka) */}
                            {isSlotExpanded && (
                              <div className="bg-[#0b1121] p-3 border-t border-slate-800 space-y-2">
                                {slot.generatedCodes && slot.generatedCodes.length > 0 ? (
                                  slot.generatedCodes.map((code, codeIdx) => {
                                    const status = voucherStatuses[code];
                                    const isClaimed = status === "CLAIMED";
                                    
                                    return (
                                      <div key={codeIdx} className="flex items-center justify-between py-1.5 px-2 bg-slate-800/30 rounded border border-slate-700/30">
                                        <div className="flex items-center gap-2">
                                          <Ticket size={12} className={isClaimed ? "text-slate-500" : "text-emerald-400"} />
                                          <span className={`text-xs font-mono tracking-wider ${isClaimed ? "text-slate-500 line-through" : "text-slate-300"}`}>
                                            {code}
                                          </span>
                                        </div>
                                        {isClaimed ? (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                            <CheckCircle2 size={10} /> DIKLAIM
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-emerald-400/70">
                                            Belum Digunakan
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-xs text-slate-500 italic text-center py-2">Belum ada kode ter-generate.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-xs text-slate-500 italic px-1">Belum ada slot hadiah untuk program ini.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}