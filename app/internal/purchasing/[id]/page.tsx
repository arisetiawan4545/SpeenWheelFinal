"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "../../../../lib/firebase";
import { doc, collection, query, where, addDoc, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Save, Trash2, AlertCircle, CheckCircle, XCircle, Settings, Gift, Image as ImageIcon, Send, Edit2, X } from "lucide-react";
import SpinWheelPreview from "../../../../components/wheel/SpinWheelPreview";

interface Campaign {
  id: string;
  name: string;
  status: string;
  tvBackgroundUrl: string;
  mobileBannerUrl: string;
  revisionNotes?: {
    tvBackground?: string;
    mobileBanner?: string;
    [slotId: string]: string | undefined; 
  };
  submittedAt?: string;
  revisedAt?: string;
  approvedAt?: string;
}

interface Slot {
  id: string;
  name: string;
  quantity: number;
  winRate: number;
  generatedCodes: string[];
  imageUrl?: string;
  color?: string;
}

function PurchasingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | string>("");
  const [winRate, setWinRate] = useState<number | string>("");
  const [pendingRevisions, setPendingRevisions] = useState<{ [key: string]: string }>({});
  const [isEditSlotModalOpen, setIsEditSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [editSlotName, setEditSlotName] = useState("");
  const [editSlotQuantity, setEditSlotQuantity] = useState<number | string>("");
  const [editSlotWinRate, setEditSlotWinRate] = useState<number | string>("");
  const [isUpdatingSlot, setIsUpdatingSlot] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const totalWinRate = slots.reduce((sum, item) => sum + item.winRate, 0);

  useEffect(() => {
    if (!campaignId) return;
    setIsLoading(true);

    const campRef = doc(db, "Speen_Campaigns", campaignId);
    const unsubscribeCamp = onSnapshot(campRef, (docSnap) => {
      if (docSnap.exists()) {
        setCampaign({ id: docSnap.id, ...docSnap.data() } as Campaign);
      }
    });

    const q = query(collection(db, "Speen_CampaignSlots"), where("campaignId", "==", campaignId));
    const unsubscribeSlots = onSnapshot(q, (snapshot) => {
      const slotData: Slot[] = [];
      snapshot.forEach((doc) => slotData.push({ id: doc.id, ...doc.data() } as Slot));
      setSlots(slotData);
      setIsLoading(false);
    });

    return () => {
      unsubscribeCamp();
      unsubscribeSlots();
    };
  }, [campaignId]);

  const generateUniqueCodes = (qty: number) => {
    const codes = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < qty; i++) {
      let code = 'MYSH-';
      for (let j = 0; j < 6; j++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      codes.push(code);
    }
    return codes;
  };

  const toggleSlotExpand = (slotId: string) => {
    setExpandedSlotId(prev => prev === slotId ? null : slotId);
  };

  const openEditSlotModal = (slot: Slot) => {
    setEditingSlot(slot);
    setEditSlotName(slot.name);
    setEditSlotQuantity(slot.quantity);
    setEditSlotWinRate(slot.winRate);
    setIsEditSlotModalOpen(true);
  };

  const closeEditSlotModal = () => {
    setIsEditSlotModalOpen(false);
    setEditingSlot(null);
  };

const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editSlotName || editSlotQuantity === "" || editSlotWinRate === "") return;

    const qtyNum = Number(editSlotQuantity);
    const winRateNum = Number(editSlotWinRate);
    const projectedTotalWinRate = (totalWinRate - editingSlot.winRate) + winRateNum;

    if (projectedTotalWinRate > 100) {
        const maxAllowedRate = 100 - (totalWinRate - editingSlot.winRate);
        return alert(`Gagal! Mengubah rate menjadi ${winRateNum}% akan membuat total rate melebihi 100%.\nMaksimal Win Rate untuk slot ini adalah ${maxAllowedRate}%.`);
    }


    setIsUpdatingSlot(true);
    try {
      await updateDoc(doc(db, "Speen_CampaignSlots", editingSlot.id), {
        name: editSlotName,
        quantity: qtyNum,
        winRate: winRateNum,
      });
      alert("Data slot berhasil diperbarui!");
      closeEditSlotModal();
    } catch (error) {
      console.error("Gagal update slot:", error);
      alert("Terjadi kesalahan saat memperbarui slot.");
    } finally {
      setIsUpdatingSlot(false);
    }
  };

