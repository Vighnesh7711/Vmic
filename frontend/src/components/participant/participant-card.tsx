import { useState } from "react";
import { VMICParticipant } from "@/types/participant";
import { VMICWebRTCStats, getNetworkQuality } from "@/types/webrtc-stats";
import { AudioMeter } from "@/components/audio/audio-meter";

interface ParticipantCardProps {
  participant: VMICParticipant;
  stats?: VMICWebRTCStats;
  onMute: (participantId: string) => void;
  onVolumeChange: (participantId: string, volume: number) => void;
  onGrantFloor?: (participantId: string) => void;
  onReleaseFloor?: (participantId: string) => void;
}

export function ParticipantCard({
  participant,
  stats,
  onMute,
  onVolumeChange,
  onGrantFloor,
  onReleaseFloor,
}: ParticipantCardProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isWiFi = participant.transport === "wifi";

  const totalPackets = isWiFi ? (stats?.packetsReceived || 0) + (stats?.packetsLost || 0) : 0;
  const packetLossPercent =
    isWiFi && totalPackets > 0
      ? Number(((stats?.packetsLost || 0) / totalPackets * 100).toFixed(2))
      : 0;

  const quality = isWiFi
    ? getNetworkQuality(stats?.roundTripTime ?? null, packetLossPercent)
    : "unknown";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">
              {participant.displayName}
            </h3>
            {participant.speaking && (
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                SPEAKING
              </span>
            )}
            {participant.floorState === "granted" && (
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                FLOOR GRANTED
              </span>
            )}
            {participant.floorState === "requested" && (
              <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                REQUESTED FLOOR
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs uppercase text-gray-500">
            <span className={participant.transport === "bluetooth" ? "text-blue-400 font-bold" : "text-green-400 font-bold"}>
              {participant.transport === "bluetooth" ? "📶 BLUETOOTH SCO" : "🌐 WI-FI WEBRTC"}
            </span>
            <span>•</span>
            <span
              className={
                participant.connectionState === "connected"
                  ? "text-green-400 font-medium"
                  : "text-yellow-400"
              }
            >
              {participant.connectionState}
            </span>
            {isWiFi && stats && (
              <>
                <span>•</span>
                <span
                  className={
                    quality === "excellent" || quality === "good"
                      ? "text-green-400"
                      : quality === "fair"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }
                >
                  Quality: {quality}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {participant.floorState === "requested" && onGrantFloor && (
            <button
              onClick={() => onGrantFloor(participant.participantId)}
              className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              GRANT FLOOR
            </button>
          )}

          {participant.floorState === "granted" && onReleaseFloor && (
            <button
              onClick={() => onReleaseFloor(participant.participantId)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600"
            >
              RELEASE FLOOR
            </button>
          )}

          <button
            onClick={() => onMute(participant.participantId)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              participant.muted
                ? "border-red-500 bg-red-500/10 text-red-400"
                : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
            }`}
          >
            {participant.muted ? "UNMUTE" : "MUTE"}
          </button>

          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-xs font-semibold text-gray-400 hover:text-white"
            title="Toggle Transport Diagnostics"
          >
            📊 {showDiagnostics ? "HIDE DIAG" : "DIAG"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <AudioMeter level={participant.audioLevel} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Volume</span>
          <span>{participant.volume}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={participant.volume}
          onChange={(event) =>
            onVolumeChange(
              participant.participantId,
              Number(event.target.value)
            )
          }
          className="w-full accent-green-500"
        />
      </div>

      {/* Unified Transport Diagnostics Collapsible Panel */}
      {showDiagnostics && (
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs font-mono">
          <div className="mb-2 flex items-center justify-between border-b border-gray-800 pb-2 text-gray-400">
            <span className="font-semibold text-green-400">
              Transport Diagnostics ({participant.transport.toUpperCase()})
            </span>
            <span>ID: {participant.participantId.slice(0, 8)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-gray-300">
            <div>
              <span className="text-gray-500">Transport:</span>{" "}
              <span className="font-semibold text-white uppercase">
                {participant.transport}
              </span>
            </div>

            <div>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="font-semibold text-green-400 uppercase">
                {participant.connectionState}
              </span>
            </div>

            <div>
              <span className="text-gray-500">RTT:</span>{" "}
              <span className="font-semibold text-white">
                {isWiFi && stats?.roundTripTime !== null && stats?.roundTripTime !== undefined
                  ? `${stats.roundTripTime.toFixed(1)} ms`
                  : "N/A (OS Bluetooth)"}
              </span>
            </div>

            <div>
              <span className="text-gray-500">Jitter:</span>{" "}
              <span className="font-semibold text-white">
                {isWiFi && stats ? `${stats.jitter.toFixed(1)} ms` : "N/A (OS Bluetooth)"}
              </span>
            </div>

            <div>
              <span className="text-gray-500">Packet Loss:</span>{" "}
              <span
                className={`font-semibold ${
                  isWiFi && packetLossPercent > 2 ? "text-red-400" : "text-white"
                }`}
              >
                {isWiFi ? `${packetLossPercent}% (${stats?.packetsLost || 0} lost)` : "N/A (OS Bluetooth)"}
              </span>
            </div>

            <div>
              <span className="text-gray-500">Audio Level:</span>{" "}
              <span className="font-semibold text-white">
                {(participant.audioLevel * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
