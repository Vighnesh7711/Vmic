"use client";

import React from "react";

interface LeaveScreenProps {
  roomCode: string;
  alias: string;
  onConfirmLeave: () => void;
  onCancel: () => void;
}

export function LeaveScreen({
  roomCode,
  alias,
  onConfirmLeave,
  onCancel,
}: LeaveScreenProps) {
  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-error font-headline-md uppercase tracking-wider">
          Leave Room
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse shadow-[0_0_4px_#ffb4ab]"></span>
          <span className="text-label-caps text-error font-label-caps">
            CONFIRM EXIT
          </span>
        </div>
      </div>

      {/* Warning Box */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-error"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-error"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-error"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-error"></div>

        <div className="w-20 h-20 rounded-full bg-surface border-2 border-error flex items-center justify-center mb-4 z-10 shadow-[0_0_12px_rgba(255,180,171,0.2)]">
          <span className="material-symbols-outlined text-[36px] text-error">
            logout
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          TERMINATE NODE SESSION
        </span>
        <p className="text-mono-data text-on-surface-variant text-body-sm z-10 max-w-xs">
          Leaving will release your audio buffer and disconnect this node ({alias}) from room {roomCode}.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={onConfirmLeave}
          className="w-full bg-error text-surface font-label-caps text-label-caps py-4 border border-error hover:bg-error-container transition-colors flex items-center justify-center space-x-2 font-bold"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>[ CONFIRM &amp; DISCONNECT ]</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-4 bg-surface-container border border-outline text-on-surface font-label-caps text-label-caps hover:border-primary hover:text-primary transition-colors flex items-center justify-center space-x-2"
        >
          <span>[ CANCEL &amp; RETURN TO ROOM ]</span>
        </button>
      </div>
    </div>
  );
}
