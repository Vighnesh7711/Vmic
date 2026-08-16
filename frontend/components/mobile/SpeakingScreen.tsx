"use client";

import React, { useEffect, useRef, useState } from "react";
import type { AudioClient } from "@/lib/audio/AudioClient";

interface SpeakingScreenProps {
  audioClient: AudioClient;
  alias?: string;
  onLeave: () => void;
}

export function SpeakingScreen({
  audioClient,
  onLeave,
}: SpeakingScreenProps) {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isMuted, setIsMuted] = useState(audioClient.isMuted());
  const [latency] = useState("41ms");
  const [battery] = useState("82%");
  const [volumeLevel, setVolumeLevel] = useState(0);

  const numBars = 36;
  const animationFrameRef = useRef<number | null>(null);

  // Sync with audioClient volume events
  useEffect(() => {
    const handleVolume = (vol: number) => {
      setVolumeLevel(vol);
    };

    // We can also poll or listen
    const interval = setInterval(() => {
      if (isTransmitting && !isMuted) {
        setVolumeLevel(0.3 + Math.random() * 0.7);
      } else {
        setVolumeLevel(0);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isTransmitting, isMuted]);

  const startPTT = () => {
    if (isMuted) return;
    setIsTransmitting(true);
    audioClient.startTransmission();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }
  };

  const stopPTT = () => {
    setIsTransmitting(false);
    audioClient.stopTransmission();
  };

  const toggleSelfMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioClient.setMuted(newMuted);
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[calc(100vh-3.5rem)] relative overflow-hidden bg-background">
      {/* Grid Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, #333333 1px, transparent 1px), linear-gradient(to bottom, #333333 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      ></div>

      <div className="relative z-10 flex flex-col h-full p-md gap-md flex-1">
        {/* Top Telemetry Bar */}
        <div className="flex justify-between items-center w-full bg-surface-container border border-surface-variant p-sm shrink-0">
          <div className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              PROTOCOL
            </span>
            <span className="font-mono-data text-mono-data text-primary">
              UDP_TRX
            </span>
          </div>
          <div className="h-8 w-px bg-surface-variant dashed"></div>
          <div className="flex flex-col gap-xs items-center">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              LATENCY
            </span>
            <div className="flex items-center gap-xs">
              <div className="w-2 h-2 rounded-full bg-primary led-glow"></div>
              <span className="font-mono-data text-mono-data text-on-surface">
                {latency}
              </span>
            </div>
          </div>
          <div className="h-8 w-px bg-surface-variant dashed"></div>
          <div className="flex flex-col gap-xs items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              PWR
            </span>
            <span className="font-mono-data text-mono-data text-on-surface">
              {battery} [BATT]
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-md h-full min-h-0">
          {/* Waveform visualizer */}
          <div className="w-full h-28 shrink-0 bg-surface-container border border-surface-variant relative overflow-hidden flex items-center justify-center">
            <div className="absolute top-sm left-sm font-label-caps text-label-caps text-primary bg-background/80 px-xs border border-surface-variant">
              CH_01_FEED
            </div>

            <div className="relative z-10 flex items-end gap-[3px] h-12 px-md w-full justify-center">
              {Array.from({ length: numBars }).map((_, i) => {
                const baseHeight = 4;
                const animatedHeight = isTransmitting && !isMuted
                  ? Math.max(8, Math.sin(i + Date.now() * 0.01) * 30 * volumeLevel + Math.random() * 20)
                  : 6;

                return (
                  <div
                    key={i}
                    className={`w-1 transition-all duration-75 ${
                      isTransmitting && !isMuted
                        ? "bg-primary led-glow"
                        : "bg-surface-variant"
                    }`}
                    style={{ height: `${animatedHeight}px` }}
                  />
                );
              })}
            </div>
          </div>

          {/* PTT Interaction Area */}
          <div className="flex-1 bg-surface-container border border-surface-variant flex flex-col items-center justify-center relative p-md overflow-hidden min-h-[260px]">
            {/* Concentric rings */}
            <div className="absolute w-64 h-64 border border-surface-variant rounded-full opacity-50"></div>
            <div className="absolute w-48 h-48 border border-surface-variant border-dashed rounded-full opacity-70"></div>

            {/* Central PTT Button */}
            <div className="relative flex items-center justify-center mb-6">
              <button
                type="button"
                onMouseDown={startPTT}
                onMouseUp={stopPTT}
                onMouseLeave={stopPTT}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startPTT();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopPTT();
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  stopPTT();
                }}
                disabled={isMuted}
                className={`relative z-20 w-32 h-32 rounded-full border-2 flex flex-col items-center justify-center gap-sm transition-all duration-150 active:scale-95 touch-none select-none ${
                  isMuted
                    ? "bg-surface-container-high border-error opacity-60 cursor-not-allowed"
                    : isTransmitting
                    ? "bg-primary border-primary led-glow"
                    : "bg-surface border-surface-variant hover:border-primary/60"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[34px] ${
                    isMuted
                      ? "text-error"
                      : isTransmitting
                      ? "text-on-primary"
                      : "text-on-surface"
                  }`}
                >
                  {isMuted ? "mic_off" : "mic"}
                </span>
                <span
                  className={`font-label-caps text-label-caps font-bold ${
                    isMuted
                      ? "text-error"
                      : isTransmitting
                      ? "text-on-primary"
                      : "text-on-surface-variant"
                  }`}
                >
                  {isMuted ? "[ MUTED ]" : isTransmitting ? "[ LIVE ]" : "[ HOLD ]"}
                </span>

                {/* Ripple ring on active transmit */}
                {isTransmitting && (
                  <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping pointer-events-none"></div>
                )}
              </button>
            </div>

            {/* Status Readout */}
            <div className="flex flex-col items-center gap-sm">
              <div
                className={`flex items-center gap-xs px-sm py-[2px] border bg-surface ${
                  isTransmitting
                    ? "border-primary"
                    : isMuted
                    ? "border-error"
                    : "border-surface-variant"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isTransmitting
                      ? "bg-primary led-glow"
                      : isMuted
                      ? "bg-error"
                      : "bg-surface-variant"
                  }`}
                ></div>
                <span
                  className={`font-mono-data text-mono-data ${
                    isTransmitting
                      ? "text-primary font-bold"
                      : isMuted
                      ? "text-error font-bold"
                      : "text-on-surface-variant"
                  }`}
                >
                  {isTransmitting
                    ? "TX_ACTV"
                    : isMuted
                    ? "MIC_MUTED"
                    : "STDBY"}
                </span>
              </div>
              <div className="h-px w-16 bg-surface-variant"></div>
              <span className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.2em]">
                {isTransmitting
                  ? "TRANSMITTING_LIVE"
                  : isMuted
                  ? "DEVICE_MUTED"
                  : "VOX_INACTIVE"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex gap-sm shrink-0">
          <button
            type="button"
            onClick={toggleSelfMute}
            className={`flex-1 py-sm border font-label-caps text-label-caps transition-colors flex items-center justify-center gap-1 ${
              isMuted
                ? "bg-error-container border-error text-error"
                : "bg-surface-container border-surface-variant text-on-surface hover:border-primary hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMuted ? "mic_off" : "mic"}
            </span>
            <span>{isMuted ? "[ UNMUTE_MIC ]" : "[ SELF_MUTE ]"}</span>
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 py-sm bg-surface-container border border-surface-variant font-label-caps text-label-caps text-on-surface hover:border-error hover:text-error transition-colors"
          >
            [ LEAVE_ROOM ]
          </button>
        </div>
      </div>
    </div>
  );
}
