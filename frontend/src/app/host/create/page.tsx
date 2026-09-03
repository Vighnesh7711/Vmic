"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TransportPreference } from "@/services/transport-selector";
import { getBackendUrl } from "@/lib/config";

export default function CreateSessionPage() {
  const router = useRouter();

  const [sessionName, setSessionName] = useState("");
  const [hostName, setHostName] = useState("");
  const [room, setRoom] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [transportPolicy, setTransportPolicy] = useState<TransportPreference>("auto");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      alert("Please enter a session name.");
      return;
    }
    if (!hostName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${getBackendUrl()}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_name: sessionName,
          host_name: hostName,
          room: room,
          max_participants: maxParticipants,
          transport_policy: transportPolicy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Failed to create session.");
        setIsCreating(false);
        return;
      }

      localStorage.setItem("vmic-host-room", data.room_code);
      localStorage.setItem("vmic-session-id", data.session_id);
      localStorage.setItem("vmic-transport-policy", transportPolicy);

      router.push("/host/session/lobby");
    } catch (err) {
      console.error(err);
      alert("Backend server unavailable.");
      setIsCreating(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-green-400">VMIC</h1>
          <p className="mt-2 text-gray-400">Create Audio Session</p>
        </div>

        <div className="space-y-5">

          {/* Session Name */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Session Name</label>
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Classroom Discussion"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-green-400"
            />
          </div>

          {/* Host Name */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Host Name</label>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-green-400"
            />
          </div>

          {/* Room / Location */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Room / Location (optional)</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. A101"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-green-400"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">
              Maximum Participants: <span className="font-bold text-green-400">{maxParticipants}</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Transport Policy */}
          <div>
            <label className="mb-2 block text-sm text-gray-400">Audio Transport Policy</label>
            <div className="space-y-2">
              {[
                {
                  id: "auto",
                  label: "Auto (Wi-Fi Preferred, Bluetooth Fallback)",
                  desc: "Best for multi-device environments",
                },
                {
                  id: "wifi",
                  label: "Wi-Fi Only (WebRTC)",
                  desc: "Lowest latency (~38 ms), requires LAN Wi-Fi",
                },
                {
                  id: "bluetooth",
                  label: "Bluetooth Only (HFP/SCO)",
                  desc: "Uses native Bluetooth audio profile",
                },
              ].map((policy) => (
                <label
                  key={policy.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    transportPolicy === policy.id
                      ? "border-green-500 bg-green-500/10 text-white"
                      : "border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="transportPolicy"
                    value={policy.id}
                    checked={transportPolicy === policy.id}
                    onChange={() => setTransportPolicy(policy.id as TransportPreference)}
                    className="mt-1 accent-green-500"
                  />
                  <div>
                    <div className="text-sm font-semibold">{policy.label}</div>
                    <div className="text-xs text-gray-500">{policy.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="w-full rounded-lg bg-green-500 px-4 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
          >
            {isCreating ? "CREATING..." : "CREATE SESSION"}
          </button>

        </div>

      </div>
    </main>
  );
}
