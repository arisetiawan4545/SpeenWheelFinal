"use client";

import React from "react";
import { Play } from "lucide-react";

interface Slot {
  id: string;
  name: string;
  color?: string;
  imageUrl?: string;
}

interface SpinWheelPreviewProps {
  slots: Slot[];
  tvBackgroundUrl?: string;
}

const PREMIUM_COLORS = [
  "#172033",
  "#7b1e2b",
  "#174b4b",
  "#47316c",
  "#8c5b17",
  "#263b66",
];

export default function SpinWheelPreview({
  slots,
  tvBackgroundUrl,
}: SpinWheelPreviewProps) {
  if (!slots || slots.length === 0) {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex h-64 w-64 items-center justify-center rounded-full border-8 border-slate-700 bg-slate-800">
          <span className="font-bold text-slate-500">Belum ada Slot</span>
        </div>
      </div>
    );
  }

  const numSlots = slots.length;
  const sliceAngle = numSlots > 1 ? 360 / numSlots : 360;

  const renderLights = () => {
    const lights = [];
    const numLights = 36;
    for (let i = 0; i < numLights; i++) {
      const angle = (i * 360) / numLights - 90;
      const radians = (angle * Math.PI) / 180;
      lights.push(
        <div
          key={i}
          className="absolute z-30 h-1.5 w-1.5 rounded-full md:h-2.5 md:w-2.5"
          style={{
            top: `${50 + Math.sin(radians) * 47.2}%`,
            left: `${50 + Math.cos(radians) * 47.2}%`,
            transform: "translate(-50%, -50%)",
            animation: "chasing-lights 1.5s infinite",
            animationDelay: `${i * 0.05}s`,
            backgroundColor: "#fde68a",
          }}
        />
      );
    }
    return lights;
  };

  return (
    <div className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-4 border-slate-800 shadow-2xl">
      <style jsx>{`
        @keyframes premium-wheel-glow {
          0%,
          100% {
            opacity: 0.58;
            transform: scale(0.985);
          }
          50% {
            opacity: 0.92;
            transform: scale(1.015);
          }
        }
        @keyframes premium-sheen {
          0% {
            transform: translateX(-150%) rotate(18deg);
          }
          55%,
          100% {
            transform: translateX(190%) rotate(18deg);
          }
        }
        @keyframes heartbeat {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.08);
          }
        }
        @keyframes chasing-lights {
          0%,
          100% {
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
          animation: heartbeat 2s ease-in-out infinite;
        }
      `}</style>

      {/* 1. Latar Belakang TV */}
      {tvBackgroundUrl ? (
        <img
          src={tvBackgroundUrl}
          alt="TV Background Preview"
          className="absolute inset-0 z-0 h-full w-full object-cover opacity-90"
        />
      ) : (
        <div className="absolute inset-0 z-0 h-full w-full bg-[#0a0d14]" />
      )}
      <div className="absolute inset-0 z-10 bg-black/30 backdrop-blur-[2px]" />

      {/* Label Keterangan Kiri Atas */}
      <div className="absolute left-4 top-4 z-50 rounded-lg border border-white/10 bg-black/50 px-3 py-1 backdrop-blur-md">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500"></span>{" "}
          Preview TV Monitor
        </span>
      </div>

      {/* 2. Komponen Roda */}
      <div className="relative z-20 mx-auto flex aspect-square w-full max-w-[480px] shrink-0 select-none items-center justify-center p-4">
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
          <div className="relative z-10 flex h-6 w-10 items-center justify-center rounded-t-lg border border-[#fff0ac] bg-gradient-to-b from-[#fff3b8] via-[#d8ad4c] to-[#765016] shadow-[0_0_18px_rgba(255,206,85,0.55)] sm:h-8 sm:w-12">
            <div className="h-1.5 w-4 rounded-full bg-white/70 blur-[1px]" />
          </div>
          <div className="-mt-1 h-0 w-0 border-l-[14px] border-r-[14px] border-t-[26px] border-l-transparent border-r-transparent border-t-[#f5d36f] sm:border-l-[17px] sm:border-r-[17px] sm:border-t-[32px]" />
          <div className="-mt-[24px] h-0 w-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-[#8b1c25] sm:-mt-[30px] sm:border-l-[10px] sm:border-r-[10px] sm:border-t-[20px]" />
        </div>

        {/* Perimeter lights */}
        <div className="pointer-events-none absolute inset-0 z-40 rounded-full">
          {renderLights()}
        </div>

        {/* Main wheel SVG */}
        <div className="absolute inset-[7.8%] z-10 overflow-hidden rounded-full border-[3px] border-[#f2d47d] bg-[#101521] shadow-[0_0_0_5px_rgba(16,16,18,0.96),0_0_0_7px_rgba(225,187,83,0.7),inset_0_0_35px_rgba(0,0,0,0.9)]">
          <div className="h-full w-full">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full -rotate-90"
              role="img"
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
                      patternTransform="rotate(90 50 50)" // <-- KUNCI KALIBRASI AGAR TEGAK LURUS 1:1 DENGAN KANVAS
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
                const fill = slot.imageUrl
                  ? `url(#img-${slot.id})`
                  : slot.color || PREMIUM_COLORS[index % PREMIUM_COLORS.length];

                const startAngle = index * sliceAngle;
                const endAngle = startAngle + sliceAngle;
                const midAngle = startAngle + sliceAngle / 2;

                const textRadius = 31;
                const textX =
                  50 + textRadius * Math.cos((Math.PI * midAngle) / 180);
                const textY =
                  50 + textRadius * Math.sin((Math.PI * midAngle) / 180);
                const displayLabel =
                  slot.name.length > 15
                    ? `${slot.name.slice(0, 14)}…`
                    : slot.name;

                const studRadius = 46.8;
                const studX =
                  50 + studRadius * Math.cos((Math.PI * startAngle) / 180);
                const studY =
                  50 + studRadius * Math.sin((Math.PI * startAngle) / 180);

                if (numSlots === 1) {
                  return (
                    <g key={slot.id}>
                      <circle
                        cx="50"
                        cy="50"
                        r="50"
                        fill={fill}
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="0.5"
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
                  <g key={slot.id}>
                    <path
                      d={pathData}
                      fill={fill}
                      stroke="rgba(255,239,190,0.72)"
                      strokeWidth="0.42"
                    />
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
                        style={{ textShadow: "0px 1px 3px rgba(0,0,0,0.95)" }}
                      >
                        {displayLabel}
                      </text>
                    )}
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
          disabled
          className="heartbeat-btn group absolute left-1/2 top-1/2 z-[70] flex aspect-square w-[16.5%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#fff0b0] bg-[radial-gradient(circle_at_32%_20%,#5c6575_0%,#202838_35%,#090d16_78%)] p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.75),0_0_0_4px_rgba(15,17,22,0.95),0_0_0_6px_rgba(220,177,72,0.95),0_0_28px_rgba(246,201,89,0.38)]"
        >
          <span className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-b from-[#bd2734] via-[#8f1525] to-[#3e0b16] text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-7px_12px_rgba(0,0,0,0.42)]">
            <span className="premium-sheen pointer-events-none absolute -inset-y-8 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <span className="relative mb-0.5 flex items-center justify-center rounded-full border border-amber-100/50 bg-black/15 p-1 shadow-inner">
              <Play className="ml-0.5 h-3 w-3 fill-amber-100 text-amber-100" />
            </span>
            <span className="relative text-[clamp(8px,1.5vw,14px)] font-black uppercase leading-none tracking-[0.16em] text-[#fff2c4] drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
              SPIN
            </span>
            <span className="relative mt-0.5 text-[clamp(4px,0.5vw,6px)] font-bold uppercase tracking-[0.15em] text-white/65">
              Lucky Wheel
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}