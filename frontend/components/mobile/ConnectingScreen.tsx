"use client";

import React, { useEffect, useState } from "react";

interface ConnectingScreenProps {
  roomCode: string;
  alias: string;
  onConnected: () => void;
}

export function ConnectingScreen({
  roomCode,
  alias,
  onConnected,
}: ConnectingScreenProps) {
  const [step, setStep] = useState(0);

  const steps = [
    `DISCOVERY: Locating Mesh Host [${roomCode}]...`,
    "HANDSHAKE_INIT: Sending local node descriptor...",
    "HANDSHAKE_ACK: Host verified. Negotiating ICE routes...",
    "AUDIO_ROUTE: Allocating local UDP_TRX buffer...",
    "PEER_LOCKED: Connected to VoxMesh local mesh.",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(onConnected, 600);
          return prev;
        }
      });
    }, 700);

    return () => clearInterval(timer);
  }, [onConnected, steps.length]);

  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-primary font-headline-md uppercase tracking-wider">
          Mesh Link
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse shadow-[0_0_4px_#ffb866]"></span>
          <span className="text-label-caps text-tertiary-fixed-dim font-label-caps">
            NEGOTIATING
          </span>
        </div>
      </div>

      {/* Animation Center */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-primary"></div>

        {/* Concentric rings */}
        <div className="absolute w-52 h-52 border border-surface-variant rounded-full opacity-30 animate-ping"></div>
        <div className="absolute w-36 h-36 border border-primary/40 border-dashed rounded-full animate-spin-slow"></div>

        <div className="w-16 h-16 rounded-full bg-surface border border-primary flex items-center justify-center mb-4 z-10">
          <span className="material-symbols-outlined text-[32px] text-primary animate-spin">
            sync
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          CONNECTING TO MESH
        </span>
        <span className="text-mono-data text-primary uppercase font-bold tracking-widest text-[12px] z-10">
          ROOM: {roomCode} | NODE: {alias}
        </span>
      </div>

      {/* Step Log Box */}
      <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4 font-mono-data text-[12px]">
        <div className="text-label-caps text-on-surface-variant pb-1 border-b border-surface-variant">
          HANDSHAKE_TELEMETRY
        </div>
        {steps.map((s, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 transition-opacity ${
              idx <= step ? "opacity-100" : "opacity-20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                idx < step
                  ? "bg-primary"
                  : idx === step
                  ? "bg-tertiary-fixed-dim animate-pulse"
                  : "bg-surface-variant"
              }`}
            ></span>
            <span className={idx === step ? "text-primary font-bold" : "text-on-surface-variant"}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
