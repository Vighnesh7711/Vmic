"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Participant, Session } from "@/lib/types";
import { ParticipantState } from "@/lib/constants";
import { SignalingClient } from "@/lib/websocket/SignalingClient";
import { WebRTCService } from "@/lib/webrtc/WebRTCService";
import { HostAudioEngine } from "@/lib/audio/HostAudioEngine";
import type { ParticipantAudioTelemetry } from "@/lib/audio/types";
import { QRPanel } from "./QRPanel";
import { ParticipantList, RequestToSpeakEntry } from "./ParticipantList";
import {
  GrantFloorPayload,
  MutePayload,
  ReleaseFloorPayload,
  RequestFloorPayload,
  SessionEndedPayload,
  UnmutePayload,
  UserJoinedPayload,
  UserLeftPayload,
} from "@/lib/websocket/types";

interface LobbyViewProps {
  session: Session;
}

export function LobbyView({ session }: LobbyViewProps) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [sessionStarted, setSessionStarted] = useState(session.status === "active");
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [masterLevel, setMasterLevel] = useState(0.0);

  // Live state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [audioTelemetry, setAudioTelemetry] = useState<
    Record<string, ParticipantAudioTelemetry>
  >({});
  const [requestQueue, setRequestQueue] = useState<RequestToSpeakEntry[]>([]);

  // Service instances
  const signalingClient = useMemo(() => new SignalingClient(), []);
  const hostAudioEngineRef = useRef<HostAudioEngine | null>(null);
  const webRTCServiceRef = useRef<WebRTCService | null>(null);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Host Audio Engine, Signaling, and WebRTC
  useEffect(() => {
    let isMounted = true;

    const audioEngine = new HostAudioEngine({
      onTelemetryUpdate: (telemetry, mLevel) => {
        if (isMounted) {
          setAudioTelemetry(telemetry);
          setMasterLevel(mLevel);
        }
      },
    });
    hostAudioEngineRef.current = audioEngine;

    // 1. Init Web Audio graph
    audioEngine.init().catch(console.error);

    // 2. Connect Signaling
    signalingClient
      .connect()
      .then(() => {
        if (!isMounted) return;

        // Register host
        signalingClient.joinRoom(
          session.id,
          session.hostId,
          session.hostName,
          "host"
        );

        // 3. Init WebRTC Service
        const rtcService = new WebRTCService(
          session.id,
          session.hostId,
          true,
          signalingClient,
          {
            onTrackReceived: (participantId, stream) => {
              audioEngine.addParticipantStream(participantId, stream);
            },
            onTrackRemoved: (participantId) => {
              audioEngine.removeParticipantStream(participantId);
            },
          }
        );
        webRTCServiceRef.current = rtcService;

        // Add Host as initial participant in local state
        setParticipants([
          {
            id: session.hostId,
            sessionId: session.id,
            displayName: session.hostName,
            role: "host",
            state: ParticipantState.Active,
            joinedAt: Date.now(),
            networkInfo: {
              transportType: "wifi",
              detail: "Host (Local Gateway)",
              signal: "-10dBm",
              ipOrAddress: "192.168.4.1",
            },
          },
        ]);
      })
      .catch((err) => {
        console.error("Signaling connection error:", err);
      });

    // 4. WebSocket Event Handlers
    const unsubJoined = signalingClient.on<UserJoinedPayload>(
      "USER_JOINED",
      (msg) => {
        if (msg.sessionId !== session.id) return;
        setParticipants((prev) => {
          const exists = prev.some((p) => p.id === msg.participant.id);
          if (exists) return prev;

          const newParticipant: Participant = {
            id: msg.participant.id,
            sessionId: session.id,
            displayName: msg.participant.displayName,
            role: msg.participant.role,
            state: ParticipantState.Active,
            joinedAt: msg.participant.joinedAt || Date.now(),
            networkInfo: {
              transportType: "wifi",
              detail: "Wi-Fi (802.11ac)",
              signal: "-42dBm",
              ipOrAddress: `192.168.4.${10 + (prev.length % 20)}`,
            },
          };
          return [...prev, newParticipant];
        });

        // Host initiates WebRTC offer to new attendee
        if (msg.participant.id !== session.hostId && webRTCServiceRef.current) {
          webRTCServiceRef.current.connectToPeer(msg.participant.id).catch(console.error);
        }
      }
    );

    const unsubLeft = signalingClient.on<UserLeftPayload>("USER_LEFT", (msg) => {
      if (msg.sessionId !== session.id) return;
      setParticipants((prev) => prev.filter((p) => p.id !== msg.participantId));
      setRequestQueue((prev) =>
        prev.filter((q) => q.participantId !== msg.participantId)
      );

      webRTCServiceRef.current?.disconnectPeer(msg.participantId);
      audioEngine.removeParticipantStream(msg.participantId);
    });

    const unsubMute = signalingClient.on<MutePayload>("MUTE", (msg) => {
      audioEngine.muteParticipant(msg.participantId);
    });

    const unsubUnmute = signalingClient.on<UnmutePayload>("UNMUTE", (msg) => {
      audioEngine.unmuteParticipant(msg.participantId);
    });

    const unsubReqFloor = signalingClient.on<RequestFloorPayload>(
      "REQUEST_FLOOR",
      (msg) => {
        setParticipants((prev) => {
          const sender = prev.find((p) => p.id === msg.participantId);
          if (sender) {
            setRequestQueue((q) => {
              if (q.some((entry) => entry.participantId === msg.participantId)) {
                return q;
              }
              // FIFO order: append to end
              return [
                ...q,
                {
                  participantId: msg.participantId,
                  displayName: sender.displayName,
                  requestedAt: Date.now(),
                },
              ];
            });
          }
          return prev;
        });
      }
    );

    const unsubGrantFloor = signalingClient.on<GrantFloorPayload>(
      "GRANT_FLOOR",
      (msg) => {
        setRequestQueue((q) =>
          q.filter((entry) => entry.participantId !== msg.participantId)
        );
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === msg.participantId ? { ...p, hasFloor: true } : { ...p, hasFloor: false }
          )
        );
      }
    );

    const unsubRelFloor = signalingClient.on<ReleaseFloorPayload>(
      "RELEASE_FLOOR",
      (msg) => {
        setRequestQueue((q) =>
          q.filter((entry) => entry.participantId !== msg.participantId)
        );
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === msg.participantId ? { ...p, hasFloor: false } : p
          )
        );
      }
    );

    const unsubEnded = signalingClient.on<SessionEndedPayload>(
      "SESSION_ENDED",
      () => {
        handleCleanTeardown();
      }
    );

    return () => {
      isMounted = false;
      unsubJoined();
      unsubLeft();
      unsubMute();
      unsubUnmute();
      unsubReqFloor();
      unsubGrantFloor();
      unsubRelFloor();
      unsubEnded();

      handleCleanTeardown();
    };
  }, [session, signalingClient]);

  const handleCleanTeardown = () => {
    webRTCServiceRef.current?.dispose();
    webRTCServiceRef.current = null;

    hostAudioEngineRef.current?.dispose();
    hostAudioEngineRef.current = null;

    signalingClient.disconnect();
  };

  // -------------------------------------------------------------------------
  // Control actions
  // -------------------------------------------------------------------------

  const handleParticipantVolume = (id: string, volume: number) => {
    hostAudioEngineRef.current?.setParticipantVolume(id, volume);
  };

  const handleToggleMute = (id: string, currentMuted: boolean) => {
    const nextMuted = !currentMuted;
    if (nextMuted) {
      hostAudioEngineRef.current?.muteParticipant(id);
    } else {
      hostAudioEngineRef.current?.unmuteParticipant(id);
    }
    signalingClient.setMute(session.id, id, nextMuted);
  };

  const handleGrantFloor = (id: string) => {
    signalingClient.grantFloor(session.id, id);
    setRequestQueue((q) => q.filter((entry) => entry.participantId !== id));
  };

  const handleReleaseFloor = (id: string) => {
    signalingClient.releaseFloor(session.id, id);
  };

  const handleMasterVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    hostAudioEngineRef.current?.setMasterVolume(vol);
  };

  const handleStartSession = () => {
    setSessionStarted(true);
    signalingClient.startSession(session.id);
  };

  const handleEndSession = () => {
    if (confirm("Are you sure you want to end this audio session?")) {
      signalingClient.endSession(session.id);
      handleCleanTeardown();
      router.push("/create-session");
    }
  };

  const formatUptime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const mins = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  return (
    <div className="flex flex-col w-full h-full p-lg gap-lg font-mono-data">
      {/* Session Ready Bar */}
      <div className="flex items-center gap-md border-b border-outline-variant pb-md">
        <span className="material-symbols-outlined text-primary text-headline-md">
          podcasts
        </span>
        <div className="flex flex-col">
          <h1 className="text-headline-md font-headline-md text-on-surface tracking-wide uppercase">
            {sessionStarted ? "SESSION LIVE" : "SESSION READY"} - {session.name} ({session.room})
          </h1>
          <span className="text-label-caps font-label-caps text-on-surface-variant uppercase">
            Local Mesh Protocol V2.4 / {sessionStarted ? "Broadcasting" : "Awaiting Nodes"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-xl">
          {/* Master Volume Controller */}
          <div className="flex items-center gap-sm bg-surface-container border border-outline-variant px-3 py-1">
            <span className="material-symbols-outlined text-[18px] text-primary">
              volume_up
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] text-on-surface-variant uppercase">
                MASTER VOL
              </span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={masterVolume}
                onChange={(e) =>
                  handleMasterVolumeChange(parseFloat(e.target.value) || 0)
                }
                className="w-24 h-1 bg-surface-container-high appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary"
              />
            </div>
            <span className="text-[11px] text-primary font-mono w-8 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>

          <div className="flex flex-col items-end border-r border-outline-variant pr-md">
            <span className="text-label-caps text-on-surface-variant">Host</span>
            <span className="text-body-sm text-primary">{session.hostName}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-label-caps text-on-surface-variant">Uptime</span>
            <span className="text-body-sm text-on-surface font-mono">
              {formatUptime(seconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: QR Panel (5) + Participant List (7) */}
      <div className="grid grid-cols-12 gap-lg h-full">
        <QRPanel
          roomCode={session.roomCode}
          gatewayIp="192.168.4.1"
          ssid="VOXMESH-LOCAL"
          encryption="WPA3-SAE / AES"
        />
        <ParticipantList
          maxParticipants={session.maxParticipants}
          participants={participants}
          audioTelemetry={audioTelemetry}
          requestQueue={requestQueue}
          sessionStarted={sessionStarted}
          onVolumeChange={handleParticipantVolume}
          onToggleMute={handleToggleMute}
          onGrantFloor={handleGrantFloor}
          onReleaseFloor={handleReleaseFloor}
          onStartSession={handleStartSession}
          onEndSession={handleEndSession}
        />
      </div>
    </div>
  );
}
