"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api";
import type { AudioSettings, CreateSessionPayload } from "@/lib/types";

export function CreateSessionForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [sessionName, setSessionName] = useState("Classroom Discussion");
  const [roomLocation, setRoomLocation] = useState("A101");
  const [hostName, setHostName] = useState("Vighnesh");
  const [maxParticipants, setMaxParticipants] = useState(20);

  // Audio Settings State
  const [transport, setTransport] = useState<"auto" | "wifi" | "bluetooth">("auto");
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [defaultVolume, setDefaultVolume] = useState(80);

  const handleStepperChange = (delta: number) => {
    setMaxParticipants((prev) => Math.min(100, Math.max(2, prev + delta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim() || !roomLocation.trim() || !hostName.trim()) {
      setError("Please fill in all required session fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const audioSettings: AudioSettings = {
        transport,
        echoCancellation,
        noiseSuppression,
        defaultVolume,
      };

      const payload: CreateSessionPayload = {
        name: sessionName.trim(),
        room: roomLocation.trim(),
        hostName: hostName.trim(),
        maxParticipants,
        audioSettings,
        speakingMode: "open_floor",
      };

      const session = await createSession(payload);
      router.push(`/lobby/${session.id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create session");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto flex flex-col gap-lg mt-md">
      <div className="flex flex-col gap-xs mb-sm relative">
        <div className="absolute -left-md top-0 bottom-0 w-1 bg-primary/20"></div>
        <h1 className="font-display-lg text-primary tracking-widest uppercase">
          CREATE NEW SESSION
        </h1>
        <p className="font-mono-data text-on-surface-variant uppercase">
          Set up your audio room
        </p>
      </div>

      {error && (
        <div className="p-sm border border-error bg-error-container/20 text-error font-mono-data text-body-sm">
          [ERROR]: {error}
        </div>
      )}

      <div className="w-full flex flex-col md:flex-row gap-gutter">
        {/* Left Column: Session Information & Max Participants */}
        <div className="flex-1 flex flex-col gap-gutter">
          <div className="bg-surface-container-low border border-outline-variant p-md flex flex-col gap-md relative">
            <div className="absolute top-0 right-0 p-xs border-b border-l border-outline-variant bg-surface-container-high">
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                info
              </span>
            </div>
            <div className="pb-sm border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-label-caps text-on-surface uppercase tracking-widest flex items-center gap-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                SESSION INFORMATION
              </h2>
            </div>
            <div className="flex flex-col gap-sm">
              <label className="font-mono-data text-label-caps text-on-surface-variant uppercase">
                Session Name
              </label>
              <input
                className="bg-surface border border-outline-variant text-on-surface font-body-sm px-sm py-xs focus:outline-none focus:border-primary transition-colors placeholder:text-surface-variant"
                placeholder="e.g. Classroom Discussion"
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-sm">
              <label className="font-mono-data text-label-caps text-on-surface-variant uppercase">
                Room / Location
              </label>
              <input
                className="bg-surface border border-outline-variant text-on-surface font-body-sm px-sm py-xs focus:outline-none focus:border-primary transition-colors placeholder:text-surface-variant"
                placeholder="e.g. A101"
                type="text"
                value={roomLocation}
                onChange={(e) => setRoomLocation(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-sm">
              <label className="font-mono-data text-label-caps text-on-surface-variant uppercase">
                Host Name
              </label>
              <input
                className="bg-surface border border-outline-variant text-on-surface font-body-sm px-sm py-xs focus:outline-none focus:border-primary transition-colors placeholder:text-surface-variant"
                placeholder="e.g. Vighnesh"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant border-dashed p-md flex flex-col gap-md">
            <div className="pb-sm border-b border-outline-variant border-dashed">
              <h2 className="font-label-caps text-on-surface uppercase tracking-widest">
                Maximum Participants
              </h2>
            </div>
            <div className="flex items-center gap-md">
              <span className="material-symbols-outlined text-surface-variant text-[32px]">
                groups
              </span>
              <div className="flex items-center border border-outline-variant bg-surface">
                <button
                  type="button"
                  onClick={() => handleStepperChange(-1)}
                  className="px-sm py-xs hover:bg-surface-container transition-colors text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    remove
                  </span>
                </button>
                <input
                  className="w-16 bg-transparent text-center font-mono-data text-on-surface focus:outline-none border-x border-outline-variant py-xs"
                  max="100"
                  min="2"
                  type="number"
                  value={maxParticipants}
                  onChange={(e) =>
                    setMaxParticipants(
                      Math.min(100, Math.max(2, parseInt(e.target.value) || 2))
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => handleStepperChange(1)}
                  className="px-sm py-xs hover:bg-surface-container transition-colors text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Audio Settings */}
        <div className="flex-1 flex flex-col gap-gutter">
          <div className="bg-surface-container-low border border-outline-variant p-md flex flex-col gap-md h-full">
            <div className="pb-sm border-b border-outline-variant">
              <h2 className="font-label-caps text-on-surface uppercase tracking-widest flex items-center justify-between">
                AUDIO SETTINGS
                <span className="material-symbols-outlined text-[16px] text-primary">
                  graphic_eq
                </span>
              </h2>
            </div>

            <div className="flex flex-col gap-sm mt-sm">
              <label className="font-mono-data text-label-caps text-on-surface-variant uppercase">
                Audio Transport
              </label>
              <div className="flex gap-xs border border-outline-variant p-xs bg-surface">
                {(["auto", "wifi", "bluetooth"] as const).map((mode) => (
                  <label key={mode} className="flex-1 cursor-pointer">
                    <input
                      className="peer hidden"
                      name="transport"
                      type="radio"
                      checked={transport === mode}
                      onChange={() => setTransport(mode)}
                    />
                    <div className="text-center py-xs border border-transparent peer-checked:border-primary peer-checked:bg-surface-container-high peer-checked:text-primary text-on-surface-variant font-mono-data uppercase transition-colors">
                      {mode === "auto" ? "Auto" : mode === "wifi" ? "Wi-Fi" : "Bluetooth"}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="h-px bg-outline-variant border-dashed my-xs"></div>

            <div className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-mono-data text-on-surface uppercase">
                    Echo Cancellation
                  </span>
                  <span className="font-mono-data text-[10px] text-on-surface-variant">
                    Reduce feedback loop
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    className="sr-only peer"
                    type="checkbox"
                    checked={echoCancellation}
                    onChange={(e) => setEchoCancellation(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none border border-outline-variant peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border-outline-variant after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-mono-data text-on-surface uppercase">
                    Noise Suppression
                  </span>
                  <span className="font-mono-data text-[10px] text-on-surface-variant">
                    Filter background hum
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    className="sr-only peer"
                    type="checkbox"
                    checked={noiseSuppression}
                    onChange={(e) => setNoiseSuppression(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none border border-outline-variant peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border-outline-variant after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            <div className="h-px bg-outline-variant border-dashed my-xs"></div>

            <div className="flex flex-col gap-sm mt-auto">
              <div className="flex justify-between items-end">
                <label className="font-mono-data text-label-caps text-on-surface-variant uppercase">
                  Default Mic Volume
                </label>
                <span className="font-mono-data text-primary text-[11px]">
                  {defaultVolume}%
                </span>
              </div>
              <div className="relative w-full h-4 flex items-center group">
                <div className="absolute w-full h-px bg-outline-variant"></div>
                <div
                  className="absolute h-px bg-primary"
                  style={{ width: `${defaultVolume}%` }}
                ></div>
                <input
                  className="absolute w-full appearance-none bg-transparent outline-none z-10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-surface"
                  max="100"
                  min="0"
                  type="range"
                  value={defaultVolume}
                  onChange={(e) => setDefaultVolume(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-between w-full font-mono-data text-[9px] text-surface-variant mt-1">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-md mt-sm border-t border-outline-variant pt-md">
        <button
          type="button"
          onClick={() => {
            setSessionName("");
            setRoomLocation("");
            setHostName("");
          }}
          className="font-label-caps uppercase text-on-surface-variant hover:text-on-surface border border-transparent hover:border-outline-variant px-sm py-xs transition-colors"
        >
          [ CANCEL ]
        </button>
        <button
          type="submit"
          disabled={loading}
          className="font-label-caps uppercase text-surface bg-primary border border-primary px-md py-xs hover:bg-primary-container transition-colors flex items-center gap-sm disabled:opacity-50"
        >
          {loading ? "[ CREATING... ]" : "[ CREATE SESSION ]"}
          <span className="material-symbols-outlined text-[16px]">
            arrow_forward
          </span>
        </button>
      </div>
    </form>
  );
}
