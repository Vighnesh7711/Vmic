"use client";

import React, { useEffect, useState } from "react";

interface RequestSpeakScreenProps {
  queuePosition?: number;
  onCancelRequest: () => void;
  onLeave: () => void;
}

export function RequestSpeakScreen({
  queuePosition = 1,
  onCancelRequest,
  onLeave,
}: RequestSpeakScreenProps) {
  const [secondsWaited, setSecondsWaited] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsWaited((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-tertiary-fixed-dim font-headline-md uppercase tracking-wider">
          Request Pending
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse shadow-[0_0_4px_#ffb866]"></span>
          <span className="text-label-caps text-tertiary-fixed-dim font-label-caps">
            HAND_RAISED
          </span>
        </div>
      </div>

      {/* Center Target Box */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-tertiary-fixed-dim"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-tertiary-fixed-dim"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-tertiary-fixed-dim"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-tertiary-fixed-dim"></div>

        {/* Concentric rings */}
        <div className="absolute w-44 h-44 border border-surface-variant rounded-full opacity-40 animate-ping"></div>

        <div className="w-20 h-20 rounded-full bg-surface border-2 border-tertiary-fixed-dim flex items-center justify-center mb-4 z-10 shadow-[0_0_12px_rgba(255,184,102,0.3)]">
          <span className="material-symbols-outlined text-[36px] text-tertiary-fixed-dim">
            front_hand
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          AWAITING HOST APPROVAL
        </span>
        <span className="font-mono-data text-on-surface-variant text-[13px] z-10">
          Queue Position: <strong className="text-primary">#{queuePosition}</strong>
        </span>
      </div>

      {/* Status Box */}
      <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4 font-mono-data text-[12px]">
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">REQUEST STATUS</span>
          <span className="text-tertiary-fixed-dim uppercase animate-pulse">
            NOTIFYING_HOST
          </span>
        </div>
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">ELAPSED TIME</span>
          <span className="text-on-surface">{formatTimer(secondsWaited)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">NEXT STEP</span>
          <span className="text-primary">Auto-switch to PTT on grant</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onCancelRequest}
          className="w-full py-4 bg-surface-container border border-outline text-on-surface font-label-caps text-label-caps hover:border-error hover:text-error transition-colors flex items-center justify-center space-x-2"
        >
          <span className="material-symbols-outlined">close</span>
          <span>[ WITHDRAW / LOWER HAND ]</span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className="w-full py-2 font-label-caps text-on-surface-variant hover:text-error text-[11px] uppercase transition-colors"
        >
          [ DISCONNECT / LEAVE ROOM ]
        </button>
      </div>
    </div>
  );
}
