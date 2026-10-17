"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, Suspense, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
} from "firebase/firestore";
import SpinWheelTV, {
  type Slot,
  type TVSessionData,
} from "../../../components/wheel/SpinWheelTV";
import { Trophy, Sparkles, Radio } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  tvBackgroundUrl?: string;
}

interface WinnerLog {
  id: string;
  userName: string;
  itemName: string;
  voucherCode: string;
  timestamp: string;
}

const MONITOR_ID = "SPEEN-MONITOR-MAIN";

function maskWinnerName(name: string): string {
  const clean = name.trim();
  if (!clean) return "Tamu***";
  if (clean.length <= 3) return `${clean}***`;
  return `${clean.substring(0, 4)}***`;
}

function TVMonitorContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allSlots, setAllSlots] = useState<Record<string, Slot[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isImagesLoaded, setIsImagesLoaded] = useState(false);

  const [isWheelActive, setIsWheelActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Penyelamat Bug Transisi: Mencegah timer dibatalkan di tengah jalan
  const isTransitioningRef = useRef(false); 
  const [animState, setAnimState] = useState<"in" | "out">("in");

  const [tvSession, setTvSession] = useState<TVSessionData | null>(null);
  const [winnersLog, setWinnersLog] = useState<WinnerLog[]>([]);
  const [logoError, setLogoError] = useState(false);

  // 1. Listener Realtime Campaign LIVE & Slots
  useEffect(() => {
    const qCamp = query(
      collection(db, "Speen_Campaigns"),
      where("status", "==", "LIVE")
    );

    const unsubscribeCamp = onSnapshot(
      qCamp,
      (snapshot) => {
        const activeCamps: Campaign[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<Campaign, "id">;
          activeCamps.push({ id: docSnap.id, ...data });
        });
        setCampaigns(activeCamps);
        setCurrentIndex((prevIndex) =>
          prevIndex >= activeCamps.length ? 0 : prevIndex
        );
      },
      (error) => {
        console.error("Gagal memuat data campaign TV:", error);
      }
    );

    const unsubscribeSlots = onSnapshot(
      collection(db, "Speen_CampaignSlots"),
      (snapshot) => {
        const slotsData: Record<string, Slot[]> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const campaignId =
            typeof data.campaignId === "string" ? data.campaignId : "";
          if (campaignId) {
            if (!slotsData[campaignId]) slotsData[campaignId] = [];
            slotsData[campaignId].push({
              id: docSnap.id,
              name: String(data.name ?? "Hadiah"),
              quantity: Number(data.quantity ?? 0),
              winRate: Number(data.winRate ?? 0),
              generatedCodes: Array.isArray(data.generatedCodes)
                ? (data.generatedCodes as string[])
                : [],
              imageUrl:
                typeof data.imageUrl === "string" ? data.imageUrl : undefined,
              color: typeof data.color === "string" ? data.color : undefined,
            });
          }
        });
        setAllSlots(slotsData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Gagal memuat slot campaign TV:", error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeCamp();
      unsubscribeSlots();
    };
  }, []);

  // 2. Inisialisasi & Listener Sesi TV (Sinkronisasi Remot HP & Log Pemenang)
  useEffect(() => {
    const sessionRef = doc(db, "Speen_TVSessions", MONITOR_ID);

    const initSession = async () => {
      try {
        await setDoc(
          sessionRef,
          {
            status: "IDLE",
            connectedUserId: null,
            connectedUserName: null,
            selectedCampaignId: null,
            spinTriggeredByMobile: false,
            spinResult: null,
            lastUpdatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Gagal inisialisasi sesi TV:", error);
      }
    };

    void initSession();

    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (!docSnap.exists()) return;

      const data = docSnap.data() as TVSessionData;
      setTvSession(data);

      // Catat pemenang baru ke Riwayat Pemenang di layar TV
      if (data.spinResult?.itemName) {
        const rawUserName =
          data.connectedUserName || data.currentConsumerName || "Tamu";
        const itemName = data.spinResult.itemName;
        const voucherCode =
          data.spinResult.voucherCode || `${Date.now().toString(36)}`;

        setWinnersLog((prev) => {
          const isExist = prev.some(
            (log) =>
              log.voucherCode === voucherCode && log.itemName === itemName
          );
          if (isExist) return prev;

          const newLog: WinnerLog = {
            id: `${voucherCode}-${Date.now()}`,
            userName: rawUserName,
            itemName,
            voucherCode,
            timestamp: new Date().toISOString(),
          };
          return [newLog, ...prev].slice(0, 5);
        });
      }
    });

    return () => unsubscribeSession();
  }, []);

  // 3. Pindah Campaign Otomatis Saat Dipilih dari Remot HP (FIXED BUG)
  useEffect(() => {
    const isRemoteConnected =
      tvSession?.status === "CONNECTED" ||
      tvSession?.status === "CONSUMER_CONNECTED";

    if (
      isRemoteConnected &&
      tvSession?.selectedCampaignId &&
      !isTransitioningRef.current
    ) {
      const selectedIndex = campaigns.findIndex(
        (c) => c.id === tvSession.selectedCampaignId
      );

      if (selectedIndex !== -1 && selectedIndex !== currentIndex) {
        isTransitioningRef.current = true;
        setIsTransitioning(true);
        setAnimState("out");

        window.setTimeout(() => {
          setCurrentIndex(selectedIndex);
          setAnimState("in");
          window.setTimeout(() => {
            setIsTransitioning(false);
            isTransitioningRef.current = false;
          }, 50);
        }, 900);
      }
    }
    // isTransitioning dihapus dari dependency agar tidak membatalkan timeout
  }, [tvSession?.selectedCampaignId, tvSession?.status, campaigns, currentIndex]); 

  // 4. Preload Gambar dengan Safety Timeout (Hanya sekali saat aset siap)
  useEffect(() => {
    if (isLoading || isImagesLoaded || campaigns.length === 0) return;

    const imageUrls = new Set<string>();

    campaigns.forEach((c) => {
      if (c.tvBackgroundUrl) imageUrls.add(c.tvBackgroundUrl);
    });

    Object.values(allSlots).forEach((slotsArr) => {
      slotsArr.forEach((slot) => {
        if (slot.imageUrl) imageUrls.add(slot.imageUrl);
      });
    });

    const totalImages = imageUrls.size;
    if (totalImages === 0) {
      setIsImagesLoaded(true);
      return;
    }

    let loadedCount = 0;
    let isCancelled = false;

    // Fallback timeout 5 detik agar TV tidak stuck jika ada URL gambar lambat
    const fallbackTimer = window.setTimeout(() => {
      if (!isCancelled) setIsImagesLoaded(true);
    }, 5000);

    const handleImageDone = () => {
      loadedCount += 1;
      if (!isCancelled && loadedCount >= totalImages) {
        window.clearTimeout(fallbackTimer);
        setIsImagesLoaded(true);
      }
    };

    imageUrls.forEach((url) => {
      const img = new window.Image();
      img.onload = handleImageDone;
      img.onerror = handleImageDone;
      img.src = url;
    });

    return () => {
      isCancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [isLoading, isImagesLoaded, campaigns, allSlots]);

  // 5. Rotasi Carousel Campaign Otomatis Setiap 25 Detik (Saat Idle)
  useEffect(() => {
    const isRemoteConnected =
      tvSession?.status === "CONNECTED" ||
      tvSession?.status === "CONSUMER_CONNECTED";

    if (
      campaigns.length <= 1 ||
      isWheelActive ||
      !isImagesLoaded ||
      isRemoteConnected
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setAnimState("out");

      window.setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % campaigns.length);
        setAnimState("in");
        window.setTimeout(() => {
          setIsTransitioning(false);
          isTransitioningRef.current = false;
        }, 50);
      }, 900);
    }, 25000);

    return () => window.clearInterval(timer);
  }, [campaigns.length, isWheelActive, isImagesLoaded, tvSession?.status]);

  // Tampilan Loading Awal
  if (isLoading || (campaigns.length > 0 && !isImagesLoaded)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#060911] p-8 text-white">
        <div className="mb-6 h-20 w-20 animate-spin rounded-full border-4 border-slate-800 border-t-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]" />
        <h2 className="mb-2 text-2xl font-bold uppercase tracking-[0.25em] text-[#F3E3A6]">
          Menyiapkan Mesin
        </h2>
        <p className="text-sm text-slate-400">
          Memuat aset visual Speen Wheel...
        </p>
      </div>
    );
  }

  // Tampilan Jika Belum Ada Campaign LIVE
  if (campaigns.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#172033_0%,#060911_75%)] p-8 text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
          <Sparkles className="h-12 w-12 animate-pulse text-amber-400" />
        </div>
        <h1 className="mb-4 text-4xl font-black tracking-wider text-white drop-shadow-lg sm:text-5xl">
          PROGRAM PROMO SEGERA HADIR
        </h1>
        <p className="max-w-lg text-lg text-slate-300 sm:text-xl">
          Saat ini belum ada campaign undian yang berstatus aktif. Silakan
          hubungi petugas toko untuk informasi lebih lanjut.
        </p>
      </main>
    );
  }

  const currentCampaign = campaigns[currentIndex] || campaigns[0];
  const currentSlots = allSlots[currentCampaign.id] || [];
  const isRemoteConnected =
    tvSession?.status === "CONNECTED" ||
    tvSession?.status === "CONSUMER_CONNECTED";

  return (
    <main className="relative h-screen w-full select-none overflow-hidden bg-black text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes floatingCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .anim-float-fast { animation: floatingCard 4s ease-in-out infinite; }
        .anim-float-slow { animation: floatingCard 5s ease-in-out infinite 1s; }
        
        @keyframes wheel-roll-in {
          0% { transform: translateY(120%) rotate(-140deg) scale(0.6); opacity: 0; }
          70% { transform: translateY(-3%) rotate(8deg) scale(1.03); opacity: 1; }
          100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        
        @keyframes wheel-roll-out {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(120%) rotate(140deg) scale(0.6); opacity: 0; }
        }

        .wheel-enter { animation: wheel-roll-in 1.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .wheel-exit { animation: wheel-roll-out 0.75s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
      `,
        }}
      />

      {/* Latar Belakang TV */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          animState === "out" ? "opacity-40" : "opacity-100"
        }`}
      >
        {currentCampaign.tvBackgroundUrl ? (
          <img
            src={currentCampaign.tvBackgroundUrl}
            alt={currentCampaign.name}
            className="absolute inset-0 z-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 z-0 h-full w-full bg-gradient-to-br from-indigo-950 via-slate-900 to-black" />
        )}
      </div>
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/50 via-black/15 to-black/40" />

      {/* Indikator Remot HP Terkoneksi (Kanan Atas) */}
      <div
        className={`absolute right-8 top-8 z-[90] transition-all duration-700 ${
          isRemoteConnected
            ? "translate-y-0 opacity-100"
            : "-translate-y-[150%] opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 rounded-full border border-emerald-400/50 bg-[#0B1527]/90 px-5 py-3 shadow-[0_0_25px_rgba(16,185,129,0.35)] backdrop-blur-xl">
          <div className="relative flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
          </div>
          <Radio className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider text-slate-200 sm:text-sm">
            REMOT TERKONEKSI:{" "}
            <span className="font-black text-emerald-400">
              {tvSession?.connectedUserName ||
                tvSession?.currentConsumerName ||
                "Pengunjung"}
            </span>
          </span>
        </div>
      </div>

      {/* Branding Logo (Kiri Atas) */}
      <div
        className={`absolute left-8 top-8 z-50 flex items-center gap-3.5 transition-all duration-1000 ${
          isWheelActive || animState === "out"
            ? "-translate-y-[200%] opacity-0"
            : "translate-y-0 opacity-100"
        }`}
      >
        {!logoError ? (
          <img
            src="/logo.png"
            alt="Mysehati Logo"
            onError={() => setLogoError(true)}
            className="h-10 w-10 object-contain drop-shadow-lg sm:h-12 sm:w-12"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#F3E3A6]/40 bg-[#0B1527]/80 font-serif text-xl font-black text-[#F3E3A6] shadow-lg">
            S
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-serif text-xl font-bold leading-none tracking-wider text-[#F3E3A6] drop-shadow-md sm:text-2xl">
            Speen Wheel
          </span>
          <span className="mt-1 text-[10px] font-light uppercase tracking-[0.2em] text-white/80 sm:text-xs">
            by Mysehati
          </span>
        </div>
      </div>

      {/* Kartu Info Campaign Aktif (Kiri Bawah) */}
      <div
        className={`absolute bottom-8 left-8 z-50 w-64 transition-all duration-1000 ease-in-out sm:w-80 ${
          isWheelActive || animState === "out"
            ? "-translate-x-[250%] opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div className="anim-float-fast rounded-2xl border border-[#F3E3A6]/35 bg-[#0B1527]/80 p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
              Program Promo Aktif
            </span>
            {campaigns.length > 1 && (
              <div className="flex items-center gap-1.5">
                {campaigns.map((camp, idx) => (
                  <span
                    key={camp.id}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentIndex
                        ? "w-4 bg-amber-400"
                        : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <h2 className="mb-2 line-clamp-2 bg-gradient-to-r from-yellow-200 via-amber-300 to-amber-500 bg-clip-text text-lg font-black uppercase tracking-wider text-transparent drop-shadow-sm sm:text-xl">
            {currentCampaign.name}
          </h2>
          <p className="text-xs font-medium leading-relaxed text-white/80">
            Ketuk tombol <strong className="text-amber-300">SPIN</strong> di
            tengah roda atau putar melalui ponsel Anda untuk mengundi hadiah!
          </p>
        </div>
      </div>

      {/* Kartu Riwayat Pemenang (Kanan Tengah) */}
      <div
        className={`absolute right-8 top-1/2 z-50 w-64 transition-all duration-1000 ease-in-out sm:w-72 ${
          isWheelActive || animState === "out"
            ? "translate-x-[250%] -translate-y-1/2 opacity-0"
            : "translate-x-0 -translate-y-1/2 opacity-100"
        }`}
      >
        <div className="anim-float-slow rounded-2xl border border-white/20 bg-[#0B1527]/75 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
            <span className="text-xs font-bold tracking-widest text-[#F3E3A6]">
              RIWAYAT PEMENANG
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-bold text-red-300">
              LIVE
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs text-white/90">
            {winnersLog.length === 0 ? (
              <div className="py-5 text-center text-xs font-medium text-slate-400">
                Belum ada pemenang pada sesi ini.
              </div>
            ) : (
              winnersLog.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5"
                >
                  <span className="font-semibold text-slate-200">
                    {maskWinnerName(log.userName)}
                  </span>
                  <span className="flex items-center gap-1.5 truncate font-bold text-[#F3E3A6]">
                    <Trophy size={12} className="shrink-0 text-amber-400" />
                    <span className="truncate">{log.itemName}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Area Utama Roda Spin Wheel */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
        <div
          className={`pointer-events-auto mt-10 aspect-square w-full max-w-[600px] sm:mt-14 ${
            animState === "out" ? "wheel-exit" : "wheel-enter"
          }`}
        >
          {!isTransitioning && (
            <SpinWheelTV
              key={currentCampaign.id}
              campaignId={currentCampaign.id}
              slots={currentSlots}
              onActiveStateChange={setIsWheelActive}
              tvSession={tvSession}
              monitorId={MONITOR_ID}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function TVMonitorDisplay() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#060911] text-2xl font-bold text-white">
          <span className="animate-pulse tracking-widest text-[#F3E3A6]">
            Menyiapkan Layar...
          </span>
        </div>
      }
    >
      <TVMonitorContent />
    </Suspense>
  );
}