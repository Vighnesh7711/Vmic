export interface VMICWebRTCStats {
  participantId: string;

  connectionState:
    RTCPeerConnectionState;

  iceConnectionState:
    RTCIceConnectionState;

  packetsReceived: number;

  packetsLost: number;

  jitter: number;

  bytesReceived: number;

  roundTripTime: number | null;

  timestamp: number;
}

export type NetworkQuality =
  | "excellent"
  | "good"
  | "fair"
  | "poor";

export function getNetworkQuality(
  rttMs: number | null,
  packetLossPercent: number
): NetworkQuality {
  if (rttMs === null) return "good";
  if (rttMs < 50 && packetLossPercent < 1) return "excellent";
  if (rttMs < 100 && packetLossPercent < 3) return "good";
  if (rttMs < 200 && packetLossPercent < 5) return "fair";
  return "poor";
}
