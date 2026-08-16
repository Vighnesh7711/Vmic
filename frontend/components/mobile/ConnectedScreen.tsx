"use client";

import React from "react";

interface ConnectedScreenProps {
  roomCode: string;
  alias: string;
  speakingMode?: string;
  onEnterSpeaking: () => void;
  onRequestSpeak?: () => void;
  onLeave: () => void;
}

export function ConnectedScreen({
  roomCode,
  alias,
  speakingMode = "open_floor",
  onEnterSpeaking,
  onRequestSpeak,
  onLeave,
}: ConnectedScreenProps) {
  const isControlled = speakingMode === "controlled_floor";

  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-primary font-headline-md uppercase tracking-wider">
          Node Connected
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-primary led-glow animate-pulse"></span>
          <span className="text-label-caps text-primary font-label-caps">
            PEER_LOCKED
          </span>
        </div>
      </div>

      {/* Telemetry Bar */}
      <div className="flex justify-between items-center w-full bg-surface-container border border-surface-variant p-sm shrink-0">
        <div className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            PROTOCOL
          </span>
          <span className="font-mono-data text-mono-data text-primary">
            UDP_TRX
          </span>
        </div>
        <div className="h-8 w-px bg-surface-variant"></div>
        <div className="flex flex-col gap-xs items-center">
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            LATENCY
          </span>
          <div className="flex items-center gap-xs">
            <div className="w-2 h-2 rounded-full bg-primary led-glow"></div>
            <span className="font-mono-data text-mono-data text-on-surface">
              24ms
            </span>
          </div>
        </div>
        <div className="h-8 w-px bg-surface-variant"></div>
        <div className="flex flex-col gap-xs items-end">
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            SIGNAL
          </span>
          <span className="font-mono-data text-mono-data text-on-surface">
            -42dBm
          </span>
        </div>
      </div>

      {/* Central Node Card */}
      <div className="relative w-full border border-outline-variant bg-surface-container-low p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-surface-variant pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">sensors</span>
            <span className="font-label-caps text-on-surface uppercase">
              LOCAL MESH NODE
            </span>
          </div>
          <span className="font-mono-data text-[11px] text-primary bg-primary/10 px-2 py-0.5 border border-primary">
            {alias}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 font-mono-data text-[13px]">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase block">
              ROOM CODE
            </span>
            <span className="text-headline-sm text-primary font-bold">
              {roomCode}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase block">
              FLOOR MODE
            </span>
            <span className="text-body-sm text-on-surface uppercase font-bold">
              {isControlled ? "CONTROLLED" : "OPEN FLOOR"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase block">
              GATEWAY
            </span>
            <span className="text-body-sm text-on-surface">192.168.4.1</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase block">
              PEERS
            </span>
            <span className="text-body-sm text-primary">4 ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Action */}
      <div className="flex flex-col gap-3 pt-2">
        {isControlled ? (
          <button
            type="button"
            onClick={onRequestSpeak}
            className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2"
          >
            <span className="material-symbols-outlined">front_hand</span>
            <span>[ REQUEST TO SPEAK ]</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onEnterSpeaking}
            className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2"
          >
            <span className="material-symbols-outlined">mic</span>
            <span>[ ENTER LIVE PTT MIC ]</span>
          </button>
        )}

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