const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || quantity === "" || winRate === "") return;
    if (slots.length >= 10) {
        return alert("Batas maksimal 10 slot hadiah!");
    }

    const qtyNum = Number(quantity);
    const winRateNum = Number(winRate);
    const projectedTotalWinRate = totalWinRate + winRateNum;
    
    if (projectedTotalWinRate > 100) {
        const sisaRate = 100 - totalWinRate;
        return alert(`Gagal! Menambahkan ${winRateNum}% akan membuat total rate melebihi 100%.\nSisa Win Rate yang tersedia saat ini hanya ${sisaRate}%.`);
    }

    const newCodes = generateUniqueCodes(qtyNum);

    try {
      await addDoc(collection(db, "Speen_CampaignSlots"), {
        campaignId,
        name,
        quantity: qtyNum,
        winRate: winRateNum,
        generatedCodes: newCodes,
        color: "#4f46e5",
        imageUrl: ""      
      });
      setName("");
      setQuantity("");
      setWinRate("");
    } catch (error) {
      console.error("Gagal menambah slot:", error);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (confirm("Hapus slot hadiah ini?")) {
      await deleteDoc(doc(db, "Speen_CampaignSlots", slotId));
    }
  };

  const handleAddRevisionNote = (key: string, componentName: string) => {
    const note = window.prompt(`Catatan Revisi untuk [${componentName}]:\nApa yang harus diperbaiki?`);
    if (note) {
      setPendingRevisions(prev => ({ ...prev, [key]: note }));
    }
  };

  const handleRemoveRevisionNote = (key: string) => {
    const newRevisions = { ...pendingRevisions };
    delete newRevisions[key];
    setPendingRevisions(newRevisions);
  };

  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleString('id-ID', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleSendRevisions = async () => {
    if (!campaign) return;
    try {
      const mergedNotes = { ...(campaign.revisionNotes || {}), ...pendingRevisions };
      await updateDoc(doc(db, "Speen_Campaigns", campaign.id), { 
        status: "REVISION",
        revisionNotes: mergedNotes,
        revisedAt: getFormattedDate() 
      });
      alert("Catatan revisi berhasil dikirim ke MCX!");
      setPendingRevisions({}); 
    } catch (error) {
      console.error("Gagal mengirim revisi:", error);
    }
  };

  const handleApproveAll = async () => {
    if (!campaign) return;

    if (slots.length < 3) {
      return alert("Gagal! Minimal harus ada 3 slot hadiah untuk menyetujui program ini.");
    }

    if (totalWinRate !== 100) {
      return alert(`Gagal! Total Win Rate saat ini adalah ${totalWinRate}%. Harus pas 100% untuk bisa disetujui.`);
    }

    if(confirm("Apakah Anda yakin menyetujui desain ini? Program akan berstatus APPROVED (Siap Tayang).")) {
        try {
            await updateDoc(doc(db, "Speen_Campaigns", campaign.id), { 
              status: "APPROVED",
              revisionNotes: {},
              approvedAt: getFormattedDate() 
            });
            alert("Mantap! Desain disetujui. Silakan aktifkan (ON) program di Dashboard utama.");
            router.push("/internal/purchasing");
        } catch (error) {
            console.error("Gagal approve:", error);
        }
    }
  };


  if (campaign?.status === "LIVE") {
    return (
      <main className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-slate-200 p-8 font-sans">
        <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center max-w-md shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Program Sedang LIVE</h1>
          <p className="text-slate-400 mb-8">
            Program <span className="font-bold text-white">{campaign.name}</span> saat ini sedang tayang di layar TV toko. Perubahan data dan revisi desain dikunci sementara.
          </p>
          <button 
            onClick={() => router.push("/internal/purchasing")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} /> Kembali ke Dashboard
          </button>
          <p className="text-xs text-slate-500 mt-4">
            (Matikan sakelar 'Status Live' di Dashboard utama jika ingin mengedit kembali)
          </p>
        </div>
      </main>
    );
  }

  if (isLoading) return <div className="min-h-screen bg-[#0f172a] text-white p-8">Memuat Data...</div>;
  if (!campaign) return <div className="min-h-screen bg-[#0f172a] text-white p-8">Program tidak ditemukan.</div>;
  const isEditable = campaign.status === "WAITING_DESIGN" || campaign.status === "WAITING_APPROVAL" || campaign.status === "REVISION" || campaign.status === "DRAFT" || campaign.status === "APPROVED";
  const savedNotes = campaign.revisionNotes || {};
  const numPendingRevisions = Object.keys(pendingRevisions).length;
  const isDraftRevising = (key: string) => !!pendingRevisions[key];
  const isSentRevising = (key: string) => !!savedNotes[key];
  const isHidingImage = (key: string) => isDraftRevising(key) || isSentRevising(key);

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 sm:p-8 font-sans relative">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push("/internal/purchasing")} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 mb-6 transition-colors">
          <ArrowLeft size={20} /> Kembali ke Dashboard
        </button>

        {/* HEADER PROGRAM */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{campaign.name}</h1>
            <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border border-slate-700">
              Status: <span className={campaign.status === "APPROVED" ? "text-emerald-400" : "text-amber-400"}>{campaign.status}</span>
            </span>
          </div>
        </div>

        {/* KOTAK REVIEW DESAIN (Hanya muncul jika sedang proses Approval) */}
        {(campaign.status === "WAITING_APPROVAL" || campaign.status === "REVISION" || campaign.status === "APPROVED") && (
          <div className="bg-blue-900/10 border border-blue-500/30 rounded-2xl p-6 mb-8 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle size={24} className="text-blue-400" /> 
              {campaign.status === "REVISION" ? "Status Revisi: Menunggu Perbaikan MCX" : "Review Desain (Pilih Komponen untuk Direvisi)"}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              
              <div className={`relative p-3 rounded-xl border-2 transition-all ${isHidingImage('tvBackground') ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-300 uppercase">Background TV</p>
                    
                    {isDraftRevising('tvBackground') ? (
                        <button onClick={() => handleRemoveRevisionNote('tvBackground')} className="text-rose-400 text-xs flex items-center gap-1 hover:text-rose-300"><XCircle size={14}/> Batal</button>
                    ) : isSentRevising('tvBackground') ? (
                        <span className="text-rose-400 text-xs flex items-center gap-1 font-bold"><CheckCircle size={14}/> Revisi Terkirim</span>
                    ) : (
                        <button onClick={() => handleAddRevisionNote('tvBackground', 'Background TV')} className="text-slate-400 text-xs flex items-center gap-1 hover:text-white bg-slate-700 px-2 py-1 rounded"><AlertCircle size={12}/> Revisi Desain</button>
                    )}
                 </div>
                 
                 {campaign.tvBackgroundUrl && !isHidingImage('tvBackground') ? (
                     <img src={campaign.tvBackgroundUrl} className="w-full h-24 object-cover rounded-lg" alt="TV" />
                 ) : (
                     <div className="h-24 bg-slate-900 flex justify-center items-center rounded-lg border border-dashed border-slate-700">
                        {isHidingImage('tvBackground') ? <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Menunggu Gambar Baru</span> : <ImageIcon className="text-slate-600"/>}
                     </div>
                 )}
                 {isHidingImage('tvBackground') && <p className="mt-2 text-xs text-rose-300 italic">" {pendingRevisions['tvBackground'] || savedNotes['tvBackground']} "</p>}
              </div>

              <div className={`relative p-3 rounded-xl border-2 transition-all ${isHidingImage('mobileBanner') ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
                 <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-300 uppercase">Mobile Banner</p>
                    
                    {isDraftRevising('mobileBanner') ? (
                        <button onClick={() => handleRemoveRevisionNote('mobileBanner')} className="text-rose-400 text-xs flex items-center gap-1 hover:text-rose-300"><XCircle size={14}/> Batal</button>
                    ) : isSentRevising('mobileBanner') ? (
                        <span className="text-rose-400 text-xs flex items-center gap-1 font-bold"><CheckCircle size={14}/> Revisi Terkirim</span>
                    ) : (
                        <button onClick={() => handleAddRevisionNote('mobileBanner', 'Mobile Banner')} className="text-slate-400 text-xs flex items-center gap-1 hover:text-white bg-slate-700 px-2 py-1 rounded"><AlertCircle size={12}/> Revisi Desain</button>
                    )}
                 </div>
                 
                 {campaign.mobileBannerUrl && !isHidingImage('mobileBanner') ? (
                     <img src={campaign.mobileBannerUrl} className="w-full h-24 object-cover rounded-lg" alt="Mobile" />
                 ) : (
                     <div className="h-24 bg-slate-900 flex justify-center items-center rounded-lg border border-dashed border-slate-700">
                        {isHidingImage('mobileBanner') ? <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Menunggu Gambar Baru</span> : <ImageIcon className="text-slate-600"/>}
                     </div>
                 )}
                 {isHidingImage('mobileBanner') && <p className="mt-2 text-xs text-rose-300 italic">" {pendingRevisions['mobileBanner'] || savedNotes['mobileBanner']} "</p>}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-700/50">
                {numPendingRevisions > 0 ? (
                    <button onClick={handleSendRevisions} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(225,29,72,0.3)]">
                        <Send size={18} /> Kirim {numPendingRevisions} Catatan Revisi Baru
                    </button>
                ) : campaign.status === "REVISION" ? (
                    <div className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold flex justify-center items-center gap-2 border border-slate-700">
                        <AlertCircle size={18} /> Menunggu Tim MCX Memperbaiki Desain...
                    </div>
                ) : campaign.status === "APPROVED" ? (
                    <div className="flex-1 bg-emerald-900/30 text-emerald-400 py-3 rounded-xl font-bold flex justify-center items-center gap-2 border border-emerald-700/50">
                        <CheckCircle size={18} /> Desain Telah Disetujui (Aktifkan Switch LIVE di Dashboard)
                    </div>
                ) : (
                    <button onClick={handleApproveAll} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)]">
                        <CheckCircle size={18} /> Desain Bagus, Setujui (Standby)
                    </button>
                )}
            </div>
          </div>
        )}

        {/* PREVIEW TV */}
        {(campaign.status === "WAITING_APPROVAL" || campaign.status === "REVISION" || campaign.status === "APPROVED") && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Settings size={24} className="text-indigo-400" /> Preview Final Monitor TV</h2>
            <SpinWheelPreview 
               slots={slots.map(s => ({
                   ...s,
                   imageUrl: isHidingImage(s.id) ? undefined : s.imageUrl
               }))} 
               tvBackgroundUrl={isHidingImage('tvBackground') ? undefined : campaign.tvBackgroundUrl} 
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KOLOM KIRI: SETUP HADIAH */}
          <div className="lg:col-span-1">
            <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-8 ${!isEditable ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Settings size={20} className="text-indigo-400" /> Setup Hadiah</h3>
              <form onSubmit={handleAddSlot} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Item</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Stok / Kuota Pemenang</label><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required min="0" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Win Rate (%)</label><input type="number" value={winRate} onChange={(e) => setWinRate(e.target.value)} required min="0" max="100" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" /></div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"><Save size={18} /> Tambah Slot</button>
              </form>
            </div>
          </div>

          {/* KOLOM KANAN: INVENTORY SLOT (ACCORDION & WINRATE DI HEADER) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* HEADER INVENTORY & WIN RATE */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 border-b border-slate-700/50 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift size={20} className="text-indigo-400" /> Inventory Slot ({slots.length}/10)
              </h3>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Total Rate:</span>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${totalWinRate === 100 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                   {totalWinRate}% 
                </span>
                {totalWinRate !== 100 && (
                   <span className="text-[10px] text-rose-300 italic">
                     ({totalWinRate < 100 ? `Kurang ${100 - totalWinRate}%` : `Lebih ${totalWinRate - 100}%`})
                   </span>
                )}
              </div>
            </div>
            
            {/* LIST SLOT */}
            {slots.map((slot) => {
                const isRevising = isHidingImage(slot.id);
                const isExpanded = expandedSlotId === slot.id;

                return (
                <div key={slot.id} className={`border rounded-2xl flex flex-col overflow-hidden transition-all ${isRevising ? 'bg-rose-500/10 border-rose-500' : 'bg-slate-900 border-slate-800'}`}>
                  
                  {/* BAGIAN ATAS CARD */}
                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 flex items-center gap-4">
                        {slot.imageUrl && !isRevising ? (
                            <img src={slot.imageUrl} className="w-12 h-12 object-contain bg-slate-800 rounded-xl border border-slate-600 p-1" alt={slot.name} />
                        ) : (
                            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${isRevising ? 'bg-rose-950/50 border-rose-500/50 text-rose-400 border-dashed' : 'bg-slate-800/50 border-slate-700 border-dashed text-slate-500'}`}>
                                <ImageIcon size={20} />
                            </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                               <h4 className="text-base font-bold text-white">{slot.name}</h4>
                               {slot.color && <span className="w-4 h-4 rounded-full border border-white/20" style={{backgroundColor: slot.color}}></span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-1 rounded-md font-bold border border-slate-700 uppercase">Stok: {slot.quantity}</span>
                            <span className="bg-indigo-900/40 text-indigo-300 text-[10px] px-2 py-1 rounded-md font-bold border border-indigo-500/30 uppercase">Win Rate: {slot.winRate}%</span>
                            
                            {/* TOMBOL LIHAT KODE */}
                            <button 
                                onClick={() => toggleSlotExpand(slot.id)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] px-2 py-1 rounded-md border border-slate-600 transition-colors flex items-center gap-1"
                            >
                                {isExpanded ? 'Tutup Detail' : 'Lihat Kode'} 
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2 sm:mt-0">
                        {(campaign.status === "WAITING_APPROVAL" || campaign.status === "REVISION" || campaign.status === "APPROVED") && (
                            isDraftRevising(slot.id) ? (
                                <button onClick={() => handleRemoveRevisionNote(slot.id)} className="px-3 py-1.5 text-xs font-bold text-rose-400 border border-rose-400 rounded-lg hover:bg-rose-900/30">Batal</button>
                            ) : isSentRevising(slot.id) ? (
                                <span className="px-3 py-1.5 text-xs font-bold text-rose-400 bg-rose-900/30 border border-rose-400/50 rounded-lg flex items-center gap-1"><CheckCircle size={14}/> Revisi Terkirim</span>
                            ) : (
                                <button onClick={() => handleAddRevisionNote(slot.id, `Slot ${slot.name}`)} className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-700 flex items-center gap-1"><AlertCircle size={14}/> Revisi Desain</button>
                            )
                        )}

                        {isEditable && (
                          <>
                            <button onClick={() => openEditSlotModal(slot)} className="p-2 text-slate-500 hover:text-indigo-400 bg-slate-800 rounded-xl" title="Edit Data Slot"><Edit2 size={18} /></button>
                            <button onClick={() => handleDeleteSlot(slot.id)} className="p-2 text-slate-500 hover:text-rose-400 bg-slate-800 rounded-xl" title="Hapus Slot"><Trash2 size={18} /></button>
                          </>
                        )}
                      </div>
                  </div>
                  {isRevising && <div className="text-xs text-rose-300 italic px-5 pb-3 bg-slate-900">" {pendingRevisions[slot.id] || savedNotes[slot.id]} "</div>}

                  {/* ACCORDION DETAIL KODE VOUCHER */}
                  {isExpanded && (
                      <div className="bg-slate-950/50 border-t border-slate-800 p-5">
                          <h5 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center justify-between">
                             Daftar Kode ({slot.generatedCodes?.length || 0})
                             <span className="text-[10px] text-slate-500 font-normal normal-case">Hanya bisa dibaca (Auto-generated)</span>
                          </h5>
                          
                          {(!slot.generatedCodes || slot.generatedCodes.length === 0) ? (
                              <p className="text-xs text-slate-500 italic">Belum ada kode yang di-generate.</p>
                          ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {slot.generatedCodes.map((code, idx) => (
                                      <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex justify-between items-center group">
                                          <span className="font-mono text-xs text-slate-300">{code}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                </div>
              )})}
          </div>
        </div>
      </div>

      {/* POP-UP MODAL EDIT SLOT */}
      {isEditSlotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={closeEditSlotModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Edit2 size={20} className="text-indigo-400" /> Edit Slot Hadiah
            </h2>
            <form onSubmit={handleUpdateSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Item</label>
                <input type="text" value={editSlotName} onChange={(e) => setEditSlotName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Stok / Kuota</label>
                <input type="number" value={editSlotQuantity} onChange={(e) => setEditSlotQuantity(e.target.value)} required min="0" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                <p className="text-[10px] text-amber-500 mt-1 italic">*Perhatian: Mengubah stok tidak akan mengenerate ulang kode voucher yang sudah ada.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Win Rate (%)</label>
                <input type="number" value={editSlotWinRate} onChange={(e) => setEditSlotWinRate(e.target.value)} required min="0" max="100" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              
              <button type="submit" disabled={isUpdatingSlot} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg mt-6">
                {isUpdatingSlot ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
// 4. PEMBUNGKUS SUSPENSE (Taro di sini, paling bawah)
export default function PurchasingDetail() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f172a] text-white p-8 flex items-center justify-center">Memuat Halaman Detail...</div>}>
      <PurchasingDetailContent />
    </Suspense>
  );
}