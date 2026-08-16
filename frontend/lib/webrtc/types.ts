/**
 * VoxMesh / Vmic — WebRTC Audio Transport Types.
 *
 * Types for browser-to-browser peer-to-peer audio transmission.
 * Audio bytes NEVER pass through FastAPI, WebSocket, or Redis.
 */

export interface PeerConnectionEntry {
  participantId: string;
  peerConnection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  audioElement: HTMLAudioElement | null;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  reconnectAttempts: number;
}

export type WebRTCEventType =
  | "connection_state_change"
  | "ice_state_change"
  | "ice_gathering_change"
  | "track_received"
  | "track_ended"
  | "offer_created"
  | "offer_received"
  | "answer_created"
  | "answer_received"
  | "ice_candidate_sent"
  | "ice_candidate_received"
  | "reconnect_scheduled"
  | "reconnect_attempt"
  | "error";

export interface WebRTCLogEvent {
  timestamp: number;
  participantId: string;
  event: WebRTCEventType;
  details: Record<string, unknown>;
}

export interface WebRTCServiceEvents {
  onTrackReceived?: (participantId: string, stream: MediaStream) => void;
  onTrackRemoved?: (participantId: string) => void;
  onConnectionStateChange?: (
    participantId: string,
    state: RTCPeerConnectionState
  ) => void;
  onIceConnectionStateChange?: (
    participantId: string,
    state: RTCIceConnectionState
  ) => void;
  onLog?: (log: WebRTCLogEvent) => void;
  onError?: (participantId: string, error: Error) => void;
}
