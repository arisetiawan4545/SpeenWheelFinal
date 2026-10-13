"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, doc, setDoc, orderBy, limit } from "firebase/firestore";
import SpinWheelTV from "../../../components/wheel/SpinWheelTV";
import { Trophy } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  tvBackgroundUrl: string;
}

// Interface baru untuk Riwayat Pemenang
interface WinnerLog {
  id: string;
  userName: string;
  itemName: string;
  timestamp: any;
}

function TVMonitorContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allSlots, setAllSlots] = useState<{ [key: string]: any[] }>({}); 
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isImagesLoaded, setIsImagesLoaded] = useState(false); 
  
  const [isWheelActive, setIsWheelActive] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animState, setAnimState] = useState<"in" | "out">("in"); 

  const [tvSession, setTvSession] = useState<any>(null);
  const monitorId = "SPEEN-MONITOR-MAIN"; 

  // --- STATE BARU: RIWAYAT PEMENANG ---
  const [winnersLog, setWinnersLog] = useState<WinnerLog[]>([]);

  useEffect(() => {
    const qCamp = query(collection(db, "Speen_Campaigns"), where("status", "==", "LIVE"));
    const unsubscribeCamp = onSnapshot(qCamp, (snapshot) => {
      const activeCamps: Campaign[] = [];
      snapshot.forEach((doc) => activeCamps.push({ id: doc.id, ...doc.data() } as Campaign));
      setCampaigns(activeCamps);
      setCurrentIndex((prevIndex) => (prevIndex >= activeCamps.length ? 0 : prevIndex));
    });

    const unsubscribeSlots = onSnapshot(collection(db, "Speen_CampaignSlots"), (snapshot) => {
      const slotsData: { [key: string]: any[] } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.campaignId) {
          if (!slotsData[data.campaignId]) slotsData[data.campaignId] = [];
          slotsData[data.campaignId].push({ id: doc.id, ...data });
        }
      });
      setAllSlots(slotsData);
      setIsLoading(false);
    });

    return () => {
      unsubscribeCamp();
      unsubscribeSlots();
    };
  }, []);

  useEffect(() => {
    const sessionRef = doc(db, "Speen_TVSessions", monitorId);
    
    const initSession = async () => {
      try {
        await setDoc(sessionRef, {
          status: "IDLE",
          connectedUserId: null,
          connectedUserName: null,
          selectedCampaignId: null,
          spinTriggeredByMobile: false,
          spinResult: null,
          lastUpdatedAt: new Date()
        }, { merge: true });
      } catch (error) {
        console.error("Gagal inisialisasi sesi TV:", error);
      }
    };
    initSession();

    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTvSession(data);
        
        // JIKA ADA PEMENANG BARU DI SESI INI, MASUKKAN KE LOG SEMENTARA (Tampil di TV)
        if (data.spinResult && data.connectedUserName) {
             setWinnersLog(prev => {
                // Hindari duplikat jika data yang sama terkirim dua kali
                const isExist = prev.some(log => log.userName === data.connectedUserName && log.itemName === data.spinResult.itemName);
                if (isExist) return prev;
                
                const newLog = {
                    id: Math.random().toString(),
                    userName: data.connectedUserName,
                    itemName: data.spinResult.itemName,
                    timestamp: new Date()
                };
                // Simpan maksimal 5 pemenang terakhir di layar
                return [newLog, ...prev].slice(0, 5);
             });
        }
      }
    });

    return () => unsubscribeSession();
  }, []);

  useEffect(() => {
    if (tvSession?.status === "CONNECTED" && tvSession?.selectedCampaignId && !isTransitioning) {
      const selectedIndex = campaigns.findIndex(c => c.id === tvSession.selectedCampaignId);
      
      if (selectedIndex !== -1 && selectedIndex !== currentIndex) {
        setIsTransitioning(true);
        setAnimState("out");
        
        setTimeout(() => {
          setCurrentIndex(selectedIndex);
          setAnimState("in");
          setTimeout(() => setIsTransitioning(false), 50);
        }, 1000);
      }
    }
  }, [tvSession?.selectedCampaignId, tvSession?.status, campaigns, currentIndex, isTransitioning]);

  useEffect(() => {
    if (isLoading || campaigns.length === 0) return;

    let loadedCount = 0;
    const imageUrls = new Set<string>(); 

    campaigns.forEach(c => {
      if (c.tvBackgroundUrl) imageUrls.add(c.tvBackgroundUrl);
    });

    Object.values(allSlots).forEach(slotsArr => {
      slotsArr.forEach(slot => {
        if (slot.imageUrl) imageUrls.add(slot.imageUrl);
      });
    });

    const totalImages = imageUrls.size;

    if (totalImages === 0) {
      setIsImagesLoaded(true);
      return;
    }

    imageUrls.forEach(url => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loadedCount++;
        if (loadedCount >= totalImages) setIsImagesLoaded(true);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalImages) setIsImagesLoaded(true);
      };
    });
  }, [isLoading, campaigns, allSlots]);

  useEffect(() => {
    if (campaigns.length <= 1 || isWheelActive || !isImagesLoaded || tvSession?.status === "CONNECTED") return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setAnimState("out");
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % campaigns.length);
        setAnimState("in");
        setTimeout(() => {
           setIsTransitioning(false);
        }, 50); 
      }, 1000); 

    }, 25000); 

    return () => clearInterval(timer);
  }, [campaigns.length, isWheelActive, isImagesLoaded, tvSession?.status]);

  if (isLoading || (campaigns.length > 0 && !isImagesLoaded)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-8">
        <div className="w-20 h-20 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold tracking-widest text-[#F3E3A6] mb-2 uppercase">Menyiapkan Mesin</h2>
        <p className="text-sm text-slate-400">Memuat aset visual premium...</p>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
         <div className="w-24 h-24 border-4 border-slate-600 border-t-amber-500 rounded-full animate-spin mx-auto mb-8"></div>
         <h1 className="text-5xl font-black text-white mb-4 drop-shadow-lg">MOHON TUNGGU</h1>
         <p className="text-xl text-slate-300">Belum ada Program Promo yang aktif saat ini.</p>
      </main>
    );
  }

  const currentCampaign = campaigns[currentIndex];
  const currentSlots = allSlots[currentCampaign.id] || [];

  return (
    <main className="h-screen w-full bg-black relative overflow-hidden text-white">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .anim-float-fast { animation: floatingCard 4s ease-in-out infinite; }
        .anim-float-slow { animation: floatingCard 5s ease-in-out infinite 1s; }
        
        @keyframes wheel-roll-in {
          0% { transform: translateY(150%) rotate(-180deg) scale(0.5); opacity: 0; }
          70% { transform: translateY(-5%) rotate(10deg) scale(1.05); opacity: 1; }
          100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        
        @keyframes wheel-roll-out {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(150%) rotate(180deg) scale(0.5); opacity: 0; }
        }

        .wheel-enter { animation: wheel-roll-in 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .wheel-exit { animation: wheel-roll-out 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
      `}} />

      <div className={`absolute inset-0 transition-opacity duration-1000 ${animState === "out" ? "opacity-50" : "opacity-100"}`}>
        {currentCampaign.tvBackgroundUrl ? (
          <img 
            src={currentCampaign.tvBackgroundUrl} 
            alt="TV Background" 
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-black z-0"></div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/20 z-0"></div>

      <div 
        className={`absolute top-8 right-8 z-[100] transition-all duration-700 cubic-bezier(0.68, -0.55, 0.265, 1.55) ${
          tvSession?.status === "CONNECTED" ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0"
        }`}
      >
         <div className="bg-[#0B1527]/90 border border-emerald-500/50 rounded-full px-5 py-3 flex items-center gap-3 backdrop-blur-xl shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <div className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </div>
            <span className="text-sm font-bold text-slate-300 tracking-wider">
              REMOT TERKONEKSI: <span className="text-emerald-400 font-black">{tvSession?.connectedUserName || "Memuat..."}</span>
            </span>
         </div>
      </div>

      <div 
        className={`absolute top-8 left-8 z-50 flex items-center gap-3 transition-all duration-1000 cubic-bezier(0.68, -0.55, 0.265, 1.55) ${
          isWheelActive || animState === "out" ? "-translate-y-[200%] opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <img src="/logo.png" alt="Mysehati Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-lg" />
        <div className="flex flex-col">
          <span className="font-serif text-xl sm:text-2xl font-bold tracking-wider text-[#F3E3A6] drop-shadow-md leading-none">
            Speen Wheel
          </span>
          <span className="text-[10px] sm:text-xs font-light tracking-widest opacity-90 mt-1">
            by Mysehati
          </span>
        </div>
      </div>

      <div 
        className={`absolute bottom-8 left-8 z-50 w-60 sm:w-72 transition-all duration-1000 ease-in-out ${
          isWheelActive || animState === "out" ? "-translate-x-[250%] opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div className="anim-float-fast rounded-2xl border border-[#F3E3A6]/30 bg-[#0B1527]/75 p-4 backdrop-blur-md shadow-2xl">
          <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 uppercase tracking-widest mb-1.5 drop-shadow-sm line-clamp-2">
            {currentCampaign.name}
          </h2>
          <p className="text-[11px] sm:text-xs text-white/80 leading-relaxed font-medium">
            Ketuk tombol SPIN di tengah roda untuk mengundi hadiah!
          </p>
        </div>
      </div>

      <div 
        className={`absolute top-1/2 right-8 z-50 w-64 sm:w-72 transition-all duration-1000 ease-in-out ${
          isWheelActive || animState === "out" ? "translate-x-[250%] -translate-y-1/2 opacity-0" : "translate-x-0 -translate-y-1/2 opacity-100"
        }`}
      >
        <div className="anim-float-slow rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2 mb-3 border-b border-white/10 pb-2.5">
            <span className="text-xs font-bold tracking-widest text-[#F3E3A6]">RIWAYAT PEMENANG</span>
          </div>
          
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-red-400">
              🏆 LIVE PEMENANG <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
          </div>

          <div className="flex flex-col gap-2.5 text-[10px] sm:text-xs text-white/90">
             {/* --- TAMPILKAN LOG PEMENANG ASLI DARI STATE --- */}
             {winnersLog.length === 0 ? (
                 <div className="text-center py-4 text-slate-400 font-medium">
                    Belum ada pemenang sesi ini.
                 </div>
             ) : (
                 winnersLog.map((log) => (
                    <div key={log.id} className="flex justify-between items-center bg-black/20 px-2.5 py-2 rounded-lg border border-white/5 animate-in fade-in slide-in-from-right-4 duration-500">
                      {/* Sensor nama (Tampilkan 4 huruf pertama, lalu ***) */}
                      <span className="font-medium">{log.userName.substring(0, 4)}***</span> 
                      <span className="text-[#F3E3A6] font-semibold flex items-center gap-1.5 text-[10px] sm:text-xs">
                          <Trophy size={10} /> {log.itemName}
                      </span>
                    </div>
                 ))
             )}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div 
          className={`w-full max-w-[650px] aspect-square pointer-events-auto mt-32 sm:mt-40 ${
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
               monitorId={monitorId} 
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
        <div className="min-h-screen bg-black flex items-center justify-center text-white text-2xl font-bold animate-pulse">
          Menyiapkan Layar...
        </div>
      }
    >
      <TVMonitorContent />
    </Suspense>
  );
}