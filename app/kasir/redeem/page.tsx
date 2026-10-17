"use client";

import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Ticket,
  Receipt,
  Banknote,
  ChevronDown,
  Edit3,
  Clock,
  History,
} from "lucide-react";

// Struktur data Voucher dari Speen_Winners
interface SpeenVoucherData {
  id: string;
  campaignId: string;
  slotId: string;
  code: string;
  voucherCode: string;
  prizeName: string;
  customerName: string;
  customerPhone: string;
  status: string; // PENDING_REDEEM atau REDEEMED
  invoiceNumber?: string;
  totalAmount?: number;
  items?: any[];
}

// Struktur data Transaksi dari pending_invoices
interface InvoiceData {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  date: Date;
  items: any[];
}

// Struktur data untuk List Riwayat Redeem Kasir
interface RedeemHistory {
  id: string; // kode voucher
  customerName: string;
  prizeName: string;
  invoiceNumber: string;
  totalAmount: number;
  claimedAt: Date;
}

export default function RedeemPage() {
  const [voucherCode, setVoucherCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voucherData, setVoucherData] = useState<SpeenVoucherData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // State untuk Auto-Fetch Invoice
  const [availableInvoices, setAvailableInvoices] = useState<InvoiceData[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isFetchingInvoices, setIsFetchingInvoices] = useState(false);

  // State untuk Input Manual
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualInvoice, setManualInvoice] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  // State Riwayat Penukaran Kasir
  const [redeemHistory, setRedeemHistory] = useState<RedeemHistory[]>([]);

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);
  };

  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) {
      clean = clean.substring(1);
    } else if (clean.startsWith("62")) {
      clean = clean.substring(2);
    }
    return clean;
  };

  // Pantau Riwayat Redeem yang dilakukan oleh kasir ini
  useEffect(() => {
    const kasirId = auth.currentUser?.uid || "kasir_aktif";
    const qHistory = query(
      collection(db, "Speen_Winners"),
      where("claimedBy", "==", kasirId),
      orderBy("claimedAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(qHistory, (snapshot) => {
      const historyData: RedeemHistory[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let claimDate = new Date();
        if (data.claimedAt?.toDate) {
          claimDate = data.claimedAt.toDate();
        }

        historyData.push({
          id: docSnap.id, // kode voucher
          customerName: data.customerName || "Konsumen",
          prizeName: data.prizeName || "Hadiah",
          invoiceNumber: data.invoiceNumber || "-",
          totalAmount: Number(data.totalAmount || 0),
          claimedAt: claimDate,
        });
      });
      setRedeemHistory(historyData);
    });

    return () => unsubscribe();
  }, []);

  const handleCariVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setVoucherData(null);
    setAvailableInvoices([]);
    setSelectedInvoice(null);
    setIsManualInput(false);
    setManualInvoice("");
    setManualAmount("");

    try {
      const cleanCode = voucherCode.trim();
      const voucherRef = doc(db, "Speen_Winners", cleanCode);
      const docSnap = await getDoc(voucherRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SpeenVoucherData;
        setVoucherData({ ...data, id: docSnap.id });

        if (data.status !== "REDEEMED" && data.customerPhone) {
          await fetchConsumerInvoices(data.customerPhone);
        }
      } else {
        setErrorMsg("Kode Voucher tidak ditemukan. Pastikan ketikan sudah benar.");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Terjadi kesalahan saat memeriksa database.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConsumerInvoices = async (phone: string) => {
    setIsFetchingInvoices(true);
    try {
      const normalizedQueryPhone = normalizePhone(phone);
      
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const q = query(
        collection(db, "pending_invoices"),
        where("phone", "in", [phone, normalizedQueryPhone, `0${normalizedQueryPhone}`, `62${normalizedQueryPhone}`])
      );

      const querySnapshot = await getDocs(q);
      const invoices: InvoiceData[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let invDate = new Date();
        
        if (data.date?.toDate) {
          invDate = data.date.toDate();
        } else if (data.createdAt?.toDate) {
          invDate = data.createdAt.toDate();
        } else if (typeof data.date === "string") {
          invDate = new Date(data.date);
        }

        if (invDate >= threeDaysAgo) {
          invoices.push({
            id: docSnap.id,
            invoiceNumber: data.invoiceNumber || docSnap.id,
            totalAmount: Number(data.totalAmount || 0),
            date: invDate,
            items: Array.isArray(data.items) ? data.items : [],
          });
        }
      });

      invoices.sort((a, b) => b.date.getTime() - a.date.getTime());
      setAvailableInvoices(invoices);

      if (invoices.length > 0) {
        setSelectedInvoice(invoices[0]);
      } else {
        setIsManualInput(true);
      }
    } catch (error) {
      console.error("Gagal menarik data invoice:", error);
      setIsManualInput(true);
    } finally {
      setIsFetchingInvoices(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setManualAmount("");
      return;
    }
    const formatted = new Intl.NumberFormat("id-ID").format(parseInt(rawValue, 10));
    setManualAmount(formatted);
  };

  const handleClaimVoucher = async () => {
    if (!voucherData) return;
    
    let finalInvoiceNumber = "";
    let finalAmount = 0;
    let finalItems: any[] = [];

    if (isManualInput) {
      if (!manualInvoice.trim()) {
        setErrorMsg("Nomor Struk / Invoice manual wajib diisi!");
        return;
      }
      finalAmount = parseInt(manualAmount.replace(/\D/g, ""), 10);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        setErrorMsg("Total Nilai Belanja wajib diisi dengan benar!");
        return;
      }
      finalInvoiceNumber = manualInvoice.trim();
      finalItems = [{ name: "Input Manual oleh Kasir", price: finalAmount, qty: 1 }];
    } else {
      if (!selectedInvoice) {
        setErrorMsg("Pilih invoice terlebih dahulu atau gunakan input manual!");
        return;
      }
      finalInvoiceNumber = selectedInvoice.invoiceNumber;
      finalAmount = selectedInvoice.totalAmount;
      finalItems = selectedInvoice.items;
    }

    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const kasirId = auth.currentUser?.uid || "kasir_aktif";
      const voucherRef = doc(db, "Speen_Winners", voucherData.id);

      await updateDoc(voucherRef, {
        status: "REDEEMED",
        invoiceNumber: finalInvoiceNumber,
        totalAmount: finalAmount,
        items: finalItems,
        claimedBy: kasirId,
        claimedAt: serverTimestamp(),
      });

      // Update UI sebelum dibersihkan
      setVoucherData({
        ...voucherData,
        status: "REDEEMED",
        invoiceNumber: finalInvoiceNumber,
        totalAmount: finalAmount,
      });

      setSuccessMsg("Voucher berhasil diklaim dan terhubung dengan Invoice!");
      setVoucherCode(""); 

      // === AUTO-CLEANUP ===
      // Bersihkan layar setelah 3.5 detik untuk melayani konsumen selanjutnya
      setTimeout(() => {
        setVoucherData(null);
        setSuccessMsg("");
      }, 3500);

    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal melakukan proses penukaran voucher.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* HEADER KASIR REDEEM */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Ticket size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-none text-white">
              Tukar Voucher Hadiah
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Validasi kode voucher dan hubungkan otomatis dengan Invoice belanja.
            </p>
          </div>
        </div>
      </div>

      {/* FORM PENCARIAN KODE */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <form onSubmit={handleCariVoucher} className="flex gap-3">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search size={16} className="text-slate-500" />
            </div>
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-11 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:font-normal placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="CONTOH: VCR-12345XYZ"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !voucherCode.trim()}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            {isLoading && !voucherData ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Cari Voucher"
            )}
          </button>
        </form>
      </div>

      {/* NOTIFIKASI */}
      {errorMsg && (
        <div className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 animate-in fade-in">
          <XCircle size={20} className="shrink-0 text-rose-400" />
          <p className="text-sm font-medium text-rose-300">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 animate-in fade-in">
          <CheckCircle size={20} className="shrink-0 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-300">{successMsg}</p>
        </div>
      )}

      {/* HASIL PENCARIAN TIKET VOUCHER */}
      {voucherData && (
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/80 p-6 shadow-lg animate-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between border-b border-slate-700 pb-4">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status Validasi
              </p>
              {voucherData.status === "REDEEMED" ? (
                <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">
                  <CheckCircle size={12} className="mr-1 inline pb-0.5" />
                  SUDAH DITUKARKAN
                </span>
              ) : (
                <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-400">
                  SIAP DIGUNAKAN
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-500">
                KODE VOUCHER
              </p>
              <p className="font-mono text-lg font-black tracking-widest text-white">
                {voucherData.id}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800">
              <p className="text-[10px] font-bold uppercase text-slate-500">Data Pemenang</p>
              <p className="mt-1 text-sm font-bold text-white">{voucherData.customerName}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{voucherData.customerPhone}</p>
            </div>
            
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-inner">
              <p className="text-[10px] font-bold uppercase text-indigo-400/80">Hadiah Dimenangkan</p>
              <p className="mt-1 text-lg font-black text-indigo-400">{voucherData.prizeName}</p>
            </div>
          </div>

          {/* JIKA VOUCHER SUDAH REDEEM: TAMPILKAN INFO TRANSAKSI */}
          {voucherData.status === "REDEEMED" && voucherData.invoiceNumber && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                <CheckCircle size={14} /> TELAH TERHUBUNG DENGAN INVOICE:
              </p>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-300 font-mono tracking-wide">
                  <strong className="text-white">{voucherData.invoiceNumber}</strong>
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg">
                  {formatRupiah(voucherData.totalAmount || 0)}
                </span>
              </div>
            </div>
          )}

          {/* JIKA VOUCHER BELUM REDEEM: TAMPILKAN FITUR FETCH / INPUT MANUAL */}
          {(voucherData.status === "PENDING_REDEEM" || voucherData.status === "AVAILABLE") && (
            <div className="mt-6 border-t border-slate-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Receipt size={16} className="text-indigo-400" /> Hubungkan Transaksi
                </h3>
                {isFetchingInvoices && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin text-indigo-400" /> Mencari data...
                  </span>
                )}
              </div>

              {!isManualInput && availableInvoices.length > 0 && (
                <div className="space-y-4">
                  <div className="relative">
                    <select
                      value={selectedInvoice?.id || ""}
                      onChange={(e) => {
                        const inv = availableInvoices.find(i => i.id === e.target.value);
                        if (inv) setSelectedInvoice(inv);
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-600 bg-slate-900 py-3.5 pl-4 pr-10 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {availableInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {formatRupiah(inv.totalAmount)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {selectedInvoice && (
                    <div className="rounded-xl bg-slate-950/50 p-4 border border-slate-800/80">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Waktu Pembelian</span>
                        <span className="text-xs text-slate-300 font-medium">
                          {selectedInvoice.date.toLocaleDateString("id-ID")} • {String(selectedInvoice.date.getHours()).padStart(2, '0')}:{String(selectedInvoice.date.getMinutes()).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Total Belanja</span>
                        <span className="text-sm text-emerald-400 font-black tracking-wide">
                          {formatRupiah(selectedInvoice.totalAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setIsManualInput(true)}
                    className="w-full text-center text-xs text-indigo-400 hover:text-indigo-300 font-semibold py-2"
                  >
                    Atau gunakan Input Manual
                  </button>
                </div>
              )}

              {(isManualInput || availableInvoices.length === 0) && !isFetchingInvoices && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">Mode Input Transaksi Manual</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase">Nomor Struk / Invoice</label>
                      <input 
                        type="text" 
                        value={manualInvoice}
                        onChange={(e) => setManualInvoice(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-600 bg-slate-900 py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Contoh: INV-2024-001"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase">Total Nilai Belanja</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <span className="text-slate-500 font-bold text-sm">Rp</span>
                        </div>
                        <input 
                          type="text" 
                          value={manualAmount}
                          onChange={handleAmountChange}
                          required
                          className="w-full rounded-xl border border-slate-600 bg-slate-900 py-3 pl-10 pr-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {availableInvoices.length > 0 && (
                    <button 
                      onClick={() => setIsManualInput(false)}
                      className="w-full text-center text-xs text-slate-400 hover:text-slate-300 font-semibold py-2"
                    >
                      Batal, kembali ke Data Otomatis
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleClaimVoucher}
                disabled={
                  isLoading || 
                  (!isManualInput && !selectedInvoice) || 
                  (isManualInput && (!manualInvoice || !manualAmount))
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Banknote size={18} />
                    Validasi Struk & Serahkan Hadiah
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* RIWAYAT PENUKARAN VOUCHER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <History size={18} className="text-slate-400" /> Riwayat Penukaran Anda
          </h3>
        </div>
        
        <div className="p-0">
          {redeemHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada voucher yang Anda tukarkan hari ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {redeemHistory.map((history) => (
                <div key={history.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-200">{history.customerName}</span>
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-500/20">
                          {history.invoiceNumber}
                        </span>
                      </div>
                      <p className="text-xs text-amber-300 font-bold mb-1.5">{history.prizeName}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <Clock size={10} />
                        {history.claimedAt.toLocaleDateString("id-ID")} • {String(history.claimedAt.getHours()).padStart(2, '0')}:{String(history.claimedAt.getMinutes()).padStart(2, '0')} WIB
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:items-end gap-1.5">
                      <span className="font-mono text-sm font-bold text-white tracking-widest">{history.id}</span>
                      <span className="text-xs text-emerald-400 font-bold">{formatRupiah(history.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}