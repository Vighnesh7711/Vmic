"use client";

import React from "react";

interface WaitingFloorScreenProps {
  currentSpeaker?: string;
  queuePosition?: number;
  onRequestFloor: () => void;
  onLeave: () => void;
}

export function WaitingFloorScreen({
  currentSpeaker = "CMD_LEAD (Host)",
  queuePosition = 2,
  onRequestFloor,
  onLeave,
}: WaitingFloorScreenProps) {
  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-tertiary-fixed-dim font-headline-md uppercase tracking-wider">
          Floor Controlled
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse shadow-[0_0_4px_#ffb866]"></span>
          <span className="text-label-caps text-tertiary-fixed-dim font-label-caps">
            FLOOR_LOCKED
          </span>
        </div>
      </div>

      {/* Central Queue Status Box */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-tertiary-fixed-dim"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-tertiary-fixed-dim"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-tertiary-fixed-dim"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-tertiary-fixed-dim"></div>

        <div className="w-20 h-20 rounded-full bg-surface border-2 border-tertiary-fixed-dim flex items-center justify-center mb-4 z-10 shadow-[0_0_12px_rgba(255,184,102,0.2)]">
          <span className="material-symbols-outlined text-[36px] text-tertiary-fixed-dim">
            lock
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          SPEAKER ON STAGE
        </span>
        <span className="font-mono-data text-primary text-[13px] z-10 font-bold">
          {currentSpeaker}
        </span>
      </div>

      {/* Queue Details Box */}
      <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4 font-mono-data text-[12px]">
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">FLOOR PROTOCOL</span>
          <span className="text-tertiary-fixed-dim">MODERATED_EXCLUSIVE</span>
        </div>
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">YOUR QUEUE SLOT</span>
          <span className="text-on-surface font-bold">POSITION #{queuePosition}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">HOST PERMISSION</span>
          <span className="text-on-surface-variant">REQUIRED BEFORE TX</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onRequestFloor}
          className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2"
        >
          <span className="material-symbols-outlined">front_hand</span>
          <span>[ RAISE HAND / REQUEST FLOOR ]</span>
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
