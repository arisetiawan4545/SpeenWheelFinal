"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Package, Plus, ArrowRight, LogOut, LayoutDashboard, Trash2, Edit2, X, QrCode, CheckCircle2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react"; 

interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function PurchasingDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // State form buat event baru
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk Edit Pop-up
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // --- STATE UNTUK FITUR DOWNLOAD QR MONITOR ---
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false); 
  const [hiddenQrToken, setHiddenQrToken] = useState(""); 
  const qrRef = useRef<HTMLDivElement>(null);

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

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "Speen_Campaigns"), {
        name,
        startDate,
        endDate,
        status: "WAITING_DESIGN",
        createdAt: new Date(),
        tvBackgroundUrl: "",
        mobileBannerUrl: "",
      });
      setName("");
      setStartDate("");
      setEndDate("");
      alert("Event berhasil dibuat! Silakan klik panah kanan untuk mengatur hadiah.");
    } catch (error) {
      console.error("Gagal buat event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus event "${campaignName}" secara permanen? Semua data terkait akan hilang.`)) {
      try {
        await deleteDoc(doc(db, "Speen_Campaigns", campaignId));
        alert("Event berhasil dihapus.");
      } catch (error) {
        console.error("Gagal menghapus event:", error);
        alert("Gagal menghapus event.");
      }
    }
  };

  const openEditModal = (camp: Campaign) => {
    setEditingCampaign(camp);
    setEditName(camp.name);
    setEditStartDate(camp.startDate);
    setEditEndDate(camp.endDate);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCampaign(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign || !editName || !editStartDate || !editEndDate) return;
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "Speen_Campaigns", editingCampaign.id), {
        name: editName,
        startDate: editStartDate,
        endDate: editEndDate,
      });
      alert("Event berhasil diperbarui!");
      closeEditModal();
    } catch (error) {
      console.error("Gagal memperbarui event:", error);
      alert("Terjadi kesalahan saat memperbarui event.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleLive = async (campaignId: string, currentStatus: string, isChecked: boolean) => {
    if (currentStatus !== "APPROVED" && currentStatus !== "LIVE") {
        alert("Desain belum disetujui! Anda belum bisa mengaktifkan program ini.");
        return;
    }
    const newStatus = isChecked ? "LIVE" : "APPROVED";
    try {
        await updateDoc(doc(db, "Speen_Campaigns", campaignId), { status: newStatus });
    } catch (error) {
        console.error("Gagal mengubah status LIVE:", error);
    }
  };

  // --- FUNGSI DOWNLOAD QR MONITOR PERMANEN ---
  const handleGenerateAndDownloadQR = async () => {
    setIsGeneratingQr(true);
    try {
      // 1. Gunakan ID Fix / Statis untuk Monitor (Tidak acak lagi)
      // Nanti di aplikasi mobile, saat scan kode ini, sistem tahu harus konek ke TV mana.
      const monitorId = "SPEEN-MONITOR-MAIN";
      
      // 2. Set Token untuk dirender ke Canvas tersembunyi
      setHiddenQrToken(monitorId);
      
      // 3. Kasih jeda sedikit biar Canvas React sempat merender QR-nya lalu download
      setTimeout(() => {
        downloadQrImage(monitorId);
        
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        
        setHiddenQrToken(""); 
        setIsGeneratingQr(false);
      }, 500);

    } catch (error) {
      console.error("Gagal mendownload QR:", error);
      alert("Terjadi kesalahan sistem.");
      setIsGeneratingQr(false);
    }
  };

  const downloadQrImage = (id: string) => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR-KONEKSI-${id}.png`; // Nama file download
      document.body.appendChild(downloadLink);
      downloadLink.click(); 
      document.body.removeChild(downloadLink);
    }
  };

  if (!currentUser) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Memuat...</div>;

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 sm:p-8 font-sans relative">
      
      {/* KANVAS QR TERSEMBUNYI */}
      <div style={{ display: "none" }} ref={qrRef}>
        {hiddenQrToken && (
          <QRCodeCanvas 
            value={hiddenQrToken} 
            size={400} 
            level={"H"} 
            includeMargin={true}
          />
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard Purchasing</h1>
              <p className="text-sm text-slate-400">Kelola master data event & QR Monitor.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto relative">
            
            {/* NOTIFIKASI TOAST BERHASIL */}
            <div className={`absolute -top-12 right-0 left-0 sm:left-auto bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300 ${showSuccessToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
              <CheckCircle2 size={16} /> QR Monitor Berhasil Diunduh!
            </div>

            {/* TOMBOL DOWNLOAD QR MONITOR */}
            <button 
              onClick={handleGenerateAndDownloadQR} 
              disabled={isGeneratingQr} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-lg font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
            >
              <QrCode size={18} /> {isGeneratingQr ? "Memproses..." : "Download QR Monitor"}
            </button>
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-rose-400 transition-colors bg-slate-800 hover:bg-slate-800/80 px-4 py-2.5 rounded-lg border border-slate-700">
              <LogOut size={16} /> <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KOLOM KIRI: BUAT EVENT BARU */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-8 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Plus size={20} className="text-indigo-400" /> Buat Event Baru
              </h2>
              
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Event Promo</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Misal: Gebyar Kemerdekaan" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanggal Mulai</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanggal Berakhir</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg mt-4 flex justify-center items-center gap-2">
                  {isSubmitting ? "Menyimpan..." : "Simpan & Buat Program"}
                </button>
              </form>
            </div>
          </div>

          {/* KOLOM KANAN: DAFTAR EVENT */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Package size={20} className="text-indigo-400" /> Daftar Event Promo
            </h2>

            {campaigns.length === 0 ? (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <Package size={48} className="text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg">Belum ada event promosi.</p>
                <p className="text-slate-500 text-sm mt-1">Buat event pertama Anda menggunakan form di samping.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((camp) => {
                  const isToggleable = camp.status === "APPROVED" || camp.status === "LIVE";
                  
                  return (
                  <div key={camp.id} className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                    <div className="flex-1">
                      <div className="flex items-center justify-between sm:justify-start gap-4 mb-1">
                         <h3 className="text-lg font-bold text-white">{camp.name}</h3>
                         <div className="flex items-center gap-2">
                             <button 
                               onClick={() => openEditModal(camp)}
                               className="text-slate-500 hover:text-indigo-400 transition-colors"
                               title="Edit Program"
                             >
                               <Edit2 size={16} />
                             </button>
                             <button 
                               onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                               className="text-slate-500 hover:text-rose-400 transition-colors"
                               title="Hapus Program"
                             >
                               <Trash2 size={16} />
                             </button>
                         </div>
                      </div>
                      <p className="text-xs text-slate-400 font-medium mb-3">Periode: {camp.startDate} s/d {camp.endDate}</p>
                      <StatusBadge status={camp.status} />
                    </div>
                    
                    <div className="flex items-center gap-6 mt-4 sm:mt-0">
                      <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Status Live</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={camp.status === "LIVE"} 
                              disabled={!isToggleable}
                              onChange={(e) => handleToggleLive(camp.id, camp.status, e.target.checked)} 
                            />
                            <div className={`w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer 
                              peer-checked:after:translate-x-full peer-checked:after:border-white 
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                              after:bg-white after:border-gray-300 after:border after:rounded-full 
                              after:h-5 after:w-5 after:transition-all 
                              ${!isToggleable ? 'opacity-40 cursor-not-allowed' : 'peer-checked:bg-emerald-500'}`}>
                            </div>
                          </label>
                      </div>

                      <button 
                        onClick={() => {
                          if (camp.status === "LIVE") {
                            alert("Program sedang LIVE / Tayang di toko!\nMatikan dulu sakelar 'Status Live' untuk melakukan perubahan stok atau revisi desain.");
                            return;
                          }
                          router.push(`/internal/purchasing/${camp.id}`);
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                          camp.status === "LIVE" 
                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' 
                            : 'bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white border-slate-700'
                        }`}
                        title={camp.status === "LIVE" ? "Matikan Live untuk mengedit" : "Buka Detail Program"}
                      >
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* POP-UP MODAL EDIT EVENT */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={closeEditModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Edit2 size={20} className="text-indigo-400" /> Edit Event
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Event Promo</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanggal Mulai</label>
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tanggal Berakhir</label>
                <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <button type="submit" disabled={isUpdating} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg mt-6">
                {isUpdating ? "Memperbarui..." : "Simpan Perubahan"}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}

// Komponen Badge Status
function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-800 text-slate-400 border-slate-700";
  let label = status;

  if (status === "WAITING_DESIGN") {
    colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    label = "Menunggu Desain MCX";
  } else if (status === "WAITING_APPROVAL") {
    colorClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    label = "Review Desain";
  } else if (status === "REVISION") {
    colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    label = "Revisi Desain";
  } else if (status === "APPROVED") {
    colorClass = "bg-slate-500/20 text-slate-300 border-slate-500/30";
    label = "Standby (Siap Tayang)";
  } else if (status === "LIVE") {
    colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
    label = "LIVE / AKTIF";
  }

  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {label}
    </span>
  );
}