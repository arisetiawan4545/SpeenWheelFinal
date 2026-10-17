"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../../lib/firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { Sparkles, Play, Trophy, X, AlertCircle, UserCheck } from "lucide-react";
import Confetti from "react-confetti";

export interface Slot {
  id: string;
  name: string;
  quantity: number;
  winRate: number;
  generatedCodes: string[];
  imageUrl?: string;
  color?: string;
}

export interface TVSessionData {
  status?: "IDLE" | "CONNECTED" | "CONSUMER_CONNECTED" | "SPINNING" | "FINISHED" | string;
  connectedUserId?: string | null;
  connectedUserName?: string | null;
  currentConsumerName?: string | null;
  selectedCampaignId?: string | null;
  spinTriggeredByMobile?: boolean;
  spinResult?: {
    slotId: string;
    itemName: string;
    voucherCode: string;
  } | null;
  lastUpdatedAt?: unknown;
}

export interface SpinWheelTVProps {
  campaignId: string;
  slots: Slot[];
  onActiveStateChange?: (isActive: boolean) => void;
  tvSession?: TVSessionData | null;
  monitorId?: string;
}

const PREMIUM_COLORS = [
  "#172033",
  "#7b1e2b",
  "#174b4b",
  "#47316c",
  "#8c5b17",
  "#263b66",
];

const AUTO_CLOSE_SECONDS = 10;

