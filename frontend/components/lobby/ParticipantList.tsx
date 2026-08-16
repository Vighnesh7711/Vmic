"use client";

import React, { useState } from "react";
import type { Participant } from "@/lib/types";
import { ParticipantState } from "@/lib/constants";
import type { ParticipantAudioTelemetry } from "@/lib/audio/types";

export interface RequestToSpeakEntry {
  participantId: string;
  displayName: string;
  requestedAt: number;
}

interface ParticipantListProps {
  maxParticipants?: number;
  participants?: Participant[];
  audioTelemetry?: Record<string, ParticipantAudioTelemetry>;
  requestQueue?: RequestToSpeakEntry[];
  sessionStarted?: boolean;
  onVolumeChange?: (id: string, volume: number) => void;
  onToggleMute?: (id: string, currentMuted: boolean) => void;
  onGrantFloor?: (id: string) => void;
  onReleaseFloor?: (id: string) => void;
  onStartSession?: () => void;
  onEndSession?: () => void;
}

export function ParticipantList({
  maxParticipants = 20,
  participants = [],
  audioTelemetry = {},
  requestQueue = [],
  sessionStarted = false,
  onVolumeChange = () => {},
  onToggleMute = () => {},
  onGrantFloor = () => {},
  onReleaseFloor = () => {},
  onStartSession = () => {},
  onEndSession = () => {},
}: ParticipantListProps) {
  const [testAudioActive, setTestAudioActive] = useState(false);

  const activeConnectedCount = participants.filter(
    (p) => p.state === ParticipantState.Active
  ).length;

  return (
    <div className="col-span-12 lg:col-span-7 flex flex-col gap-md h-[calc(100vh-280px)] min-h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant pb-xs">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            group
          </span>
          <span className="text-label-caps font-label-caps text-on-surface uppercase">
            PARTICIPANTS {sessionStarted ? "LIVE" : "JOINING"}
          </span>
        </div>
        <div className="flex items-center gap-sm bg-surface p-1 px-2 border border-outline-variant">
          <div className="w-2 h-2 rounded-full bg-primary relative">
            <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
          </div>
          <span className="font-mono-data text-primary">
            {activeConnectedCount} / {maxParticipants} DEVICES CONNECTED
          </span>
        </div>
      </div>

      {/* Request-to-Speak Queue Banner if any */}
      {requestQueue.length > 0 && (
        <div className="bg-surface-container-high border border-tertiary-fixed-dim/50 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary-fixed-dim text-[18px] animate-pulse">
              front_hand
            </span>
            <span className="font-label-caps text-[11px] text-tertiary-fixed-dim uppercase">
              FLOOR QUEUE ({requestQueue.length}):
            </span>
            <span className="font-mono-data text-[12px] text-on-surface">
              {requestQueue.map((q) => q.displayName).join(", ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onGrantFloor(requestQueue[0].participantId)}
            className="px-2 py-0.5 bg-tertiary-fixed-dim text-surface font-label-caps text-[10px] uppercase font-bold hover:bg-tertiary transition-colors"
          >
            [ GRANT NEXT ]
          </button>
        </div>
      )}

      {/* List of Participants */}
      <div className="flex-1 overflow-y-auto pr-sm flex flex-col gap-unit custom-scrollbar">
        {participants.length === 0 ? (
          <div className="flex items-center justify-center p-md border border-outline-variant border-dashed bg-surface/30">
            <span className="font-mono-data text-[12px] text-on-surface-variant uppercase tracking-wider">
              Awaiting node connections...
            </span>
          </div>
        ) : (
          participants.map((p) => {
            const isJoining = p.state === ParticipantState.Joining;
            const isBluetooth = p.networkInfo?.transportType === "bluetooth";
            const telemetry = audioTelemetry[p.id] || {
              volume: 1.0,
              isMuted: false,
              audioLevel: 0.0,
              isSpeaking: false,
            };

            const hasFloor = p.role === "host" || Boolean(p.hasFloor);
            const isQueued = requestQueue.some((q) => q.participantId === p.id);

            if (isJoining) {
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-sm border border-outline-variant border-dashed bg-surface/50 opacity-70 group"
                >
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 border border-outline-variant border-dashed bg-surface flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px] animate-spin-slow">
                        sync
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-body-sm text-on-surface font-bold">
                        {p.displayName}
                      </span>
                      <div className="flex items-center gap-xs mt-0.5">
                        <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
                          wifi
                        </span>
                        <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                          {p.networkInfo?.detail || "Negotiating..."}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-md">
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] text-tertiary-fixed-dim uppercase tracking-wider animate-pulse">
                        Connecting
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {p.networkInfo?.signal || "DHCP Req"}
                      </span>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-tertiary-fixed-dim shadow-[0_0_6px_#ffb866] border border-surface"></div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={p.id}
                className={`flex flex-col p-sm border border-outline-variant bg-surface-container-low transition-colors group ${
                  telemetry.isSpeaking
                    ? "border-primary led-glow"
                    : isBluetooth
                    ? "hover:border-secondary-container/50"
                    : "hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <div
                      className={`w-10 h-10 border border-outline-variant bg-surface flex items-center justify-center transition-colors ${
                        telemetry.isSpeaking
                          ? "border-primary text-primary"
                          : isBluetooth
                          ? "group-hover:border-secondary-container text-secondary-container"
                          : "group-hover:border-primary text-on-surface-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {telemetry.isSpeaking
                          ? "record_voice_over"
                          : isBluetooth
                          ? "bluetooth"
                          : "person"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm text-on-surface font-bold">
                          {p.displayName}
                        </span>
                        {p.role === "host" && (
                          <span className="text-[9px] bg-primary/20 text-primary px-1 border border-primary uppercase font-mono">
                            HOST
                          </span>
                        )}
                        {telemetry.isSpeaking && (
                          <span className="text-[9px] bg-primary text-surface font-bold px-1 uppercase animate-pulse">
                            SPEAKING
                          </span>
                        )}
                        {isQueued && (
                          <span className="text-[9px] bg-tertiary-fixed-dim text-surface font-bold px-1 uppercase">
                            QUEUED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-xs mt-0.5">
                        <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
                          {isBluetooth ? "bluetooth" : "wifi"}
                        </span>
                        <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                          {p.networkInfo?.detail || "Wi-Fi (802.11ac)"}
                        </span>
                        <span className="text-[11px] text-on-surface-variant mx-1">
                          |
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          {p.networkInfo?.signal || "-42dBm"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Mute */}
                  <div className="flex items-center gap-sm">
                    {/* Floor control */}
                    {p.role !== "host" && (
                      <button
                        type="button"
                        onClick={() =>
                          hasFloor ? onReleaseFloor(p.id) : onGrantFloor(p.id)
                        }
                        className={`px-2 py-1 border font-label-caps text-[10px] uppercase transition-colors ${
                          hasFloor
                            ? "border-primary text-primary bg-primary/10"
                            : "border-outline-variant text-on-surface-variant hover:border-primary"
                        }`}
                      >
                        {hasFloor ? "[ FLOOR ACTIVE ]" : "[ GRANT FLOOR ]"}
                      </button>
                    )}

                    {/* Mute toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleMute(p.id, telemetry.isMuted)}
                      className={`p-1 border transition-colors ${
                        telemetry.isMuted
                          ? "border-error text-error bg-error-container/20"
                          : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
                      }`}
                      title={telemetry.isMuted ? "Unmute node" : "Mute node"}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {telemetry.isMuted ? "mic_off" : "mic"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Live VU Meter & Volume Slider Bar */}
                <div className="flex items-center gap-md mt-2 pt-2 border-t border-outline-variant/30">
                  {/* Real VU Meter */}
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[10px] font-mono-data text-on-surface-variant">
                      VU
                    </span>
                    <div className="flex-1 h-1.5 bg-surface-container-high border border-outline-variant/50 relative overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 ${
                          telemetry.isMuted
                            ? "bg-transparent"
                            : telemetry.isSpeaking
                            ? "bg-primary led-glow"
                            : "bg-primary/50"
                        }`}
                        style={{
                          width: `${Math.round(telemetry.audioLevel * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 w-32">
                    <span className="text-[10px] font-mono-data text-on-surface-variant">
                      VOL
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={telemetry.volume}
                      onChange={(e) =>
                        onVolumeChange(p.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-full h-1 bg-surface-container-high appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <span className="text-[10px] font-mono text-primary w-6 text-right">
                      {Math.round(telemetry.volume * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Listening Slot */}
        <div className="flex items-center justify-center p-sm border border-outline-variant border-dashed bg-transparent mt-sm">
          <span className="text-[11px] text-on-surface-variant uppercase tracking-widest">
            Listening on Port 50051...
          </span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t border-outline-variant pt-md mt-auto">
        <button
          type="button"
          onClick={() => setTestAudioActive((prev) => !prev)}
          className={`px-md py-sm border transition-colors flex items-center gap-sm ${
            testAudioActive
              ? "border-primary text-primary bg-primary/10"
              : "border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-on-surface-variant"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            graphic_eq
          </span>
          <span className="text-label-caps uppercase">
            {testAudioActive ? "[ AUDIO TEST: ACTIVE ]" : "[ TEST AUDIO ]"}
          </span>
        </button>

        {sessionStarted ? (
          <button
            type="button"
            onClick={onEndSession}
            className="px-lg py-sm bg-error text-surface border border-error hover:bg-error-container transition-colors flex items-center gap-sm font-bold shadow-[0_0_15px_rgba(255,180,171,0.2)]"
          >
            <span className="material-symbols-outlined text-[18px]">
              stop_circle
            </span>
            <span className="text-label-caps font-bold uppercase">
              [ END SESSION ]
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartSession}
            className="px-lg py-sm bg-primary text-on-primary border border-primary hover:bg-primary-container transition-colors flex items-center gap-sm shadow-[0_0_15px_rgba(0,230,118,0.2)] font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">
              play_arrow
            </span>
            <span className="text-label-caps font-bold uppercase">
              [ START SESSION ]
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
