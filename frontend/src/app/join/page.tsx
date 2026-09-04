"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { VMICWebRTC } from "@/services/webrtc";
import { getSocket } from "@/services/socket";
import { SOCKET_EVENTS } from "@/lib/socket-events";
import { getBackendUrl } from "@/lib/config";
import {
  VMICTransportSelector,
  TransportPreference,
  TransportSelectionResult,
} from "@/services/transport-selector";

function JoinForm() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") || "";

  const [roomCode, setRoomCode] = useState(roomParam.toUpperCase());
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("Disconnected");

  const [transportPreference, setTransportPreference] =
    useState<TransportPreference>("auto");

  const [selectedTransport, setSelectedTransport] =
    useState<TransportSelectionResult | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState("Disconnected");

  const [participantId, setParticipantId] =
    useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);

  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  const [socket] = useState(
    () => getSocket()
  );

  const [webrtc] = useState(
    () =>
      new VMICWebRTC(
        (candidate) => {
          const roomCode = localStorage.getItem("vmic-room");
          const participantData = localStorage.getItem("vmic-participant");

          if (!roomCode || !participantData) return;

          const participant = JSON.parse(participantData);

          socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, {
            room_code: roomCode,
            participant_id: participant.participant_id,
            candidate: candidate.toJSON(),
          });
        }
      )
  );

  useEffect(() => {
    if (roomParam && !roomCode) {
      setRoomCode(roomParam.toUpperCase());
    }
  }, [roomParam, roomCode]);

  useEffect(() => {
    const handleConnect = () => {
      setConnectionStatus("Control channel connected");
    };

    const handleDisconnect = () => {
      setConnectionStatus("Control channel disconnected");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    const handleAnswer = async (data: { participant_id: string; sdp: string }) => {
      await webrtc.setRemoteAnswer({
        type: "answer",
        sdp: data.sdp,
      });
      setConnectionStatus("WebRTC answer received");
    };

    const handleIceCandidate = async (data: { participant_id: string; candidate: RTCIceCandidateInit }) => {
      await webrtc.addIceCandidate(data.candidate);
    };

    const handleFloorUpdated = (data: { current_speaker: string | null; queue: string[] }) => {
      setCurrentSpeaker(data.current_speaker);
    };

    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);
    socket.on(SOCKET_EVENTS.FLOOR_UPDATED, handleFloorUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
      socket.off(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);
      socket.off(SOCKET_EVENTS.FLOOR_UPDATED, handleFloorUpdated);
    };
  }, [socket, webrtc, participantId]);

  useEffect(() => {
    const handleAudioControl = (data: { participant_id: string; muted: boolean }) => {
      if (data.participant_id !== participantId) return;

      webrtc.setMicrophoneMuted(data.muted);
      setIsMuted(data.muted);
      setConnectionStatus(data.muted ? "Voice transmission muted" : "Voice transmission active");
    };

    socket.on(SOCKET_EVENTS.AUDIO_CONTROL_UPDATED, handleAudioControl);

    return () => {
      socket.off(SOCKET_EVENTS.AUDIO_CONTROL_UPDATED, handleAudioControl);
    };
  }, [socket, webrtc, participantId]);

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      alert("Please enter a room code.");
      return;
    }

    if (!displayName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setStatus("Joining...");

    // On HTTP (non-HTTPS) mobile browsers, navigator.mediaDevices may be undefined.
    // We allow wifi joining regardless so session signaling succeeds.
    const availability = {
      wifi: true,
      bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator || true,
    };

    let selection: TransportSelectionResult;
    try {
      const selector = new VMICTransportSelector();
      selection = selector.select(transportPreference, availability);
      setSelectedTransport(selection);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Transport selection error.");
      setStatus("Transport Error");
      return;
    }

    try {
      const response = await fetch(
        `${getBackendUrl()}/api/sessions/${roomCode}/participants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            transport: selection.transport,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(response.status === 404 ? "Session Not Found" : "Join Failed");
        if (response.status === 404) {
          alert(`Session "${roomCode}" was not found or has ended. Please scan the current active QR code on the host display.`);
        } else {
          alert(data.detail || "Unable to join session.");
        }
        return;
      }

      setParticipantId(data.participant_id);
      setIsMuted(data.muted ?? true);
      setStatus("Joined");

      localStorage.setItem("vmic-participant", JSON.stringify(data));
      localStorage.setItem("vmic-room", roomCode.toUpperCase());

      const joinSocketRoom = () => socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        room_code: roomCode.toUpperCase(),
        role: "participant",
        participant_id: data.participant_id,
        transport: selection.transport,
      });

      if (socket.connected) {
        joinSocketRoom();
      } else {
        await new Promise<void>((resolve) => {
          socket.once("connect", () => {
            joinSocketRoom();
            resolve();
          });
        });
      }

      if (selection.transport === "wifi") {
        try {
          await webrtc.initializeMicrophone();
          await sendWebRTCOffer(data.participant_id, roomCode.toUpperCase());
        } catch (error) {
          console.error("[WebRTC] Microphone startup failed:", error);
          const message = error instanceof Error
            ? error.message
            : "Microphone permission is required for voice.";
          setConnectionStatus(message);
          alert(`Joined the session, but microphone access failed: ${message}`);
        }
      }

    } catch (error) {
      console.error(error);
      setStatus("Backend unavailable");
    }
  };

  const sendWebRTCOffer = async (participantIdToStart: string, roomCodeToStart: string) => {
    setConnectionStatus("Starting WebRTC...");
    await webrtc.createPeerConnection();
    const offer = await webrtc.createOffer();

    socket.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      room_code: roomCodeToStart,
      participant_id: participantIdToStart,
      sdp: offer.sdp,
    });

    setConnectionStatus("Offer sent - waiting for host");
  };

  const handleSendLatencyPing = () => {
    if (!participantId) return;
    const timestamp = Date.now();
    socket.emit(SOCKET_EVENTS.LATENCY_PING, { timestamp });
  };

  const handleToggleMute = () => {
    if (!participantId) return;

    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    socket.emit(
      nextMuted ? SOCKET_EVENTS.MUTE_PARTICIPANT : SOCKET_EVENTS.UNMUTE_PARTICIPANT,
      { participant_id: participantId },
    );
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-green-400">VMIC</h1>
        <p className="mt-2 text-gray-400">Local Wireless Microphone</p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm text-gray-400">Room Code</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7A2P9"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-green-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-gray-400">Your Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-green-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs text-gray-400">Audio Transport Preference</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "auto", label: "AUTO" },
              { id: "wifi", label: "WI-FI" },
              { id: "bluetooth", label: "BLUETOOTH" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTransportPreference(opt.id as TransportPreference)}
                className={`rounded-lg py-2 text-xs font-bold transition border ${
                  transportPreference === opt.id
                    ? "bg-green-500 text-black border-green-400"
                    : "bg-gray-950 text-gray-400 border-gray-800 hover:border-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {selectedTransport && (
          <div className="rounded-lg bg-gray-950 border border-gray-800 p-3 text-xs">
            <span className="text-gray-500">Selected Transport:</span>{" "}
            <span className="font-bold text-green-400 uppercase">{selectedTransport.transport}</span>
            <p className="mt-1 text-gray-400">{selectedTransport.reason}</p>
          </div>
        )}

        <button
          onClick={handleJoin}
          className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400"
        >
          JOIN SESSION
        </button>

        {participantId && (
          <button
            onClick={handleToggleMute}
            className={`w-full rounded-lg px-4 py-3 font-semibold transition ${
              isMuted
                ? "border border-red-500 bg-red-500/10 text-red-400"
                : "bg-green-500 text-black hover:bg-green-400"
            }`}
          >
            {isMuted ? "UNMUTE MICROPHONE" : "MUTE MICROPHONE"}
          </button>
        )}

        {participantId && (
          <button
            onClick={handleSendLatencyPing}
            className="w-full rounded-lg border border-purple-500/40 bg-purple-500/10 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20"
          >
            ⏱️ TEST E2E LATENCY PING
          </button>
        )}
      </div>

      <div className="mt-8 border-t border-gray-800 pt-5 text-center">
        <p className="text-sm text-gray-500">Session Status</p>
        <p className={`mt-1 font-semibold ${status === "Joined" ? "text-green-400" : "text-gray-400"}`}>
          ● {status}
        </p>

        <p className="mt-3 text-sm text-gray-500">WebRTC Status</p>
        <p className={`mt-1 font-semibold ${connectionStatus.includes("received") ? "text-green-400" : "text-gray-400"}`}>
          ● {connectionStatus}
        </p>

        {currentSpeaker && (
          <p className="mt-3 text-xs text-gray-400">
            Current Speaker: <span className="font-semibold text-green-400">{currentSpeaker === participantId ? "You" : currentSpeaker}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
      <Suspense fallback={<div className="text-gray-400">Loading VMIC Join...</div>}>
        <JoinForm />
      </Suspense>
    </main>
  );
}
