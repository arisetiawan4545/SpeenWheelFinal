"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import {
  Loader2,
  Smartphone,
  CheckCircle,
  Search,
  UserCheck,
  AlertCircle,
  ArrowLeft,
  Ticket,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MemberData {
  phone: string;
  name: string;
  status: string;
}

interface AccessHistory {
  id: string; // doc id adalah nomor HP
  consumerName: string;
  campaignId: string;
  campaignName: string;
  status: "PENDING" | "USED";
  grantedAt: Date;
}

const COLLECTIONS = {
  USERS: "users",
  CAMPAIGNS: "Speen_Campaigns",
  CONSUMER_ACCESS: "Speen_ConsumerAccess",
};

export default function BeriAksesKasirPage() {
  // Tahap 1: Pencarian
  const [searchPhone, setSearchPhone] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundMember, setFoundMember] = useState<MemberData | null>(null);
  const [searchError, setSearchError] = useState("");

  // Tahap 2: Akses
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [isGranting, setIsGranting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Riwayat & UI Expandable
  const [accessHistory, setAccessHistory] = useState<AccessHistory[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Ambil daftar Program Promo LIVE
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const q = query(collection(db, COLLECTIONS.CAMPAIGNS), where("status", "==", "LIVE"));
        const snapshot = await getDocs(q);
        setCampaigns(snapshot.docs.map((d) => ({ id: d.id, name: d.data().name })));
      } catch (error) {
        console.error("Gagal memuat program:", error);
      }
    };
    fetchCampaigns();
  }, []);

  // Pantau Riwayat Akses Real-time (Filter dilepas agar riwayat muncul semua)
  useEffect(() => {
    const qHistory = query(
      collection(db, COLLECTIONS.CONSUMER_ACCESS),
      orderBy("grantedAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(qHistory, (snapshot) => {
      const historyData: AccessHistory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let grantedDate = new Date();
        if (data.grantedAt?.toDate) {
          grantedDate = data.grantedAt.toDate();
        }

        historyData.push({
          id: docSnap.id,
          consumerName: data.consumerName || "Konsumen",
          campaignId: data.campaignId,
          campaignName: data.campaignName || "Program Promo",
          status: data.status,
          grantedAt: grantedDate,
        });
      });
      setAccessHistory(historyData);
    });

    return () => unsubscribe();
  }, []);

  // Tahap 1: Cari Member
  const handleSearchMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    setIsSearching(true);
    setSearchError("");
    setFoundMember(null);

    try {
      const cleanPhone = searchPhone.replace(/\D/g, "");
      const userRef = doc(db, COLLECTIONS.USERS, cleanPhone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.status === "Active" || data.status === "Aktif") {
          setFoundMember({
            phone: cleanPhone,
            name: data.name || "Member Sehati",
            status: data.status,
          });
          setSearchPhone(cleanPhone);
        } else {
          setSearchError(`Akun member ${data.name} berstatus tidak aktif.`);
        }
      } else {
        setSearchError("Member tidak terdaftar. Periksa kembali nomor HP.");
      }
    } catch (error) {
      console.error("Error mencari member:", error);
      setSearchError("Gagal terhubung ke database server.");
    } finally {
      setIsSearching(false);
    }
  };

  // Tahap 2: Beri Akses
  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundMember || !campaignId) return;
    setIsGranting(true);
    setSuccessMsg("");

    try {
      const selectedCamp = campaigns.find((c) => c.id === campaignId);
      const kasirId = auth.currentUser?.uid || "kasir_aktif";

      await setDoc(doc(db, COLLECTIONS.CONSUMER_ACCESS, foundMember.phone), {
        consumerName: foundMember.name,
        campaignId: campaignId,
        campaignName: selectedCamp?.name || "Program Promo",
        status: "PENDING",
        grantedBy: kasirId,
        grantedAt: serverTimestamp(),
      });

      setSuccessMsg(`Akses berhasil dikirim ke aplikasi ${foundMember.name}`);
      
      setFoundMember(null);
      setSearchPhone("");
      setCampaignId("");

      setTimeout(() => {
        setSuccessMsg("");
      }, 4000);
    } catch (error) {
      console.error("Gagal memberi akses:", error);
      alert("Terjadi kesalahan sistem saat menyimpan akses.");
    } finally {
      setIsGranting(false);
    }
  };

  // Batalkan Akses
  const handleRevokeAccess = async (phoneId: string, consumerName: string) => {
    if (!confirm(`Batalkan akses spin untuk ${consumerName}?`)) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.CONSUMER_ACCESS, phoneId));
      // Tutup accordion jika yang dihapus sedang terbuka
      if (expandedId === phoneId) setExpandedId(null);
    } catch (error) {
      console.error("Gagal membatalkan akses:", error);
    }
  };

  // Toggle Accordion List Slim
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Ticket size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none">Berikan Akses Spin</h2>
            <p className="text-sm text-slate-400 mt-1.5">Verifikasi member & berikan akses undian ke ponsel konsumen.</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/50 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle size={20} className="text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300 font-medium">{successMsg}</p>
        </div>
      )}

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
        {!foundMember ? (
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-indigo-400">1</span>
              Cari & Verifikasi Member
            </h3>
            <form onSubmit={handleSearchMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nomor HP Konsumen</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Smartphone size={18} className="text-slate-500" />
                  </div>
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    required
                    disabled={isSearching}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                    placeholder="Contoh: 081234567890"
                  />
                </div>
                {searchError && (
                  <p className="text-rose-400 text-xs mt-2 flex items-center gap-1.5 font-medium">
                    <AlertCircle size={14} /> {searchError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchPhone}
                className="w-full sm:w-auto px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSearching ? <><Loader2 size={18} className="animate-spin" /> Mencari...</> : <><Search size={18} /> Cek Member</>}
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6">
            <button 
              type="button" 
              onClick={() => { setFoundMember(null); setCampaignId(""); }}
              className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={14} /> Batal & Cari Nomor Lain
            </button>

            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white shadow-sm">2</span>
              Pilih Program Promo
            </h3>

            <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                <UserCheck size={24} className="text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-white">{foundMember.name}</h4>
                <p className="text-sm text-slate-400 font-mono mt-0.5">{foundMember.phone}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/20">Member Terverifikasi</span>
              </div>
            </div>

            <form onSubmit={handleGrantAccess} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pilih Program Spin Wheel</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 px-4 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none"
                >
                  <option value="" disabled>-- Pilih Program Tersedia --</option>
                  {campaigns.length === 0 && <option value="" disabled>Tidak ada program LIVE saat ini.</option>}
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isGranting || !campaignId}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGranting ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : "Kirim Akses ke Aplikasi Konsumen"}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* RIWAYAT AKSES - DESAIN SLIM & EXPANDABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-8">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <Clock size={16} className="text-slate-400" /> Riwayat Akses Anda
          </h3>
        </div>
        
        <div className="p-0">
          {accessHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada riwayat akses yang Anda berikan hari ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {accessHistory.map((history) => {
                const isExpanded = expandedId === history.id;

                return (
                  <div key={history.id} className="bg-transparent hover:bg-slate-800/30 transition-colors">
                    {/* Header Slim (Klik untuk Expand) */}
                    <div 
                      onClick={() => toggleExpand(history.id)}
                      className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-slate-200">{history.consumerName}</span>
                        <span className="text-[10px] text-slate-500">
                          {String(history.grantedAt.getHours()).padStart(2, '0')}:{String(history.grantedAt.getMinutes()).padStart(2, '0')} WIB • {history.grantedAt.toLocaleDateString("id-ID")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Indikator Status Slim */}
                        {history.status === "USED" ? (
                          <span title="Sudah Digunakan">
                            <CheckCircle size={16} className="text-slate-500" />
                          </span>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" title="Tersedia / PENDING" />
                        )}
                        
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </div>
                    </div>

                    {/* Konten Dropdown/Expand */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 border-t border-slate-800/50 mx-5 mt-1 bg-slate-950/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-3">
                          
                          {/* Info Program yang diberikan */}
                          <div className="flex items-start gap-2">
                            <Ticket size={14} className="text-indigo-400 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Program yang Diberikan</p>
                              <p className="text-xs font-semibold text-indigo-300">{history.campaignName}</p>
                              <p className="text-[10px] font-mono text-slate-500 mt-1">No: {history.id}</p>
                            </div>
                          </div>

                          {/* Action Button: Hanya muncul jika belum digunakan */}
                          {history.status === "PENDING" && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRevokeAccess(history.id, history.consumerName); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20 w-full sm:w-auto justify-center"
                            >
                              <Trash2 size={14} /> Batalkan Akses
                            </button>
                          )}
                          
                          {history.status === "USED" && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1.5 rounded-lg w-full sm:w-auto text-center border border-slate-700">
                              Akses Telah Digunakan
                            </span>
                          )}

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}