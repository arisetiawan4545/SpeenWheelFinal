"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, storage } from "../../../../lib/firebase";
import { doc, collection, query, where, updateDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  ArrowLeft,
  Upload,
  Palette,
  Image as ImageIcon,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle,
  Download,
  Layers,
} from "lucide-react";
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
}

interface Slot {
  id: string;
  name: string;
  quantity: number;
  winRate: number;
  imageUrl?: string;
  color?: string;
}

function MCXDetailContent() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleCampaignUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "tvBackgroundUrl" | "mobileBannerUrl"
  ) => {
    if (!e.target.files || !e.target.files[0] || !campaign) return;
    const file = e.target.files[0];
    setIsUploading(true);

    try {
      const storageRef = ref(storage, `campaign_assets/${campaign.id}/${field}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "Speen_Campaigns", campaign.id), { [field]: downloadURL });
    } catch (error) {
      console.error("Gagal upload:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSlotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `slot_assets/${slotId}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "Speen_CampaignSlots", slotId), { imageUrl: downloadURL });
    } catch (error) {
      console.error("Gagal upload slot:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // FITUR BARU 1: Upload 1 Gambar Kanvas Persegi Sekaligus ke Semua Slot
  const handleBulkMasterCanvasUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !campaign || slots.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);
    try {
      const storageRef = ref(
        storage,
        `slot_assets/master_canvas_${campaign.id}_${Date.now()}`
      );
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Terapkan URL gambar yang sama ke seluruh dokumen slot pada campaign ini
      await Promise.all(
        slots.map((slot) =>
          updateDoc(doc(db, "Speen_CampaignSlots", slot.id), { imageUrl: downloadURL })
        )
      );
    } catch (error) {
      console.error("Gagal upload kanvas master ke semua slot:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // FITUR BARU 2: Generate & Download Kanvas Panduan Slot (1200x1200px PNG)
  const handleDownloadGuideCanvas = () => {
    if (slots.length === 0) return;

    const size = 1200;
    const center = size / 2;
    const outerRadius = size / 2; // 600px (100% area SVG)
    const safeRimRadius = size * 0.468; // Area pin emas pembatas juring
    const centerBtnRadius = size * 0.11; // Area tertutup tombol SPIN tengah

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 1. Buat latar luar lingkaran agak gelap (Area Terpotong / Tidak Tampil)
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(0, 0, size, size);

    // 2. Lubangi area lingkaran roda agar transparan / terang
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Beri warna dasar semi-transparan tipis di dalam roda agar garis jelas di software desain
    ctx.fillStyle = "rgba(30, 41, 59, 0.25)";
    ctx.beginPath();
    ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    const numSlots = slots.length;
    const sliceAngle = numSlots > 1 ? 360 / numSlots : 360;

    // 3. Gambar Garis Potongan Slot & Nama Program Tiap Slot
    slots.forEach((slot, index) => {
      // Dikurangi 90 derajat karena titik 0 roda dimulai dari Jam 12 (Atas)
      const startDeg = index * sliceAngle - 90;
      const endDeg = startDeg + sliceAngle;
      const midDeg = startDeg + sliceAngle / 2;

      const startRad = (startDeg * Math.PI) / 180;
      const midRad = (midDeg * Math.PI) / 180;

      // Garis Putus-putus Pembatas Slot
      if (numSlots > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([16, 10]);
        ctx.moveTo(center, center);
        ctx.lineTo(
          center + outerRadius * Math.cos(startRad),
          center + outerRadius * Math.sin(startRad)
        );
        ctx.strokeStyle = "#facc15"; // Kuning Emas Terang
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // Titik Pin Emas di Tepi Roda
        const studX = center + safeRimRadius * Math.cos(startRad);
        const studY = center + safeRimRadius * Math.sin(startRad);
        ctx.beginPath();
        ctx.arc(studX, studY, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#fde047";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#713f12";
        ctx.stroke();
      }

      // Teks Panduan Nama Slot di Tengah Juring
      const textDist = size * 0.31;
      const textX = center + textDist * Math.cos(midRad);
      const textY = center + textDist * Math.sin(midRad);

      ctx.save();
      ctx.translate(textX, textY);

      // Kotak Latar Label supaya mudah dibaca tim MCX
      const slotTitle = `SLOT ${index + 1}`;
      const prizeName = slot.name;
      ctx.font = "bold 22px sans-serif";
      const prizeWidth = ctx.measureText(prizeName).width;
      const boxW = Math.max(prizeWidth + 44, 180);
      const boxH = 86;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 14);
      ctx.fill();
      ctx.stroke();

      // Nomor Slot
      ctx.fillStyle = "#fb7185";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slotTitle, 0, -16);

      // Nama Program / Hadiah Slot
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(prizeName, 0, 14);
      ctx.restore();
    });

    // 4. Lingkaran Batas Luar Roda (Garis Putus-putus Putih/Cyan)
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([20, 12]);
    ctx.arc(center, center, outerRadius - 3, 0, Math.PI * 2);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 5;
    ctx.stroke();

    // Lingkaran Safe Zone Dalam (Batas Pin Emas)
    ctx.beginPath();
    ctx.setLineDash([8, 8]);
    ctx.arc(center, center, safeRimRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(253, 224, 71, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 5. Area Terlarang Tombol Tengah (SPIN Button)
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, centerBtnRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(185, 28, 28, 0.88)";
    ctx.fill();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AREA TOMBOL", center, center - 10);
    ctx.fillText("SPIN", center, center + 14);
    ctx.restore();

    // 6. Indikator Jarum Penunjuk Atas (Jam 12)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center - 28, 0);
    ctx.lineTo(center + 28, 0);
    ctx.lineTo(center, 48);
    ctx.closePath();
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fde047";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POSISI JARUM PENUNJUK (ATAS)", center, 72);
    ctx.restore();

    // 7. Keterangan di Pojok Kiri Atas (Area Luar Lingkaran)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`PANDUAN KANVAS: ${campaign?.name || "SPEEN"}`, 28, 42);
    ctx.font = "15px sans-serif";
    ctx.fillText(`Resolusi: 1200x1200px (1:1) • Total: ${numSlots} Slot`, 28, 68);

    // Trigger Download File PNG
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const safeFileName = (campaign?.name || "speen")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    link.download = `panduan-slot-${safeFileName}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleColorChange = async (slotId: string, newColor: string) => {
    try {
      await updateDoc(doc(db, "Speen_CampaignSlots", slotId), { color: newColor });
    } catch (error) {
      console.error("Gagal update warna:", error);
    }
  };

  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmitApproval = async () => {
    if (!campaign) return;
    if (confirm("Kirim desain ini ke Purchasing untuk di-review?")) {
      try {
        await updateDoc(doc(db, "Speen_Campaigns", campaign.id), {
          status: "WAITING_APPROVAL",
          revisionNotes: {},
          submittedAt: getFormattedDate(),
        });
        alert("Desain berhasil dikirim!");
        router.push("/internal/mcx");
      } catch (error) {
        console.error("Gagal mengirim approval:", error);
      }
    }
  };

  if (isLoading)
    return <div className="min-h-screen bg-[#0f172a] text-white p-8">Memuat Data Desain...</div>;
  if (!campaign)
    return <div className="min-h-screen bg-[#0f172a] text-white p-8">Program tidak ditemukan.</div>;

  const isEditable =
    campaign.status === "WAITING_DESIGN" ||
    campaign.status === "REVISION" ||
    campaign.status === "DRAFT";
  const notes = campaign.revisionNotes || {};
  const hasRevisions = Object.keys(notes).length > 0;
  const isRevisionStatus = campaign.status === "REVISION";

  if (campaign.status === "LIVE") {
    return (
      <main className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-slate-200 p-8 font-sans">
        <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl text-center max-w-md shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Program Sedang LIVE</h1>
          <p className="text-slate-400 mb-8">
            Program <span className="font-bold text-white">{campaign.name}</span> saat ini sedang
            tayang di layar TV toko. Perubahan data dan revisi desain dikunci sementara.
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

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 sm:p-8 font-sans">
      {isUploading && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-800 p-6 rounded-2xl flex flex-col items-center">
            <Loader2 size={40} className="text-pink-500 animate-spin mb-4" />
            <p className="font-bold text-white">Mengunggah Aset...</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/internal/mcx")}
          className="flex items-center gap-2 text-pink-400 hover:text-pink-300 mb-6 transition-colors"
        >
          <ArrowLeft size={20} /> Kembali ke Daftar Desain
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 flex items-center gap-3">
              {campaign.name}
            </h1>
            <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border border-slate-700">
              Status: <span className="text-pink-400">{campaign.status}</span>
            </span>
          </div>
          {isEditable && (
            <button
              onClick={handleSubmitApproval}
              className="bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2"
            >
              <Send size={18} /> Kirim untuk Review
            </button>
          )}
        </div>

        {isRevisionStatus && hasRevisions && (
          <div className="mb-6 bg-rose-500/10 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-center gap-3">
            <AlertCircle className="text-rose-400" />
            <p className="text-rose-200 text-sm">
              Terdapat <span className="font-bold">{Object.keys(notes).length} catatan revisi</span>{" "}
              dari Purchasing. Silakan periksa komponen yang ditandai merah di bawah.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div
            className={`rounded-2xl p-6 relative overflow-hidden border-2 ${
              notes["tvBackground"]
                ? "border-rose-500 bg-rose-950/20"
                : isRevisionStatus
                ? "border-emerald-500/50 bg-slate-900"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ImageIcon size={20} className="text-pink-400" /> Background Layar TV
              </h3>
              {isRevisionStatus && !notes["tvBackground"] && (
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle size={12} /> APPROVED
                </span>
              )}
            </div>
            {notes["tvBackground"] && (
              <div className="mb-4 bg-rose-500/20 p-3 rounded-xl border border-rose-500/50 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> "{notes["tvBackground"]}"
              </div>
            )}

            <div className="w-full h-40 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative group">
              {campaign.tvBackgroundUrl ? (
                <img
                  src={campaign.tvBackgroundUrl}
                  className="w-full h-full object-cover group-hover:opacity-50"
                />
              ) : (
                <span className="text-slate-500 text-sm">Belum ada gambar</span>
              )}
              {isEditable && (
                <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                  <div className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Upload size={16} /> Ganti Gambar
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCampaignUpload(e, "tvBackgroundUrl")}
                  />
                </label>
              )}
            </div>
          </div>

          <div
            className={`rounded-2xl p-6 relative overflow-hidden border-2 ${
              notes["mobileBanner"]
                ? "border-rose-500 bg-rose-950/20"
                : isRevisionStatus
                ? "border-emerald-500/50 bg-slate-900"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ImageIcon size={20} className="text-pink-400" /> Banner Aplikasi HP
              </h3>
              {isRevisionStatus && !notes["mobileBanner"] && (
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle size={12} /> APPROVED
                </span>
              )}
            </div>
            {notes["mobileBanner"] && (
              <div className="mb-4 bg-rose-500/20 p-3 rounded-xl border border-rose-500/50 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> "{notes["mobileBanner"]}"
              </div>
            )}

            <div className="w-full h-40 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative group">
              {campaign.mobileBannerUrl ? (
                <img
                  src={campaign.mobileBannerUrl}
                  className="w-full h-full object-cover group-hover:opacity-50"
                />
              ) : (
                <span className="text-slate-500 text-sm">Belum ada banner</span>
              )}
              {isEditable && (
                <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                  <div className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Upload size={16} /> Ganti Gambar
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCampaignUpload(e, "mobileBannerUrl")}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ImageIcon size={24} className="text-pink-400" /> Live Preview Monitor
          </h3>
          <SpinWheelPreview slots={slots} tvBackgroundUrl={campaign.tvBackgroundUrl} />
        </div>

        {/* PANEL BARU: Panduan Kanvas & Bulk Upload Master Kanvas */}
        <div className="mb-6 rounded-2xl border border-pink-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-pink-950/30 p-5 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <Layers size={18} className="text-pink-400" />
                Panduan Kanvas Master Roda (1:1 Persegi)
              </h4>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Unduh gambar kanvas panduan beresolusi 1200x1200px yang sudah dilengkapi garis
                putus-putus pembatas lingkaran dan posisi nama hadiah tiap slot. Setelah selesai
                didesain, unggah 1 gambar persegi utuh ke seluruh slot sekaligus.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleDownloadGuideCanvas}
                disabled={slots.length === 0}
                className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                <Download size={16} />
                Download Kanvas Panduan ({slots.length} Slot)
              </button>

              {isEditable && (
                <label className="bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer">
                  <Upload size={16} />
                  Upload Kanvas ke Semua Slot
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBulkMasterCanvasUpload}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Palette size={24} className="text-pink-400" /> Desain Irisan Roda ({slots.length} Item)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map((slot, idx) => {
            const slotNote = notes[slot.id];
            return (
              <div
                key={slot.id}
                className={`rounded-2xl p-5 relative overflow-hidden shadow-lg group border-2 ${
                  slotNote
                    ? "border-rose-500 bg-rose-950/20"
                    : isRevisionStatus
                    ? "border-emerald-500/50 bg-slate-900"
                    : "border-slate-800 bg-slate-900"
                }`}
              >
                {slotNote && (
                  <div className="absolute top-0 left-0 w-full bg-rose-500/90 text-white text-[10px] font-bold p-1 text-center z-20">
                    REVISI: {slotNote}
                  </div>
                )}

                {isRevisionStatus && !slotNote && (
                  <div className="absolute top-0 right-0 bg-emerald-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 flex items-center gap-1">
                    <CheckCircle size={10} /> APPROVED
                  </div>
                )}

                <div
                  className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: slot.color || "#4f46e5" }}
                ></div>

                <div className={`mb-4 relative z-10 ${slotNote ? "mt-4" : ""}`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-pink-400 block mb-0.5">
                    Slot #{idx + 1}
                  </span>
                  <h4
                    className={`text-base font-bold ${
                      slotNote ? "text-rose-300" : "text-white"
                    }`}
                  >
                    {slot.name}
                  </h4>
                </div>

                <div className="flex items-end justify-between gap-4 relative z-10">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 mb-2">
                      Icon Hadiah
                    </label>
                    <label
                      className={`w-16 h-16 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden relative ${
                        isEditable ? "cursor-pointer hover:border-pink-500" : "cursor-not-allowed"
                      } transition-colors ${
                        slotNote
                          ? "border-rose-500 bg-rose-900/40"
                          : "border-slate-600 bg-slate-800"
                      }`}
                    >
                      {slot.imageUrl ? (
                        <img src={slot.imageUrl} className="w-12 h-12 object-contain" />
                      ) : (
                        <Upload size={20} className="text-slate-500" />
                      )}

                      {isEditable && (
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleSlotImageUpload(e, slot.id)}
                        />
                      )}
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">
                      Warna Slot
                    </label>
                    <div
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 relative ${
                        slotNote ? "border-rose-500" : "border-slate-600"
                      }`}
                    >
                      <input
                        type="color"
                        value={slot.color || "#4f46e5"}
                        onChange={(e) => handleColorChange(slot.id, e.target.value)}
                        disabled={!isEditable}
                        className="absolute -top-4 -left-4 w-32 h-32 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function MCXDetail() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f172a] text-white p-8 flex items-center justify-center">
          Memuat Halaman...
        </div>
      }
    >
      <MCXDetailContent />
    </Suspense>
  );
}