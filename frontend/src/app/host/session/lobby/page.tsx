"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import { getSocket } from "@/services/socket";
import {
  getBackendUrl,
  getFrontendUrl,
  KNOWN_LAN_IPS,
  getSelectedLanIp,
  setSelectedLanIp,
} from "@/lib/config";
import { SOCKET_EVENTS } from "@/lib/socket-events";

interface LobbyParticipant {
  participant_id: string;
  display_name: string;
  transport: string;
  connection_state: string;
}

interface SessionInfo {
  session_id: string;
  room_code: string;
  session_name: string;
  host_name: string;
  room: string;
  max_participants: number;
  transport_policy: string;
  status: string;
  participant_count: number;
}

export default function LobbyPage() {
  const router = useRouter();

  const [socket] = useState(() => getSocket());
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
  const [currentIp, setCurrentIp] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const roomCode = localStorage.getItem("vmic-host-room");
    if (!roomCode) {
      router.push("/host/create");
      return;
    }

    const ip = getSelectedLanIp();
    setCurrentIp(ip);
    setJoinUrl(`${getFrontendUrl()}/join?room=${roomCode}`);

    // Fetch session info
    fetch(`${getBackendUrl()}/api/sessions/${roomCode}`)
      .then((res) => {
        if (!res.ok) {
          localStorage.removeItem("vmic-host-room");
          router.push("/host/create");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setSession(data);
      })
      .catch(() => {
        console.error("Failed to fetch session info");
      });

    // Fetch existing participants
    fetch(`${getBackendUrl()}/api/sessions/${roomCode}/participants`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setParticipants(data);
        }
      })
      .catch(() => {});

    // Join Socket.IO room as host
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
      room_code: roomCode,
      role: "host",
    });

    // Listen for new participants joining
    const handleParticipantJoined = (data: {
      participant: LobbyParticipant;
    }) => {
      setParticipants((current) => {
        const exists = current.some(
          (p) => p.participant_id === data.participant.participant_id
        );
        if (exists) return current;
        return [...current, data.participant];
      });
    };

    // Listen for participants leaving
    const handleParticipantLeft = (data: { participant_id: string }) => {
      setParticipants((current) =>
        current.filter((p) => p.participant_id !== data.participant_id)
      );
    };

    socket.on(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);
    socket.on(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);

    return () => {
      socket.off(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);
      socket.off(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);
    };
  }, [socket, router]);

  const handleIpChange = (newIp: string) => {
    setSelectedLanIp(newIp);
    setCurrentIp(newIp);
    const roomCode = session?.room_code || "";
    const port = window.location.port || "3000";
    setJoinUrl(`https://${newIp}:${port}/join?room=${roomCode}`);
  };

  const handleStartSession = async () => {
    if (!session) return;

    setIsStarting(true);

    try {
      await fetch(`${getBackendUrl()}/api/sessions/${session.room_code}/start`, {
        method: "POST",
      });

      router.push("/host/session");
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsStarting(false);
    }
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">
        Loading session...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 py-12 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900 p-8">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-green-400">VMIC Session Lobby</h1>
          <p className="mt-1 text-sm text-gray-400">
            {session.session_name}
            {session.room && <span className="ml-2 text-gray-500">({session.room})</span>}
          </p>
        </div>

        {/* LAN IP Switcher */}
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 font-semibold">🌐 Host Network Interface IP:</span>
            <span className="font-mono text-green-400 font-bold">{currentIp}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {KNOWN_LAN_IPS.map((ip) => (
              <button
                key={ip}
                onClick={() => handleIpChange(ip)}
                className={`flex-1 min-w-[120px] rounded-lg py-1.5 font-mono text-xs transition border ${
                  currentIp === ip
                    ? "bg-green-500/20 text-green-400 border-green-500/50 font-bold"
                    : "bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700"
                }`}
              >
                {ip} {ip.startsWith("192.168.137") ? "(Hotspot)" : "(Wi-Fi)"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter Custom IP (e.g. 192.168.1.100)"
              className="flex-1 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-green-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const customIp = (e.target as HTMLInputElement).value.trim();
                  if (customIp) handleIpChange(customIp);
                }
              }}
            />
            <span className="text-[10px] text-gray-500">Press Enter to apply</span>
          </div>
        </div>

        {/* QR Code Panel */}
        <div className="mt-4 flex flex-col items-center rounded-xl border border-gray-800 bg-gray-950 p-6">
          <div className="rounded-xl bg-white p-3 shadow-lg">
            <QRCodeSVG value={joinUrl} size={180} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Scan with mobile camera to join
          </p>
          <p className="mt-2 text-lg font-mono font-bold text-green-400">
            ROOM: {session.room_code}
          </p>
          <p className="mt-1 text-xs font-mono text-gray-500 break-all text-center">
            {joinUrl}
          </p>
        </div>

        {/* Participants List */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Participants
            </h2>
            <span className="text-sm text-gray-500">
              {participants.length} / {session.max_participants}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {participants.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-800 p-4 text-center text-sm text-gray-500">
                Waiting for participants to scan the QR code...
              </p>
            ) : (
              participants.map((p) => (
                <div
                  key={p.participant_id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 px-4 py-3"
                >
                  <div>
                    <span className="font-semibold text-white">{p.display_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={
                      p.transport === "BLUETOOTH"
                        ? "font-bold text-blue-400"
                        : "font-bold text-green-400"
                    }>
                      {p.transport === "BLUETOOTH" ? "BT" : "WI-FI"}
                    </span>
                    <span className="text-yellow-400">{p.connection_state}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleStartSession}
            disabled={isStarting}
            className="flex-1 rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-40"
          >
            {isStarting ? "STARTING..." : "START SESSION"}
          </button>
        </div>

        {/* Session Details Footer */}
        <div className="mt-6 border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
          <p>Host: <span className="text-gray-300">{session.host_name}</span></p>
          <p className="mt-1">
            Transport: <span className="uppercase text-gray-300">{session.transport_policy}</span>
          </p>
        </div>

      </div>
    </main>
  );
}