export default function SpinWheelTV({
  campaignId,
  slots,
  onActiveStateChange,
  tvSession,
  monitorId,
}: SpinWheelTVProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFastSpinning, setIsFastSpinning] = useState(false);
  const [winner, setWinner] = useState<Slot | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winningCode, setWinningCode] = useState("");
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [windowDim, setWindowDim] = useState({ width: 0, height: 0 });

  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  const wheelRef = useRef<HTMLDivElement>(null);
  const currentRotationRef = useRef(0);
  const lastSlotRef = useRef(0);
  const idleAnimationIdRef = useRef<number | null>(null);
  const spinAnimationIdRef = useRef<number | null>(null);

  const numSlots = slots.length;
  const sliceAngle = numSlots > 1 ? 360 / numSlots : 360;

  // Inisialisasi ukuran layar & audio
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowDim({ width: window.innerWidth, height: window.innerHeight });
    };
    updateWindowSize();
    window.addEventListener("resize", updateWindowSize);

    if (typeof window !== "undefined") {
      spinAudioRef.current = new Audio("/sounds/spin-tick.mp3");
      winAudioRef.current = new Audio("/sounds/win-tada.mp3");

      if (spinAudioRef.current) {
        spinAudioRef.current.loop = false;
      }
    }

    return () => {
      window.removeEventListener("resize", updateWindowSize);
      if (idleAnimationIdRef.current) cancelAnimationFrame(idleAnimationIdRef.current);
      if (spinAnimationIdRef.current) cancelAnimationFrame(spinAnimationIdRef.current);
    };
  }, []);

  // Auto-hide pesan notifikasi di layar TV
  useEffect(() => {
    if (!noticeMessage) return;
    const timer = window.setTimeout(() => setNoticeMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [noticeMessage]);

  // Animasi Putar Pelan (Idle)
  useEffect(() => {
    if (onActiveStateChange) {
      onActiveStateChange(isSpinning || showWinnerModal);
    }

    const spinIdle = () => {
      if (!isSpinning && !showWinnerModal) {
        currentRotationRef.current = (currentRotationRef.current + 0.15) % 36000;
        if (wheelRef.current) {
          wheelRef.current.style.transform = `rotate(${currentRotationRef.current}deg)`;
        }
      }
      idleAnimationIdRef.current = requestAnimationFrame(spinIdle);
    };

    if (!isSpinning && !showWinnerModal) {
      idleAnimationIdRef.current = requestAnimationFrame(spinIdle);
    }

    return () => {
      if (idleAnimationIdRef.current) cancelAnimationFrame(idleAnimationIdRef.current);
    };
  }, [isSpinning, showWinnerModal, onActiveStateChange]);

  // Ketika Popup Pemenang Ditutup (Selesai Main)
  const handleCloseModal = useCallback(async () => {
    setShowWinnerModal(false);
    setCountdown(AUTO_CLOSE_SECONDS);

    // Putus koneksi sesi HP dan kembalikan TV ke mode IDLE menunggu pengunjung berikutnya
    if (
      monitorId &&
      (tvSession?.status === "CONNECTED" || tvSession?.status === "CONSUMER_CONNECTED")
    ) {
      try {
        await setDoc(doc(db, "Speen_TVSessions", monitorId), {
          status: "IDLE",
          connectedUserId: null,
          connectedUserName: null,
          selectedCampaignId: null,
          spinTriggeredByMobile: false,
          spinResult: null,
          lastUpdatedAt: new Date(),
        });
      } catch (error) {
        console.error("Gagal mereset sesi TV:", error);
      }
    }
  }, [monitorId, tvSession?.status]);

  // Tutup Otomatis Popup dalam 10 Detik dengan Countdown Live
  useEffect(() => {
    if (!showWinnerModal) return;

    setCountdown(AUTO_CLOSE_SECONDS);

    const intervalId = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const autoCloseTimer = window.setTimeout(() => {
      void handleCloseModal();
    }, AUTO_CLOSE_SECONDS * 1000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(autoCloseTimer);
    };
  }, [showWinnerModal, handleCloseModal]);

  // Penyelesaian Putaran & Update Firestore
  const finishSpin = useCallback(
    (selectedWinner: Slot | null) => {
      window.setTimeout(async () => {
        if (winAudioRef.current) {
          winAudioRef.current.currentTime = 0;
          winAudioRef.current.play().catch(() => {
            // Audio autoplay diblokir browser jika belum ada interaksi
          });
        }

        const safeCodes = Array.isArray(selectedWinner?.generatedCodes)
          ? selectedWinner.generatedCodes
          : [];
        const codeToShow = safeCodes[0] || "VOUCHER-SPEEN";

        setWinner(selectedWinner);
        setWinningCode(codeToShow);
        setShowWinnerModal(true);
        setIsSpinning(false);

        if (selectedWinner) {
          try {
            const slotRef = doc(db, "Speen_CampaignSlots", selectedWinner.id);
            const updatedCodes = safeCodes.slice(1);
            await updateDoc(slotRef, {
              quantity: Math.max(0, selectedWinner.quantity - 1),
              generatedCodes: updatedCodes,
            });

            if (monitorId) {
              await setDoc(
                doc(db, "Speen_TVSessions", monitorId),
                {
                  spinResult: {
                    slotId: selectedWinner.id,
                    itemName: selectedWinner.name,
                    voucherCode: codeToShow,
                  },
                  spinTriggeredByMobile: false,
                  lastUpdatedAt: new Date(),
                },
                { merge: true }
              );
            }
          } catch (error) {
            console.error("Gagal memproses hasil putaran:", error);
          }
        }
      }, 500);
    },
    [monitorId]
  );

  // Eksekusi Putaran Roda
  const handleSpin = useCallback(() => {
    if (isSpinning || numSlots === 0) return;

    const availableSlots = slots.filter(
      (slot) => slot.quantity > 0 && slot.winRate > 0
    );
    const fallbackAvailable =
      availableSlots.length > 0
        ? availableSlots
        : slots.filter((slot) => slot.quantity > 0);

    if (fallbackAvailable.length === 0) {
      setNoticeMessage("Mohon maaf, seluruh kuota hadiah pada campaign ini telah habis!");
      return;
    }

    setIsSpinning(true);
    setIsFastSpinning(true);
    setWinner(null);
    setShowWinnerModal(false);

    if (idleAnimationIdRef.current) {
      cancelAnimationFrame(idleAnimationIdRef.current);
    }

    const totalAvailableWinRate = fallbackAvailable.reduce(
      (sum, slot) => sum + (slot.winRate > 0 ? slot.winRate : 1),
      0
    );
    const randomNum = Math.random() * totalAvailableWinRate;
    let currentWeight = 0;
    let selectedWinner: Slot | null = null;

    for (const slot of fallbackAvailable) {
      currentWeight += slot.winRate > 0 ? slot.winRate : 1;
      if (randomNum <= currentWeight) {
        selectedWinner = slot;
        break;
      }
    }

    if (!selectedWinner) selectedWinner = fallbackAvailable[0];

    const winnerIndex = slots.findIndex((slot) => slot.id === selectedWinner!.id);
    const stopAngle = winnerIndex * sliceAngle + sliceAngle / 2;

    const baseRotation = currentRotationRef.current;
    const spins = 360 * 8;
    const currentMod = baseRotation % 360;
    const targetMod = 360 - stopAngle;
    let diff = targetMod - currentMod;
    if (diff < 0) diff += 360;

    const finalRotation = baseRotation + spins + diff;
    const spinDistance = finalRotation - baseRotation;

    const spinDuration = 8000;
    let startTime: number | null = null;
    lastSlotRef.current = Math.floor(baseRotation / sliceAngle);

    const animateActiveSpin = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentAngle = baseRotation + spinDistance * easeOut;

      currentRotationRef.current = currentAngle;
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentAngle}deg)`;
      }

      const currentSlotPos = Math.floor(currentAngle / sliceAngle);
      if (currentSlotPos > lastSlotRef.current) {
        if (spinAudioRef.current) {
          const tickClone = spinAudioRef.current.cloneNode() as HTMLAudioElement;
          tickClone.volume = 0.5;
          tickClone.play().catch(() => {
            // Diabaikan jika browser memblokir audio otomatis
          });
        }
        lastSlotRef.current = currentSlotPos;
      }

      if (progress < 1) {
        spinAnimationIdRef.current = requestAnimationFrame(animateActiveSpin);
      } else {
        setIsFastSpinning(false);
        finishSpin(selectedWinner);
      }
    };

    spinAnimationIdRef.current = requestAnimationFrame(animateActiveSpin);
  }, [isSpinning, numSlots, slots, sliceAngle, finishSpin]);

  // Trigger Otomatis dari HP Konsumen
  useEffect(() => {
    if (tvSession?.spinTriggeredByMobile === true && !isSpinning && !showWinnerModal) {
      handleSpin();
    }
  }, [tvSession?.spinTriggeredByMobile, isSpinning, showWinnerModal, handleSpin]);

  const renderLights = () => {
    const lights = [];
    const numLights = 36;
    for (let i = 0; i < numLights; i++) {
      const angle = (i * 360) / numLights - 90;
      const radians = (angle * Math.PI) / 180;
      lights.push(
        <div
          key={i}
          className="absolute z-30 h-2.5 w-2.5 rounded-full md:h-3.5 md:w-3.5"
          style={{
            top: `${50 + Math.sin(radians) * 47.2}%`,
            left: `${50 + Math.cos(radians) * 47.2}%`,
            transform: "translate(-50%, -50%)",
            animation: `chasing-lights ${isFastSpinning ? "0.6s" : "1.5s"} infinite`,
            animationDelay: `${i * 0.05}s`,
            backgroundColor: isFastSpinning ? "#ffffff" : "#fde68a",
          }}
        />
      );
    }
    return lights;
  };

  const activeConsumerName =
    tvSession?.connectedUserName || tvSession?.currentConsumerName || null;

  return (
    <div
      data-campaign-id={campaignId}
      className="relative mx-auto flex aspect-square w-full max-w-[560px] shrink-0 select-none items-center justify-center p-2 sm:p-4"
    >
      <style jsx>{`
        @keyframes premium-wheel-glow {
          0%, 100% { opacity: 0.58; transform: scale(0.985); }
          50% { opacity: 0.92; transform: scale(1.015); }
        }
        @keyframes premium-sheen {
          0% { transform: translateX(-150%) rotate(18deg); }
          55%, 100% { transform: translateX(190%) rotate(18deg); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes chasing-lights {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(0.8);
            box-shadow: none;
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.3);
            box-shadow: 0 0 12px 2px rgba(255, 255, 255, 0.9);
          }
        }
        .premium-sheen {
          animation: premium-sheen 3.2s ease-in-out infinite;
        }
        .premium-glow {
          animation: premium-wheel-glow 3s ease-in-out infinite;
        }
        .heartbeat-btn {
          animation: ${!isSpinning ? "heartbeat 2s ease-in-out infinite" : "none"};
        }
      `}</style>

      {/* Banner Notifikasi Non-Blocking (Pengganti alert browser) */}
      {noticeMessage && (
        <div className="fixed left-1/2 top-6 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-300/60 bg-[#141824]/95 px-5 py-3.5 text-sm font-semibold text-amber-100 shadow-[0_15px_40px_rgba(0,0,0,0.75)] backdrop-blur-md">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Soft gold aura */}
      <div className="premium-glow absolute inset-[1%] rounded-full bg-amber-400/20 blur-2xl" />

      {/* Layered metallic housing */}
      <div
        className="absolute inset-[1.5%] rounded-full p-[1.15%] shadow-[0_22px_55px_rgba(0,0,0,0.55),0_0_50px_rgba(216,170,65,0.22)]"
        style={{
          background:
            "linear-gradient(135deg, #fff2b8 0%, #8b6420 8%, #f7df8a 15%, #30230d 25%, #d0a84a 38%, #fff0ad 48%, #684916 61%, #f5d77b 74%, #4b330e 88%, #f8e5a0 100%)",
        }}
      >
        <div className="relative h-full w-full rounded-full border border-[#fbe8a2]/70 bg-[radial-gradient(circle_at_30%_18%,#3d3425_0%,#171a22_38%,#07090f_75%)] shadow-[inset_0_3px_10px_rgba(255,255,255,0.28),inset_0_-10px_25px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-[2.3%] rounded-full border border-amber-100/25 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.035),0_0_0_1px_rgba(0,0,0,0.9)]" />
        </div>
      </div>

      {/* Indicator / Jarum Penunjuk Atas */}
      <div className="absolute left-1/2 top-[1.2%] z-[60] flex -translate-x-1/2 flex-col items-center drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]">
        <div className="relative z-10 flex h-8 w-12 items-center justify-center rounded-t-xl border border-[#fff0ac] bg-gradient-to-b from-[#fff3b8] via-[#d8ad4c] to-[#765016] shadow-[0_0_18px_rgba(255,206,85,0.55)] sm:h-10 sm:w-14">
          <div className="h-2 w-5 rounded-full bg-white/70 blur-[1px]" />
        </div>
        <div className="-mt-1 h-0 w-0 border-l-[17px] border-r-[17px] border-t-[32px] border-l-transparent border-r-transparent border-t-[#f5d36f] sm:border-l-[20px] sm:border-r-[20px] sm:border-t-[38px]" />
        <div className="-mt-[30px] h-0 w-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#8b1c25] sm:-mt-[35px] sm:border-l-[12px] sm:border-r-[12px] sm:border-t-[23px]" />
      </div>

      {/* Perimeter lights */}
      <div className="pointer-events-none absolute inset-0 z-40 rounded-full">
        {renderLights()}
      </div>

      {/* Main wheel */}
      <div className="absolute inset-[7.8%] z-10 overflow-hidden rounded-full border-[3px] border-[#f2d47d] bg-[#101521] shadow-[0_0_0_5px_rgba(16,16,18,0.96),0_0_0_7px_rgba(225,187,83,0.7),inset_0_0_35px_rgba(0,0,0,0.9)] sm:border-4">
        <div
          ref={wheelRef}
          className="h-full w-full will-change-transform"
          style={{
            filter: isFastSpinning ? "blur(1.2px) saturate(1.1)" : "blur(0px)",
            transition: "filter 1.5s ease-out",
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label="Roda undian hadiah"
          >
            <defs>
              {slots.map((slot) =>
                slot.imageUrl ? (
                  <pattern
                    id={`img-${slot.id}`}
                    key={`pat-${slot.id}`}
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    patternUnits="userSpaceOnUse"
                  >
                    <image
                      href={slot.imageUrl}
                      x="0"
                      y="0"
                      width="100"
                      height="100"
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </pattern>
                ) : null
              )}
              <radialGradient id="wheel-glass" cx="28%" cy="18%" r="90%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
              </radialGradient>
            </defs>

            {slots.map((slot, index) => {
              const isWinningSlot = winner?.id === slot.id;
              const isLoser = !isSpinning && winner !== null && !isWinningSlot;
              const fill = slot.imageUrl
                ? `url(#img-${slot.id})`
                : slot.color || PREMIUM_COLORS[index % PREMIUM_COLORS.length];

              const startAngle = index * sliceAngle;
              const endAngle = startAngle + sliceAngle;
              const midAngle = startAngle + sliceAngle / 2;

              // Koordinat label teks hadiah secara radial
              const textRadius = 31;
              const textX = 50 + textRadius * Math.cos((Math.PI * midAngle) / 180);
              const textY = 50 + textRadius * Math.sin((Math.PI * midAngle) / 180);
              const displayLabel =
                slot.name.length > 15 ? `${slot.name.slice(0, 14)}…` : slot.name;

              // Koordinat pin emas pembatas juring di tepi roda
              const studRadius = 46.8;
              const studX = 50 + studRadius * Math.cos((Math.PI * startAngle) / 180);
              const studY = 50 + studRadius * Math.sin((Math.PI * startAngle) / 180);

              if (numSlots === 1) {
                return (
                  <g key={slot.id}>
                    <circle
                      cx="50"
                      cy="50"
                      r="50"
                      fill={fill}
                      stroke={isWinningSlot ? "#fff0a6" : "rgba(255,255,255,0.4)"}
                      strokeWidth={isWinningSlot ? "1.6" : "0.5"}
                      opacity={isLoser ? 0.38 : 1}
                    />
                    {!slot.imageUrl && (
                      <text
                        x="50"
                        y="26"
                        fill="#fff8dc"
                        fontSize="4.2"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                      >
                        {displayLabel}
                      </text>
                    )}
                  </g>
                );
              }

              const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
              const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
              const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
              const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);
              const largeArcFlag = sliceAngle > 180 ? 1 : 0;
              const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

              return (
                <g
                  key={slot.id}
                  opacity={isLoser ? 0.45 : 1}
                  style={{ transition: "opacity 0.6s ease" }}
                >
                  <path
                    d={pathData}
                    fill={fill}
                    stroke={isWinningSlot ? "#fff0a6" : "rgba(255,239,190,0.72)"}
                    strokeWidth={isWinningSlot ? "1.35" : "0.42"}
                    style={{ transition: "stroke 0.5s, stroke-width 0.5s" }}
                  />
                  {/* Label Nama Hadiah (Tampil otomatis bila slot tidak memakai full-image) */}
                  {!slot.imageUrl && (
                    <text
                      x={textX}
                      y={textY}
                      fill="#fff6d6"
                      fontSize={numSlots > 8 ? "2.6" : "3.1"}
                      fontWeight="800"
                      letterSpacing="0.03em"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                      style={{
                        textShadow: "0px 1px 3px rgba(0,0,0,0.95)",
                        pointerEvents: "none",
                      }}
                    >
                      {displayLabel}
                    </text>
                  )}
                  {/* Pin Emas Pembatas Juring */}
                  <circle
                    cx={studX}
                    cy={studY}
                    r="0.85"
                    fill="#fff1b8"
                    stroke="#694812"
                    strokeWidth="0.25"
                  />
                </g>
              );
            })}

            <circle
              cx="50"
              cy="50"
              r="49.4"
              fill="url(#wheel-glass)"
              pointerEvents="none"
            />
            <circle
              cx="50"
              cy="50"
              r="48.7"
              fill="none"
              stroke="#fff1bd"
              strokeOpacity="0.52"
              strokeWidth="0.45"
              pointerEvents="none"
            />
          </svg>
        </div>
      </div>

      {/* Center button */}
      <button
        type="button"
        onClick={handleSpin}
        disabled={
          isSpinning ||
          numSlots === 0 ||
          tvSession?.status === "CONNECTED" ||
          tvSession?.status === "CONSUMER_CONNECTED"
        }
        aria-label={isSpinning ? "Roda sedang berputar" : "Mulai spin"}
        className="heartbeat-btn group absolute left-1/2 top-1/2 z-[70] flex aspect-square w-[16.5%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#fff0b0] bg-[radial-gradient(circle_at_32%_20%,#5c6575_0%,#202838_35%,#090d16_78%)] p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.75),0_0_0_4px_rgba(15,17,22,0.95),0_0_0_6px_rgba(220,177,72,0.95),0_0_28px_rgba(246,201,89,0.38)] transition duration-300 hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-90"
      >
        <span className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-b from-[#bd2734] via-[#8f1525] to-[#3e0b16] text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-7px_12px_rgba(0,0,0,0.42)]">
          <span className="premium-sheen pointer-events-none absolute -inset-y-8 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <span className="relative mb-0.5 flex items-center justify-center rounded-full border border-amber-100/50 bg-black/15 p-1 shadow-inner sm:mb-1 sm:p-1.5">
            {isSpinning ? (
              <Sparkles className="h-3 w-3 animate-spin text-amber-100 sm:h-4 sm:w-4" />
            ) : (
              <Play className="ml-0.5 h-3 w-3 fill-amber-100 text-amber-100 sm:h-4 sm:w-4" />
            )}
          </span>
          <span className="relative text-[clamp(10px,2vw,16px)] font-black uppercase leading-none tracking-[0.16em] text-[#fff2c4] drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
            SPIN
          </span>
          <span className="relative mt-0.5 text-[clamp(4px,0.7vw,6.5px)] font-bold uppercase tracking-[0.15em] text-white/65">
            Lucky Wheel
          </span>
        </span>
      </button>

      {/* Winner celebration modal */}
      {showWinnerModal && winner && (
        <>
          <div className="pointer-events-none fixed inset-0 z-[110]">
            <Confetti
              width={windowDim.width}
              height={windowDim.height}
              recycle={false}
              numberOfPieces={500}
              gravity={0.12}
              colors={["#fff0a6", "#d6ad4f", "#f9e7a0", "#b91c32", "#ffffff"]}
            />
          </div>

          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070c]/85 p-4 backdrop-blur-xl animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
          >
            <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#f0d681]/80 bg-[radial-gradient(ellipse_at_top,#354052_0%,#151b27_48%,#080b12_100%)] p-6 text-center shadow-[0_25px_100px_rgba(0,0,0,0.72),0_0_60px_rgba(222,179,77,0.19)] sm:p-10">
              <div className="pointer-events-none absolute inset-2 rounded-[1.6rem] border border-white/10" />
              <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-300/15 blur-3xl" />

              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Tutup dialog pemenang"
                className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>

              <div className="relative z-10 mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#fff0a5] bg-gradient-to-br from-[#fff0ae] via-[#d5a742] to-[#71470f] text-[#2b1a05] shadow-[0_0_35px_rgba(248,208,101,0.35)] sm:h-24 sm:w-24">
                <Trophy size={42} strokeWidth={1.7} />
              </div>

              {activeConsumerName && (
                <div className="relative z-10 mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-200">
                  <UserCheck size={14} />
                  <span>Pemenang: {activeConsumerName}</span>
                </div>
              )}

              <p className="relative z-10 mb-1 text-xs font-bold uppercase tracking-[0.32em] text-[#f2d989]">
                Pemenang Terpilih
              </p>
              <h2
                id="winner-title"
                className="relative z-10 mb-2 bg-clip-text text-4xl font-black uppercase tracking-[0.08em] text-transparent drop-shadow-sm [background-image:linear-gradient(100deg,#fff2b7,#d3a23a,#fff0ab)] sm:text-6xl"
              >
                JACKPOT!
              </h2>
              <p className="relative z-10 mb-6 text-sm text-slate-300 sm:text-base">
                Selamat! Hadiah spesial ini resmi menjadi milik Anda.
              </p>

              <div className="relative z-10 mb-6 rounded-2xl border border-[#e9ca75]/35 bg-black/25 p-5 shadow-inner sm:p-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[#d9b85f]">
                  Hadiah yang Dimenangkan
                </p>
                <h3 className="mb-5 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  {winner.name}
                </h3>
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 sm:text-xs">
                  Kode Voucher Anda (Simpan / Foto Layar Ini)
                </p>
                <div className="rounded-xl border border-dashed border-[#e8c763]/70 bg-[#06080d] px-3 py-4 shadow-[inset_0_0_24px_rgba(0,0,0,0.8)] sm:px-5">
                  <span className="break-all font-mono text-xl font-bold tracking-[0.12em] text-[#ffe69b] [text-shadow:0_0_16px_rgba(244,204,92,0.28)] sm:text-3xl">
                    {winningCode}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="relative z-10 w-full overflow-hidden rounded-xl border border-[#fff0b2] bg-gradient-to-b from-[#ffe9a0] via-[#d9b354] to-[#a47723] px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-[#211704] shadow-[0_8px_22px_rgba(0,0,0,0.32)] transition hover:brightness-110 active:scale-[0.99] sm:text-base"
              >
                Selesai & Tutup ({countdown} Detik)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}