"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Package,
  Plus,
  ArrowRight,
  LogOut,
  Trash2,
  Edit2,
  X,
  QrCode,
  CheckCircle2,
  FileDown,
  Loader2,
  Ticket,
  Search,
  Copy,
  Check,
  Calendar,
  Gift,
  Radio,
  AlertTriangle,
  Eye,
  Filter,
  Clock,
  UserCheck,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Campaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  tvBackgroundUrl?: string;
  mobileBannerUrl?: string;
  revisionNote?: string;
}

interface Slot {
  id: string;
  campaignId: string;
  name: string;
  quantity: number;
  winRate?: number;
  color?: string;
  imageUrl?: string;
  generatedCodes: string[];
  initialCodes?: string[];
}

interface ClaimItem {
  name?: string;
  qty?: number;
  price?: number;
}

interface ClaimRecord {
  id: string;
  campaignId: string;
  slotId: string;
  code: string;
  date: Date;
  customerName: string;
  invoiceNumber: string;
  totalAmount: number;
  items: ClaimItem[];
}

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

interface ToastMessage {
  type: "success" | "error" | "info";
  text: string;
}

function parseFirestoreDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default function PurchasingDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [isSlotsLoaded, setIsSlotsLoaded] = useState(false);
  const [allClaims, setAllClaims] = useState<ClaimRecord[]>([]);
  const [logoError, setLogoError] = useState(false);

  // Ref pengaman untuk mencegah pemanggilan updateDoc berulang saat proses auto-off
  const autoOffLockRef = useRef<Set<string>>(new Set());

  // Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal Buat Program Baru
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Edit Program
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Konfirmasi Hapus
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Lihat Kode Voucher (Tersedia & Sudah Digunakan)
  const [voucherModalCampaign, setVoucherModalCampaign] =
    useState<Campaign | null>(null);
  const [selectedSlotIdForCodes, setSelectedSlotIdForCodes] =
    useState<string>("ALL");
  const [voucherStatusTab, setVoucherStatusTab] = useState<
    "ALL" | "AVAILABLE" | "USED"
  >("ALL");
  const [voucherSearchQuery, setVoucherSearchQuery] = useState("");
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // QR & PDF State
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [hiddenQrToken, setHiddenQrToken] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const showToast = (
    text: string,
    type: ToastMessage["type"] = "success"
  ) => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const qCamp = query(
      collection(db, "Speen_Campaigns"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeCamp = onSnapshot(qCamp, (snapshot) => {
      const data: Campaign[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as Omit<Campaign, "id">;
        data.push({ id: docSnap.id, ...raw });
      });
      setCampaigns(data);
    });

    const qSlots = query(collection(db, "Speen_CampaignSlots"));
    const unsubscribeSlots = onSnapshot(qSlots, (snapshot) => {
      const slotsData: Slot[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        slotsData.push({
          id: docSnap.id,
          campaignId: String(raw.campaignId ?? ""),
          name: String(raw.name ?? "Slot Hadiah"),
          quantity: Number(raw.quantity ?? 0),
          winRate: Number(raw.winRate ?? 0),
          color: typeof raw.color === "string" ? raw.color : undefined,
          imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : undefined,
          generatedCodes: Array.isArray(raw.generatedCodes)
            ? (raw.generatedCodes as string[])
            : [],
          initialCodes: Array.isArray(raw.initialCodes)
            ? (raw.initialCodes as string[])
            : undefined,
        });
      });
      setAllSlots(slotsData);
      setIsSlotsLoaded(true);
    });

    // Pantau data pemenang/klaim voucher secara real-time
    const qWinners = query(collection(db, "Speen_Winners"));
    const unsubscribeWinners = onSnapshot(
      qWinners,
      (snapshot) => {
        const claimsData: ClaimRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          claimsData.push({
            id: docSnap.id,
            campaignId: String(data.campaignId ?? ""),
            slotId: String(data.slotId ?? ""),
            code: String(data.code ?? data.voucherCode ?? "-"),
            date: parseFirestoreDate(data.createdAt ?? data.date),
            customerName: String(
              data.customerName ?? data.userName ?? "Konsumen Toko"
            ),
            invoiceNumber: String(data.invoiceNumber ?? "-"),
            totalAmount: Number(data.totalAmount ?? 0),
            items: Array.isArray(data.items) ? (data.items as ClaimItem[]) : [],
          });
        });
        setAllClaims(claimsData);
      },
      () => {
        // Abaikan jika koleksi Speen_Winners belum ada
      }
    );

    return () => {
      unsubscribeCamp();
      unsubscribeSlots();
      unsubscribeWinners();
    };
  }, []);

  // --- PENGAMAN OTOMATIS: MATIKAN STATUS LIVE JIKA KUOTA VOUCHER HABIS (0) ---
  useEffect(() => {
    if (!isSlotsLoaded || campaigns.length === 0) return;

    campaigns.forEach((camp) => {
      if (camp.status !== "LIVE") {
        autoOffLockRef.current.delete(camp.id);
        return;
      }

      const campSlots = allSlots.filter((s) => s.campaignId === camp.id);
      const totalSisaVoucher = campSlots.reduce(
        (acc, slot) => acc + (slot.generatedCodes?.length || 0),
        0
      );

      // Jika program sedang LIVE tetapi sisa kode voucher 0, otomatis turunkan ke APPROVED (Nonaktif)
      if (totalSisaVoucher <= 0 && !autoOffLockRef.current.has(camp.id)) {
        autoOffLockRef.current.add(camp.id);
        updateDoc(doc(db, "Speen_Campaigns", camp.id), {
          status: "APPROVED",
        })
          .then(() => {
            showToast(
              `Pengaman Aktif: Program "${camp.name}" otomatis dinonaktifkan dari TV karena kuota voucher telah habis (0).`,
              "error"
            );
          })
          .catch((error) => {
            console.error("Gagal menonaktifkan otomatis program:", error);
            autoOffLockRef.current.delete(camp.id);
          });
      }
    });
  }, [campaigns, allSlots, isSlotsLoaded]);

  // Helper untuk mendata kode voucher yang sudah terpakai pada suatu slot
  const getUsedVouchersForSlot = (slot: Slot): ClaimRecord[] => {
    const recordedClaims = allClaims.filter((c) => c.slotId === slot.id);
    const recordedCodesSet = new Set(recordedClaims.map((c) => c.code));

    const activeCodesSet = new Set(slot.generatedCodes || []);
    const extraUsedFromInitial: ClaimRecord[] = [];

    if (Array.isArray(slot.initialCodes)) {
      slot.initialCodes.forEach((code, idx) => {
        if (!activeCodesSet.has(code) && !recordedCodesSet.has(code)) {
          extraUsedFromInitial.push({
            id: `init-used-${slot.id}-${idx}`,
            campaignId: slot.campaignId,
            slotId: slot.id,
            code,
            date: new Date(),
            customerName: "Pemenang Spin TV",
            invoiceNumber: "Tercatat Otomatis",
            totalAmount: 0,
            items: [],
          });
        }
      });
    }

    return [...recordedClaims, ...extraUsedFromInitial];
  };

  // Ringkasan Angka di Bagian Atas Dashboard
  const summaryStats = useMemo(() => {
    const totalPrograms = campaigns.length;
    const livePrograms = campaigns.filter((c) => c.status === "LIVE").length;
    const waitingReview = campaigns.filter(
      (c) => c.status === "WAITING_APPROVAL"
    ).length;

    let totalAvailable = 0;
    let totalUsed = 0;

    allSlots.forEach((slot) => {
      const sisa = slot.generatedCodes?.length || 0;
      const recordedForSlot = allClaims.filter(
        (c) => c.slotId === slot.id
      ).length;
      const kuotaAwal = Math.max(slot.quantity, sisa + recordedForSlot);
      const terpakai = Math.max(recordedForSlot, kuotaAwal - sisa);

      totalAvailable += sisa;
      totalUsed += terpakai;
    });

    return {
      totalPrograms,
      livePrograms,
      waitingReview,
      totalAvailable,
      totalUsed,
      totalAllVouchers: totalAvailable + totalUsed,
    };
  }, [campaigns, allSlots, allClaims]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((camp) => {
      const matchesSearch = camp.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || camp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeKey(key);
      window.setTimeout(() => setCopiedCodeKey(null), 2000);
    } catch {
      showToast("Gagal menyalin kode", "error");
    }
  };

  // --- GENERATE LAPORAN PDF (MYSEHATI AUDIT REPORT) ---
  const generatePDFReport = async (camp: Campaign, campSlots: Slot[]) => {
    setIsDownloadingPdf(camp.id);
    try {
      const qClaims = query(
        collection(db, "Speen_Winners"),
        where("campaignId", "==", camp.id)
      );
      const claimSnapshot = await getDocs(qClaims);

      const realClaimData: ClaimRecord[] = claimSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          campaignId: camp.id,
          slotId: String(data.slotId ?? ""),
          code: String(data.code ?? data.voucherCode ?? "-"),
          date: parseFirestoreDate(data.createdAt ?? data.date),
          customerName: String(
            data.customerName ?? data.userName ?? "Konsumen Toko"
          ),
          invoiceNumber: String(data.invoiceNumber ?? "-"),
          totalAmount: Number(data.totalAmount ?? 0),
          items: Array.isArray(data.items) ? (data.items as ClaimItem[]) : [],
        };
      });

      const pdfDoc = new jsPDF("p", "mm", "a4") as JsPDFWithAutoTable;
      const navyHeader: [number, number, number] = [15, 23, 42];
      const accentBrand: [number, number, number] = [79, 70, 229];
      const softBg: [number, number, number] = [248, 250, 252];
      const borderGray: [number, number, number] = [203, 213, 225];
      const textDark: [number, number, number] = [30, 41, 59];

      const now = new Date();
      const docRefNumber = `MSR/SW/${now.getFullYear()}/${String(
        now.getMonth() + 1
      ).padStart(2, "0")}/${camp.id.slice(0, 5).toUpperCase()}`;

      // ================= 1. HEADER: MYSEHATI AUDIT REPORT =================
      pdfDoc.setFillColor(...navyHeader);
      pdfDoc.rect(0, 0, 210, 27, "F");
      pdfDoc.setFillColor(...accentBrand);
      pdfDoc.rect(0, 27, 210, 2, "F");

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(16);
      pdfDoc.setTextColor(255, 255, 255);
      pdfDoc.text("MySehati Audit Report", 14, 12);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(203, 213, 225);
      pdfDoc.text(
        "Laporan Evaluasi Program Promo Spin Wheel, Penggunaan Voucher & Data Pemenang",
        14,
        19
      );

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(253, 230, 138);
      pdfDoc.text(docRefNumber, 196, 11, { align: "right" });
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setTextColor(226, 232, 240);
      pdfDoc.text(
        `Dicetak: ${now.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })} ${now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        })} WIB`,
        196,
        16.5,
        { align: "right" }
      );
      pdfDoc.text(`Status Program: ${camp.status}`, 196, 21.5, {
        align: "right",
      });

      // ================= 2. RINGKASAN PROGRAM & KARTU INFO =================
      let totalStokAwal = 0;
      let totalTerpakai = 0;
      let totalSisa = 0;

      const summaryData = campSlots.map((slot, index) => {
        const sisa = slot.generatedCodes?.length || 0;
        const slotClaimsCount = realClaimData.filter(
          (c) => c.slotId === slot.id
        ).length;
        const kuotaAwal = Math.max(slot.quantity, sisa + slotClaimsCount);
        const terpakai = Math.max(slotClaimsCount, kuotaAwal - sisa);
        const persenTerpakai =
          kuotaAwal > 0 ? ((terpakai / kuotaAwal) * 100).toFixed(0) : "0";
        const statusStok =
          sisa === 0 ? "HABIS" : sisa <= 5 ? "HAMPIR HABIS" : "TERSEDIA";

        totalStokAwal += kuotaAwal;
        totalTerpakai += terpakai;
        totalSisa += sisa;

        return [
          (index + 1).toString(),
          slot.name,
          `${slot.winRate ?? 0}%`,
          kuotaAwal.toString(),
          terpakai.toString(),
          sisa.toString(),
          `${persenTerpakai}%`,
          statusStok,
        ];
      });

      const totalRevenue = realClaimData.reduce(
        (acc, curr) => acc + (curr.totalAmount || 0),
        0
      );
      const overallPct =
        totalStokAwal > 0
          ? ((totalTerpakai / totalStokAwal) * 100).toFixed(0)
          : "0";

      pdfDoc.setFillColor(...softBg);
      pdfDoc.setDrawColor(...borderGray);
      pdfDoc.roundedRect(14, 34, 182, 17, 2, 2, "FD");

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(...textDark);
      pdfDoc.text(`PROGRAM PROMO : ${camp.name.toUpperCase()}`, 18, 41);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8.5);
      pdfDoc.text(`Periode : ${camp.startDate} s/d ${camp.endDate}`, 18, 46.5);
      pdfDoc.text(
        `Dicetak Oleh : ${currentUser?.email || "Tim Purchasing"}`,
        192,
        46.5,
        { align: "right" }
      );

      const kpiCards = [
        {
          label: "TOTAL VOUCHER DISIAPKAN",
          value: `${totalStokAwal} Voucher`,
          sub: `${campSlots.length} Pilihan Hadiah`,
        },
        {
          label: "SUDAH DIGUNAKAN",
          value: `${totalTerpakai} Voucher`,
          sub: `${overallPct}% dari total kuota`,
        },
        {
          label: "MASIH TERSEDIA",
          value: `${totalSisa} Voucher`,
          sub: totalSisa > 0 ? "Masih bisa dimenangkan" : "Stok habis",
        },
        {
          label: "TOTAL BELANJA KONSUMEN",
          value: formatRupiah(totalRevenue),
          sub: `${realClaimData.length} Transaksi Tercatat`,
        },
      ];

      const cardWidth = 43.25;
      kpiCards.forEach((card, idx) => {
        const x = 14 + idx * (cardWidth + 3);
        pdfDoc.setFillColor(255, 255, 255);
        pdfDoc.setDrawColor(...borderGray);
        pdfDoc.roundedRect(x, 54, cardWidth, 17, 1.5, 1.5, "FD");

        pdfDoc.setFillColor(...accentBrand);
        pdfDoc.rect(x, 54, 1.5, 17, "F");

        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(6.5);
        pdfDoc.setTextColor(100, 116, 139);
        pdfDoc.text(card.label, x + 4, 59);

        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(9.5);
        pdfDoc.setTextColor(...navyHeader);
        pdfDoc.text(card.value, x + 4, 64.5);

        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.setFontSize(6.5);
        pdfDoc.setTextColor(71, 85, 105);
        pdfDoc.text(card.sub, x + 4, 69);
      });

      // ================= 3. TABEL A: RINGKASAN STOK HADIAH =================
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(...navyHeader);
      pdfDoc.text("A. RINGKASAN STOK & PENGGUNAAN VOUCHER HADIAH", 14, 79);

      autoTable(pdfDoc, {
        startY: 82,
        head: [
          [
            "No",
            "Nama Hadiah",
            "Peluang",
            "Total Kuota",
            "Sudah Dipakai",
            "Sisa",
            "Persentase",
            "Keterangan",
          ],
        ],
        body: summaryData,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
        },
        headStyles: {
          fillColor: navyHeader,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 60 },
          2: { halign: "center", cellWidth: 18 },
          3: { halign: "right", cellWidth: 22 },
          4: { halign: "right", cellWidth: 22 },
          5: { halign: "right", cellWidth: 16 },
          6: { halign: "right", cellWidth: 16 },
          7: { halign: "center", cellWidth: 18 },
        },
        foot: [
          [
            "",
            "TOTAL KESELURUHAN",
            "100%",
            totalStokAwal.toString(),
            totalTerpakai.toString(),
            totalSisa.toString(),
            `${overallPct}%`,
            totalSisa === 0 ? "HABIS" : "AKTIF",
          ],
        ],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: navyHeader,
          fontStyle: "bold",
          halign: "right",
        },
      });

      // ================= 4. GRAFIK JAM RAMAI PENGUNJUNG =================
      let currentY = (pdfDoc.lastAutoTable?.finalY ?? 120) + 10;
      if (currentY > 215) {
        pdfDoc.addPage();
        currentY = 20;
      }

      const hourDistribution = new Array<number>(24).fill(0);
      realClaimData.forEach((claim) => {
        const hour = claim.date.getHours();
        if (hour >= 0 && hour < 24) {
          hourDistribution[hour] += 1;
        }
      });

      const maxClaim = Math.max(...hourDistribution, 1);
      const peakHourIndex = hourDistribution.indexOf(
        Math.max(...hourDistribution)
      );
      const hasClaims = realClaimData.length > 0;

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(...navyHeader);
      pdfDoc.text("B. GRAFIK JAM BERMAIN KONSUMEN (JAM RAMAI)", 14, currentY);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text(
        hasClaims
          ? `Waktu paling ramai: Pukul ${String(peakHourIndex).padStart(
              2,
              "0"
            )}:00 WIB (${hourDistribution[peakHourIndex]} kali putaran)`
          : "Distribusi aktivitas pengunjung dari pukul 00:00 hingga 23:00 WIB",
        14,
        currentY + 4.5
      );

      const chartBoxY = currentY + 7;
      const chartBoxH = 38;
      pdfDoc.setFillColor(...softBg);
      pdfDoc.setDrawColor(...borderGray);
      pdfDoc.roundedRect(14, chartBoxY, 182, chartBoxH, 1.5, 1.5, "FD");

      const plotLeft = 20;
      const plotBottom = chartBoxY + 30;
      const plotHeight = 22;
      const plotWidth = 170;

      pdfDoc.setDrawColor(226, 232, 240);
      pdfDoc.line(
        plotLeft,
        plotBottom - plotHeight / 2,
        plotLeft + plotWidth,
        plotBottom - plotHeight / 2
      );
      pdfDoc.setDrawColor(148, 163, 184);
      pdfDoc.line(plotLeft, plotBottom, plotLeft + plotWidth, plotBottom);

      const barSlotWidth = plotWidth / 24;
      hourDistribution.forEach((val, hour) => {
        const xPos = plotLeft + hour * barSlotWidth + 1;
        const barW = barSlotWidth - 2;

        if (val > 0) {
          const barH = Math.max(1.5, (val / maxClaim) * plotHeight);
          const yPos = plotBottom - barH;
          if (hour === peakHourIndex) {
            pdfDoc.setFillColor(...accentBrand);
          } else {
            pdfDoc.setFillColor(30, 64, 175);
          }
          pdfDoc.rect(xPos, yPos, barW, barH, "F");

          pdfDoc.setFont("helvetica", "bold");
          pdfDoc.setFontSize(6);
          pdfDoc.setTextColor(...navyHeader);
          pdfDoc.text(val.toString(), xPos + barW / 2, yPos - 1, {
            align: "center",
          });
        }

        if (hour % 2 === 0) {
          pdfDoc.setFont("helvetica", "normal");
          pdfDoc.setFontSize(6);
          pdfDoc.setTextColor(100, 116, 139);
          pdfDoc.text(
            `${String(hour).padStart(2, "0")}:00`,
            xPos + barW / 2,
            plotBottom + 4,
            { align: "center" }
          );
        }
      });

      // ================= 5. BAGIAN C: DAFTAR KODE VOUCHER (TERPAKAI & TERSEDIA) =================
      currentY = chartBoxY + chartBoxH + 10;
      if (currentY > 235) {
        pdfDoc.addPage();
        currentY = 20;
      }

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(...navyHeader);
      pdfDoc.text(
        "C. RINCIAN KODE VOUCHER (SUDAH DIGUNAKAN & MASIH TERSEDIA)",
        14,
        currentY
      );
      currentY += 4;

      campSlots.forEach((slot, slotIdx) => {
        const slotClaims = realClaimData.filter((c) => c.slotId === slot.id);
        const remainingCodes = Array.isArray(slot.generatedCodes)
          ? slot.generatedCodes
          : [];
        const kuotaAwal = Math.max(
          slot.quantity,
          remainingCodes.length + slotClaims.length
        );
        const terpakaiCount = Math.max(
          slotClaims.length,
          kuotaAwal - remainingCodes.length
        );

        const detailRows: string[][] = [];
        let rowNo = 1;

        slotClaims.forEach((claim) => {
          const itemsStr = claim.items
            .slice(0, 3)
            .map((it) => it.name || "Produk")
            .join(", ");
          detailRows.push([
            (rowNo++).toString(),
            claim.code,
            "SUDAH DIGUNAKAN",
            `${claim.date.toLocaleDateString("id-ID")} ${String(
              claim.date.getHours()
            ).padStart(2, "0")}:${String(claim.date.getMinutes()).padStart(
              2,
              "0"
            )}`,
            `${claim.customerName} (${claim.invoiceNumber})`,
            `${formatRupiah(claim.totalAmount)}${
              itemsStr ? ` - ${itemsStr}` : ""
            }`,
          ]);
        });

        const unrecordedUsedCount = Math.max(
          0,
          terpakaiCount - slotClaims.length
        );
        for (let i = 0; i < unrecordedUsedCount; i++) {
          detailRows.push([
            (rowNo++).toString(),
            `VOUCHER-TERPAKAI-#${i + 1}`,
            "SUDAH DIGUNAKAN",
            "Tercatat di Mesin TV",
            "Pengunjung Toko",
            "Hadiah Langsung Spin TV",
          ]);
        }

        remainingCodes.forEach((code) => {
          detailRows.push([
            (rowNo++).toString(),
            code,
            "MASIH TERSEDIA",
            "-",
            "-",
            "Siap Digunakan",
          ]);
        });

        if (detailRows.length === 0) {
          detailRows.push([
            "1",
            "-",
            "BELUM ADA KODE",
            "-",
            "-",
            "Silakan buat kode di menu Atur Hadiah",
          ]);
        }

        autoTable(pdfDoc, {
          startY: currentY + 2,
          head: [
            [
              {
                content: `${slotIdx + 1}. ${slot.name.toUpperCase()}   |   Total Kuota: ${kuotaAwal}   |   Sudah Digunakan: ${terpakaiCount}   |   Masih Tersedia: ${
                  remainingCodes.length
                }`,
                colSpan: 6,
                styles: {
                  fillColor: [30, 41, 59],
                  textColor: [253, 230, 138],
                  halign: "left",
                  fontSize: 8,
                },
              },
            ],
            [
              "No",
              "Kode Voucher",
              "Status Voucher",
              "Waktu Digunakan",
              "Nama Pemenang / Struk",
              "Nilai Belanja / Keterangan",
            ],
          ],
          body: detailRows,
          theme: "grid",
          styles: {
            fontSize: 7.5,
            cellPadding: 1.8,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
          },
          headStyles: {
            fillColor: [71, 85, 105],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { fontStyle: "bold", cellWidth: 35 },
            2: { halign: "center", cellWidth: 26 },
            3: { halign: "center", cellWidth: 26 },
            4: { cellWidth: 41 },
            5: { cellWidth: 44 },
          },
          didParseCell: (data) => {
            if (data.section === "body" && Array.isArray(data.row.raw)) {
              const rowStatus = data.row.raw[2];
              if (rowStatus === "SUDAH DIGUNAKAN") {
                data.cell.styles.fillColor = [254, 242, 242];
              }
            }
          },
        });

        currentY = (pdfDoc.lastAutoTable?.finalY ?? currentY + 20) + 6;
      });

      // ================= 6. KOLOM TANDA TANGAN =================
      if (currentY > 225) {
        pdfDoc.addPage();
        currentY = 25;
      } else {
        currentY += 8;
      }

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(...navyHeader);
      pdfDoc.text("PENGESAHAN LAPORAN", 14, currentY);

      const sigY = currentY + 4;
      pdfDoc.setDrawColor(...borderGray);
      pdfDoc.setFillColor(255, 255, 255);
      pdfDoc.rect(14, sigY, 182, 34, "FD");
      pdfDoc.line(105, sigY, 105, sigY + 34);

      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(100, 116, 139);
      pdfDoc.text("Disiapkan Oleh,", 59.5, sigY + 6, { align: "center" });
      pdfDoc.text("Mengetahui & Menyetujui,", 150.5, sigY + 6, {
        align: "center",
      });

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setTextColor(...navyHeader);
      pdfDoc.text("Tim Purchasing", 59.5, sigY + 28, {
        align: "center",
      });
      pdfDoc.text("Manajemen MySehati", 150.5, sigY + 28, {
        align: "center",
      });

      // ================= 7. FOOTER: MYSEHATI AUDIT REPORT =================
      const pageCount = pdfDoc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdfDoc.setPage(i);
        pdfDoc.setDrawColor(226, 232, 240);
        pdfDoc.line(14, 285, 196, 285);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.setFontSize(7.5);
        pdfDoc.setTextColor(148, 163, 184);
        pdfDoc.text(`MySehati Audit Report | ${docRefNumber}`, 14, 290);
        pdfDoc.text(`Halaman ${i} dari ${pageCount}`, 196, 290, {
          align: "right",
        });
      }

      pdfDoc.save(
        `MySehati_Audit_Report_${camp.name.replace(/\s+/g, "_")}.pdf`
      );
      showToast("Laporan PDF berhasil diunduh!");
    } catch (error) {
      console.error("Gagal generate PDF:", error);
      showToast("Terjadi kendala saat mengunduh laporan PDF.", "error");
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  // --- CRUD PROGRAM PROMO ---
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "Speen_Campaigns"), {
        name: name.trim(),
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
      setIsCreateModalOpen(false);
      showToast("Program berhasil dibuat! Mengarahkan ke pengaturan hadiah...");
      router.push(`/internal/purchasing/${docRef.id}`);
    } catch (error) {
      console.error("Gagal membuat program:", error);
      showToast("Gagal membuat program baru.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!deletingCampaign) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "Speen_Campaigns", deletingCampaign.id));
      showToast(`Program "${deletingCampaign.name}" berhasil dihapus.`);
      setDeletingCampaign(null);
    } catch (error) {
      console.error("Gagal menghapus program:", error);
      showToast("Gagal menghapus program.", "error");
    } finally {
      setIsDeleting(false);
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
    if (!editingCampaign) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "Speen_Campaigns", editingCampaign.id), {
        name: editName.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
      });
      showToast("Perubahan berhasil disimpan.");
      closeEditModal();
    } catch (error) {
      console.error("Gagal update program:", error);
      showToast("Gagal menyimpan perubahan.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // --- SAKLAR TAYANG TV DENGAN PROTEKSI KUOTA 0 ---
  const handleToggleLive = async (
    campaignId: string,
    currentStatus: string,
    isChecked: boolean,
    totalSisaVoucher: number
  ) => {
    if (currentStatus !== "APPROVED" && currentStatus !== "LIVE") {
      showToast(
        "Desain perlu disetujui dulu sebelum bisa ditayangkan ke layar TV!",
        "error"
      );
      return;
    }

    if (isChecked && totalSisaVoucher <= 0) {
      showToast(
        "Tidak dapat menayangkan ke TV! Kuota voucher program ini masih 0 (habis).",
        "error"
      );
      return;
    }

    try {
      await updateDoc(doc(db, "Speen_Campaigns", campaignId), {
        status: isChecked ? "LIVE" : "APPROVED",
      });
      showToast(
        isChecked
          ? "Program sekarang AKTIF tampil di layar TV!"
          : "Program dinonaktifkan dari layar TV."
      );
    } catch (error) {
      console.error("Gagal mengubah status live:", error);
      showToast("Gagal mengubah status tayang.", "error");
    }
  };

  const handleGenerateAndDownloadQR = () => {
    setIsGeneratingQr(true);
    setHiddenQrToken("SPEEN-MONITOR-MAIN");
    window.setTimeout(() => {
      const canvas = qrRef.current?.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        link.download = "QR-KONEKSI-SPEEN-MONITOR.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
      showToast("Gambar QR Monitor berhasil diunduh!");
      setHiddenQrToken("");
      setIsGeneratingQr(false);
    }, 500);
  };

  const openVoucherModal = (camp: Campaign, initialSlotId = "ALL") => {
    setVoucherModalCampaign(camp);
    setSelectedSlotIdForCodes(initialSlotId);
    setVoucherStatusTab("ALL");
    setVoucherSearchQuery("");
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090d16] text-white">
        <Loader2 className="mb-3 h-10 w-10 animate-spin text-indigo-500" />
        <span className="text-sm font-medium text-slate-400">
          Membuka halaman Purchasing...
        </span>
      </div>
    );
  }

  const voucherModalSlots = voucherModalCampaign
    ? allSlots.filter((s) => s.campaignId === voucherModalCampaign.id)
    : [];

  return (
    <main className="relative min-h-screen bg-[#0b1120] p-4 font-sans text-slate-200 sm:p-8">
      {/* Hidden QR Canvas */}
      <div style={{ display: "none" }} ref={qrRef}>
        {hiddenQrToken && (
          <QRCodeCanvas
            value={hiddenQrToken}
            size={400}
            level="H"
            includeMargin={true}
          />
        )}
      </div>

      {/* Notifikasi Popup */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-bold shadow-2xl backdrop-blur-xl transition-all ${
            toast.type === "error"
              ? "border-rose-500/40 bg-rose-950/90 text-rose-200"
              : "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle size={18} className="shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        {/* ================= HEADER PROFESIONAL ================= */}
        <header className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-xl backdrop-blur-md lg:flex-row lg:items-center sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-950 p-2 shadow-inner">
              {!logoError ? (
                <img
                  src="/logo.png"
                  alt="Mysehati Logo"
                  onError={() => setLogoError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-serif text-2xl font-black text-amber-400">
                  S
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                  Purchasing Portal
                </span>
                <span className="hidden text-xs text-slate-500 sm:inline">
                  • {currentUser.email}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl">
                Speen Wheel Management Console
              </h1>
              <p className="text-xs text-slate-400 sm:text-sm">
                Kelola program undian, kuota kode voucher, penayangan TV &
                audit laporan eksekutif.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] transition hover:bg-indigo-500 active:scale-[0.99] sm:flex-none"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Tambah Program</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateAndDownloadQR}
              disabled={isGeneratingQr}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
            >
              <QrCode size={17} className="text-amber-400" />
              <span>{isGeneratingQr ? "Memproses..." : "QR Monitor"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-950/30 hover:text-rose-300"
              title="Keluar dari sesi"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* ================= 4 KARTU RINGKASAN SEDERHANA & JELAS ================= */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Total Program Promo
              </span>
              <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400">
                <Package size={18} />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-white">
              {summaryStats.totalPrograms}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {summaryStats.waitingReview > 0 ? (
                <span className="font-semibold text-blue-400">
                  {summaryStats.waitingReview} program menunggu persetujuan
                  desain
                </span>
              ) : (
                "Semua desain program sudah terpantau"
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Sedang Tampil di TV
              </span>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                <Radio size={18} />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-400">
              {summaryStats.livePrograms}{" "}
              <span className="text-sm font-bold text-slate-400">Program</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Otomatis mati jika kuota voucher 0
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Voucher Sudah Digunakan
              </span>
              <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
                <Gift size={18} />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-white">
              {summaryStats.totalUsed}{" "}
              <span className="text-sm font-normal text-slate-500">
                dari {summaryStats.totalAllVouchers}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Total hadiah yang sudah dimenangkan
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Voucher Masih Tersedia
              </span>
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
                <Ticket size={18} />
              </div>
            </div>
            <p className="mt-2 text-3xl font-black text-amber-400">
              {summaryStats.totalAvailable}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Sisa kode voucher yang siap diundi
            </p>
          </div>
        </section>

        {/* ================= PENCARIAN & FILTER MUDAH ================= */}
        <section className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama program promo..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter size={15} className="hidden shrink-0 text-slate-500 sm:block" />
            {[
              { id: "ALL", label: "Semua Program" },
              { id: "LIVE", label: "Sedang Tampil di TV" },
              { id: "APPROVED", label: "Siap Tayang" },
              { id: "WAITING_APPROVAL", label: "Perlu Dicek Desainnya" },
              { id: "WAITING_DESIGN", label: "Menunggu Desain MCX" },
              { id: "REVISION", label: "Sedang Direvisi" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ================= DAFTAR PROGRAM PROMO ================= */}
        <section className="space-y-4">
          {filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
              <Package size={48} className="mb-3 text-slate-600" />
              <h3 className="text-lg font-bold text-white">
                Belum Ada Program Promo
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Silakan klik tombol{" "}
                <strong className="text-indigo-400">
                  + Tambah Program
                </strong>{" "}
                di pojok kanan atas untuk mulai membuat event baru.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {filteredCampaigns.map((camp) => {
                const campSlots = allSlots.filter(
                  (s) => s.campaignId === camp.id
                );

                let totalStok = 0;
                let totalSisa = 0;
                let totalTerpakai = 0;

                campSlots.forEach((slot) => {
                  const sisa = slot.generatedCodes?.length || 0;
                  const usedRecords = getUsedVouchersForSlot(slot);
                  const kuotaAwal = Math.max(
                    slot.quantity,
                    sisa + usedRecords.length
                  );
                  const terpakai = Math.max(
                    usedRecords.length,
                    kuotaAwal - sisa
                  );

                  totalStok += kuotaAwal;
                  totalSisa += sisa;
                  totalTerpakai += terpakai;
                });

                const isQuotaEmpty = isSlotsLoaded && totalSisa <= 0;
                // Saklar hanya bisa dinyalakan apabila status APPROVED/LIVE dan kuota voucher > 0
                const isToggleable =
                  (camp.status === "APPROVED" && !isQuotaEmpty) ||
                  camp.status === "LIVE";

                const progressPercent =
                  totalStok > 0
                    ? Math.round((totalTerpakai / totalStok) * 100)
                    : 0;
                const isDownloadingThis = isDownloadingPdf === camp.id;

                return (
                  <div
                    key={camp.id}
                    className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg transition hover:border-slate-700 sm:p-6"
                  >
                    {camp.status === "LIVE" && (
                      <div className="absolute left-0 top-0 h-full w-1.5 bg-emerald-500" />
                    )}

                    {/* Bagian Atas Kartu: Nama, Tanggal, dan Tombol Aksi */}
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <StatusBadge
                            status={camp.status}
                            isQuotaEmpty={isQuotaEmpty}
                          />
                          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <Calendar size={13} className="text-slate-500" />
                            Periode: {camp.startDate} s/d {camp.endDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <h3 className="text-xl font-bold text-white">
                            {camp.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => openEditModal(camp)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-indigo-400"
                            title="Ubah Nama & Tanggal"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCampaign(camp)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-950/40 hover:text-rose-400"
                            title="Hapus Program"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Tombol-Tombol Aksi yang Jelas */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Saklar Tampilkan di TV (Otomatis mati & terkunci jika kuota 0) */}
                        <div
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 ${
                            isQuotaEmpty
                              ? "border-rose-500/30 bg-rose-950/20"
                              : "border-slate-800 bg-slate-950/70"
                          }`}
                          title={
                            isQuotaEmpty
                              ? "Kuota voucher habis (0). Tambahkan voucher untuk menayangkan."
                              : "Saklar penayangan layar TV"
                          }
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase text-slate-400">
                              Layar TV
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                isQuotaEmpty
                                  ? "text-rose-400"
                                  : camp.status === "LIVE"
                                  ? "text-emerald-400"
                                  : "text-slate-500"
                              }`}
                            >
                              {isQuotaEmpty
                                ? "Kuota Habis"
                                : camp.status === "LIVE"
                                ? "Aktif"
                                : "Nonaktif"}
                            </span>
                          </div>
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={camp.status === "LIVE" && !isQuotaEmpty}
                              disabled={!isToggleable}
                              onChange={(e) =>
                                handleToggleLive(
                                  camp.id,
                                  camp.status,
                                  e.target.checked,
                                  totalSisa
                                )
                              }
                            />
                            <div
                              className={`h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white ${
                                !isToggleable
                                  ? "cursor-not-allowed opacity-40"
                                  : "peer-checked:bg-emerald-500"
                              }`}
                            />
                          </label>
                        </div>

                        {/* Tombol Lihat Kode Voucher */}
                        <button
                          type="button"
                          onClick={() => openVoucherModal(camp, "ALL")}
                          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
                        >
                          <Ticket size={15} />
                          <span>Lihat Kode Voucher</span>
                        </button>

                        {/* Tombol Unduh PDF */}
                        <button
                          type="button"
                          onClick={() => generatePDFReport(camp, campSlots)}
                          disabled={isDownloadingThis}
                          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        >
                          {isDownloadingThis ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              <span>Menyiapkan PDF...</span>
                            </>
                          ) : (
                            <>
                              <FileDown size={15} className="text-indigo-400" />
                              <span>Unduh Laporan PDF</span>
                            </>
                          )}
                        </button>

                        {/* Tombol Buka Halaman Detail Hadiah */}
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/internal/purchasing/${camp.id}`)
                          }
                          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
                        >
                          <span>Atur Hadiah & Desain</span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Bagian Bawah Kartu: Info Stok Voucher & Daftar Hadiah */}
                    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800/90 pt-4 lg:grid-cols-12 lg:items-center">
                      <div className="lg:col-span-4">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-400">
                            Penggunaan Voucher:
                          </span>
                          <span className="font-bold text-white">
                            {totalTerpakai} Terpakai{" "}
                            <span
                              className={`font-semibold ${
                                isQuotaEmpty
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              • {totalSisa} Tersedia
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isQuotaEmpty
                                ? "bg-rose-500"
                                : "bg-gradient-to-r from-indigo-500 to-emerald-400"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="lg:col-span-8">
                        {campSlots.length === 0 ? (
                          <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-2.5 text-xs text-slate-400">
                            <span>
                              Hadiah untuk program ini belum ditambahkan.
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/internal/purchasing/${camp.id}`)
                              }
                              className="font-bold text-indigo-400 hover:underline"
                            >
                              + Tambah Hadiah Sekarang
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mr-1 text-xs font-medium text-slate-400">
                              Klik hadiah untuk cek voucher:
                            </span>
                            {campSlots.map((slot) => {
                              const sisaKode =
                                slot.generatedCodes?.length || 0;
                              const usedList = getUsedVouchersForSlot(slot);
                              const kuotaAwal = Math.max(
                                slot.quantity,
                                sisaKode + usedList.length
                              );
                              const sudahDipakai = Math.max(
                                usedList.length,
                                kuotaAwal - sisaKode
                              );

                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={() =>
                                    openVoucherModal(camp, slot.id)
                                  }
                                  className="group flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-left text-xs transition hover:border-amber-500/40 hover:bg-slate-900"
                                >
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                      backgroundColor:
                                        slot.color || "#6366f1",
                                    }}
                                  />
                                  <span className="font-semibold text-slate-200">
                                    {slot.name}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                      sisaKode === 0
                                        ? "bg-rose-500/20 text-rose-300"
                                        : "bg-emerald-500/15 text-emerald-300"
                                    }`}
                                  >
                                    {sisaKode} sisa
                                  </span>
                                  {sudahDipakai > 0 && (
                                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                                      {sudahDipakai} dipakai
                                    </span>
                                  )}
                                  <Eye
                                    size={12}
                                    className="text-slate-500 group-hover:text-amber-300"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ================= MODAL 1: TAMBAH PROGRAM BARU ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
                <Plus size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Tambah Program Promo Baru
                </h2>
                <p className="text-xs text-slate-400">
                  Isi nama dan periode program, lalu lanjut atur daftar
                  hadiahnya.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">
                  Nama Program Promo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Gebyar Belanja MySehati"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Tanggal Berakhir
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan & Lanjut Atur Hadiah</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: DETAIL KODE VOUCHER (TERSEDIA & SUDAH DIGUNAKAN) ================= */}
      {voucherModalCampaign && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Ticket size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Daftar Kode Voucher — {voucherModalCampaign.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Lihat kode voucher yang masih tersedia maupun yang sudah
                    digunakan oleh konsumen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVoucherModalCampaign(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Baris Filter: Pilih Hadiah, Pilih Status (Tersedia / Sudah Dipakai), & Pencarian */}
            <div className="space-y-3 border-b border-slate-800 bg-slate-950/60 px-6 py-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedSlotIdForCodes("ALL")}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    selectedSlotIdForCodes === "ALL"
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Semua Hadiah ({voucherModalSlots.length})
                </button>
                {voucherModalSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotIdForCodes(slot.id)}
                    className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                      selectedSlotIdForCodes === slot.id
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {slot.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  {[
                    { id: "ALL", label: "Semua Kode" },
                    { id: "AVAILABLE", label: "Masih Tersedia" },
                    { id: "USED", label: "Sudah Digunakan" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setVoucherStatusTab(
                          st.id as "ALL" | "AVAILABLE" | "USED"
                        )
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        voucherStatusTab === st.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800/80 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    value={voucherSearchQuery}
                    onChange={(e) => setVoucherSearchQuery(e.target.value)}
                    placeholder="Cari kode atau nama pemenang..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Isi Daftar Kode per Slot */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {voucherModalSlots.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Belum ada hadiah yang diatur untuk program ini.
                </div>
              ) : (
                voucherModalSlots
                  .filter(
                    (slot) =>
                      selectedSlotIdForCodes === "ALL" ||
                      slot.id === selectedSlotIdForCodes
                  )
                  .map((slot) => {
                    const availableCodes = (slot.generatedCodes || []).filter(
                      (c) =>
                        c
                          .toLowerCase()
                          .includes(voucherSearchQuery.toLowerCase())
                    );

                    const usedVoucherRecords = getUsedVouchersForSlot(
                      slot
                    ).filter(
                      (rec) =>
                        rec.code
                          .toLowerCase()
                          .includes(voucherSearchQuery.toLowerCase()) ||
                        rec.customerName
                          .toLowerCase()
                          .includes(voucherSearchQuery.toLowerCase())
                    );

                    const totalSisa = slot.generatedCodes?.length || 0;
                    const totalUsedRaw = getUsedVouchersForSlot(slot).length;
                    const kuotaAwal = Math.max(
                      slot.quantity,
                      totalSisa + totalUsedRaw
                    );
                    const totalDipakaiCount = Math.max(
                      totalUsedRaw,
                      kuotaAwal - totalSisa
                    );
                    const unrecordedSpinCount = Math.max(
                      0,
                      totalDipakaiCount - totalUsedRaw
                    );

                    const copyAllKey = `all-${slot.id}`;

                    return (
                      <div
                        key={slot.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span
                              className="h-3.5 w-3.5 rounded-full"
                              style={{
                                backgroundColor: slot.color || "#6366f1",
                              }}
                            />
                            <h3 className="text-base font-bold text-white">
                              {slot.name}
                            </h3>
                            <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                              Masih Tersedia: {totalSisa}
                            </span>
                            <span className="rounded-lg bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                              Sudah Digunakan: {totalDipakaiCount}
                            </span>
                          </div>

                          {availableCodes.length > 0 &&
                            voucherStatusTab !== "USED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(
                                    availableCodes.join("\n"),
                                    copyAllKey
                                  )
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                              >
                                {copiedCodeKey === copyAllKey ? (
                                  <>
                                    <Check
                                      size={13}
                                      className="text-emerald-400"
                                    />
                                    <span className="text-emerald-300">
                                      Berhasil Disalin
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>Salin Kode Tersedia</span>
                                  </>
                                )}
                              </button>
                            )}
                        </div>

                        <div className="space-y-5">
                          {(voucherStatusTab === "ALL" ||
                            voucherStatusTab === "USED") && (
                            <div>
                              <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                                <span>
                                  Voucher yang Sudah Digunakan (
                                  {totalDipakaiCount})
                                </span>
                              </h4>

                              {usedVoucherRecords.length === 0 &&
                              unrecordedSpinCount === 0 ? (
                                <p className="rounded-xl border border-slate-800/80 bg-slate-900/40 py-3 text-center text-xs text-slate-500">
                                  Belum ada kode voucher yang digunakan pada
                                  hadiah ini.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                                  {usedVoucherRecords.map((rec) => {
                                    const usedKey = `used-${rec.id}`;
                                    return (
                                      <div
                                        key={rec.id}
                                        className="flex flex-col justify-between rounded-xl border border-rose-500/30 bg-rose-950/20 p-3"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-mono text-xs font-black text-rose-300">
                                            {rec.code}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCopyText(rec.code, usedKey)
                                            }
                                            className="rounded p-1 text-rose-300/70 hover:bg-rose-500/20 hover:text-rose-200"
                                            title="Salin kode"
                                          >
                                            {copiedCodeKey === usedKey ? (
                                              <Check size={12} />
                                            ) : (
                                              <Copy size={12} />
                                            )}
                                          </button>
                                        </div>

                                        <div className="mt-2 space-y-1 border-t border-rose-500/20 pt-2 text-[11px] text-slate-300">
                                          <div className="flex items-center gap-1.5">
                                            <UserCheck
                                              size={12}
                                              className="text-rose-400"
                                            />
                                            <span className="truncate font-semibold">
                                              {rec.customerName}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-slate-400">
                                            <Clock size={11} />
                                            <span>
                                              {rec.date.toLocaleDateString(
                                                "id-ID"
                                              )}{" "}
                                              • {rec.invoiceNumber}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {unrecordedSpinCount > 0 && (
                                    <div className="flex flex-col justify-center rounded-xl border border-rose-500/25 bg-rose-950/15 p-3 text-xs text-rose-200">
                                      <span className="font-bold">
                                        +{unrecordedSpinCount} Voucher Terpakai
                                        di Mesin TV
                                      </span>
                                      <span className="mt-1 text-[11px] text-slate-400">
                                        Dimenangkan langsung melalui putaran
                                        layar TV toko.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {(voucherStatusTab === "ALL" ||
                            voucherStatusTab === "AVAILABLE") && (
                            <div>
                              <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                                <span>
                                  Voucher Masih Tersedia ({availableCodes.length}
                                  )
                                </span>
                              </h4>

                              {availableCodes.length === 0 ? (
                                <p className="rounded-xl border border-slate-800/80 bg-slate-900/40 py-3 text-center text-xs text-slate-500">
                                  Tidak ada kode voucher tersedia / stok sudah
                                  habis.
                                </p>
                              ) : (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                                  {availableCodes.map((code, idx) => {
                                    const itemKey = `${slot.id}-${code}-${idx}`;
                                    return (
                                      <button
                                        key={itemKey}
                                        type="button"
                                        onClick={() =>
                                          handleCopyText(code, itemKey)
                                        }
                                        className="group flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-3 py-2.5 font-mono text-xs font-bold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-900/30"
                                        title="Klik untuk menyalin kode"
                                      >
                                        <span className="truncate">{code}</span>
                                        {copiedCodeKey === itemKey ? (
                                          <Check
                                            size={13}
                                            className="shrink-0 text-emerald-400"
                                          />
                                        ) : (
                                          <Copy
                                            size={12}
                                            className="shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100"
                                          />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer Modal Voucher */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-6 py-3.5">
              <span className="text-xs text-slate-400">
                Ingin menambah stok atau membuat kode voucher baru?
              </span>
              <button
                type="button"
                onClick={() => {
                  const targetId = voucherModalCampaign.id;
                  setVoucherModalCampaign(null);
                  router.push(`/internal/purchasing/${targetId}`);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <span>Atur Hadiah & Voucher</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: EDIT PROGRAM ================= */}
      {isEditModalOpen && editingCampaign && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeEditModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={20} />
            </button>
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
              <Edit2 size={20} className="text-indigo-400" /> Ubah Info Program
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-300">
                  Nama Program Promo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-300">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-300">
                    Tanggal Berakhir
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isUpdating}
                className="mt-6 w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:bg-indigo-800"
              >
                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: KONFIRMASI HAPUS ================= */}
      {deletingCampaign && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">
              Hapus Program Promo Ini?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Program{" "}
              <strong className="text-white">
                &ldquo;{deletingCampaign.name}&rdquo;
              </strong>{" "}
              akan dihapus secara permanen.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCampaign(null)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteCampaign}
                disabled={isDeleting}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusBadge({
  status,
  isQuotaEmpty,
}: {
  status: string;
  isQuotaEmpty?: boolean;
}) {
  let colorClass = "bg-slate-800 text-slate-400 border-slate-700";
  let label = status;
  if (status === "WAITING_DESIGN") {
    colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/25";
    label = "Menunggu Desain MCX";
  } else if (status === "WAITING_APPROVAL") {
    colorClass = "bg-blue-500/10 text-blue-400 border-blue-500/25";
    label = "Perlu Dicek Desainnya";
  } else if (status === "REVISION") {
    colorClass = "bg-rose-500/10 text-rose-400 border-rose-500/25";
    label = "Sedang Direvisi MCX";
  } else if (status === "APPROVED") {
    if (isQuotaEmpty) {
      colorClass = "bg-rose-500/15 text-rose-300 border-rose-500/30";
      label = "Nonaktif (Kuota Voucher Habis)";
    } else {
      colorClass = "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
      label = "Siap Ditayangkan";
    }
  } else if (status === "LIVE") {
    colorClass =
      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
    label = "Sedang Tampil di TV";
  }
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}
    >
      {label}
    </span>
  );
}