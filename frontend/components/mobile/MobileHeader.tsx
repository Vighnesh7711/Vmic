"use client";

import React from "react";

interface MobileHeaderProps {
  statusLabel?: string;
  statusType?: "live" | "sync" | "offl";
  onLeaveClick?: () => void;
}

export function MobileHeader({
  statusLabel = "LIVE",
  statusType = "live",
  onLeaveClick,
}: MobileHeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-variant">
      <div className="h-14 px-md flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">terminal</span>
          <span className="font-headline-sm text-headline-sm tracking-tight uppercase">
            VoxMesh
          </span>
        </div>

        <div className="flex items-center gap-md">
          <div className="flex items-center gap-xs px-sm py-1 bg-surface-container rounded-full border border-surface-variant">
            <div
              className={`w-2 h-2 rounded-full ${
                statusType === "live"
                  ? "bg-primary led-glow animate-pulse"
                  : statusType === "sync"
                  ? "bg-tertiary-fixed-dim shadow-[0_0_8px_#ffb866] animate-pulse"
                  : "bg-surface-variant"
              }`}
            ></div>
            <span
              className={`font-label-caps text-label-caps ${
                statusType === "live"
                  ? "text-primary"
                  : statusType === "sync"
                  ? "text-tertiary-fixed-dim"
                  : "text-on-surface-variant"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {onLeaveClick ? (
            <button
              onClick={onLeaveClick}
              className="px-2 py-1 border border-outline text-on-surface-variant font-label-caps text-[11px] hover:border-error hover:text-error transition-colors"
              title="Leave Room"
            >
              [ EXIT ]
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">
                person
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
