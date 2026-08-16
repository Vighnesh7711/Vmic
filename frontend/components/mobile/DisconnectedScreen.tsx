"use client";

import React from "react";

interface DisconnectedScreenProps {
  reason?: string;
  onReconnect: () => void;
  onNewSession: () => void;
}

export function DisconnectedScreen({
  reason = "PEER_DISCONNECTED_OR_HOST_CLOSED",
  onReconnect,
  onNewSession,
}: DisconnectedScreenProps) {
  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-error font-headline-md uppercase tracking-wider">
          Link Dropped
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_4px_#ffb4ab]"></span>
          <span className="text-label-caps text-error font-label-caps">
            DISCONNECTED
          </span>
        </div>
      </div>

      {/* Center Target Box */}
      <div className="relative w-full aspect-square border border-error/50 bg-surface-container-low flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-error"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-error"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-error"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-error"></div>

        <div className="w-20 h-20 rounded-full bg-surface border-2 border-error flex items-center justify-center mb-4 z-10 shadow-[0_0_12px_rgba(255,180,171,0.2)]">
          <span className="material-symbols-outlined text-[36px] text-error">
            wifi_off
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          LOCAL MESH LOST
        </span>
        <p className="text-mono-data text-on-surface-variant text-body-sm z-10 max-w-xs">
          The wireless audio connection to the host was interrupted.
        </p>
      </div>

      {/* Diagnostics Box */}
      <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4 font-mono-data text-[12px]">
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">DROP REASON</span>
          <span className="text-error uppercase">{reason}</span>
        </div>
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">AUDIO BUFFER</span>
          <span className="text-on-surface">FLUSHED & MUTED</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">GATEWAY PING</span>
          <span className="text-error">UNREACHABLE</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onReconnect}
          className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2"
        >
          <span className="material-symbols-outlined">refresh</span>
          <span>[ ATTEMPT RECONNECT ]</span>
        </button>

        <button
          type="button"
          onClick={onNewSession}
          className="w-full py-4 bg-surface-container border border-outline text-on-surface font-label-caps text-label-caps hover:border-primary hover:text-primary transition-colors flex items-center justify-center space-x-2"
        >
          <span>[ JOIN ANOTHER ROOM ]</span>
        </button>
      </div>
    </div>
  );
}
