"use client";

import React, { useState } from "react";

interface PermissionScreenProps {
  onGrantPermission: () => Promise<void>;
  onCancel?: () => void;
}

export function PermissionScreen({
  onGrantPermission,
  onCancel,
}: PermissionScreenProps) {
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGrant = async () => {
    try {
      setRequesting(true);
      setErrorMessage(null);
      await onGrantPermission();
    } catch (err: unknown) {
      setRequesting(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Microphone access was denied. Please allow microphone permissions in your browser."
      );
    }
  };

  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-primary font-headline-md uppercase tracking-wider">
          Mic Authorization
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse shadow-[0_0_4px_#ffb866]"></span>
          <span className="text-label-caps text-on-surface-variant font-label-caps">
            AUTH REQUIRED
          </span>
        </div>
      </div>

      {/* Center Target Box */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-6 text-center group overflow-hidden">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-primary"></div>

        {/* Concentric rings */}
        <div className="absolute w-44 h-44 border border-surface-variant rounded-full opacity-50"></div>
        <div className="absolute w-32 h-32 border border-surface-variant border-dashed rounded-full opacity-70"></div>

        <div className="w-20 h-20 rounded-full bg-surface border-2 border-primary flex items-center justify-center mb-4 z-10 led-glow">
          <span className="material-symbols-outlined text-[36px] text-primary">
            mic
          </span>
        </div>

        <span className="text-headline-sm font-headline-sm text-on-surface z-10 mb-1">
          LOCAL MIC CAPTURE
        </span>
        <p className="text-mono-data text-on-surface-variant text-body-sm z-10 max-w-xs">
          VoxMesh turns your phone into a low-latency classroom mic over local Wi-Fi. No audio is ever sent to the cloud.
        </p>
      </div>

      {/* DSP & Privacy Telemetry Box */}
      <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4 font-mono-data text-[12px]">
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">DSP ENGINE</span>
          <span className="text-primary">AEC + NOISE_SUPPRESSION</span>
        </div>
        <div className="flex justify-between border-b border-surface-variant pb-1">
          <span className="text-on-surface-variant">SAMPLE RATE</span>
          <span className="text-on-surface">48 kHz / 16-bit Float</span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">SECURITY</span>
          <span className="text-secondary">WPA3 Local Direct Only</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 border border-error bg-error-container/20 text-error font-mono-data text-[12px]">
          [DENIED]: {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={handleGrant}
          disabled={requesting}
          className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined">verified_user</span>
          <span>{requesting ? "[ INITIALIZING MIC... ]" : "[ GRANT MIC PERMISSION ]"}</span>
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 font-label-caps text-on-surface-variant hover:text-on-surface text-[11px] uppercase transition-colors"
          >
            [ CANCEL AND RETURN ]
          </button>
        )}
      </div>
    </div>
  );
}
