/**
 * VoxMesh / Vmic — core domain types (frontend).
 *
 * Entities: Session, Participant, AudioSource, Connection, AudioSettings.
 * They describe CONTROL-PLANE state only. Actual audio never appears in
 * these types — it travels peer-to-peer over WebRTC and never touches
 * FastAPI, the WebSocket, or Redis.
 */

import type { ConnectionState, ParticipantState } from "@/lib/constants";

export interface AudioSettings {
  transport: "auto" | "wifi" | "bluetooth";
  echoCancellation: boolean;
  noiseSuppression: boolean;
  defaultVolume: number; // 0–100
}

export interface CreateSessionPayload {
  name: string;
  room: string;
  hostName: string;
  maxParticipants: number;
  audioSettings: AudioSettings;
  speakingMode?: "open_floor" | "controlled_floor";
}

/**
 * A classroom room / session.
 */
export interface Session {
  /** Unique session identifier (UUID). */
  id: string;
  /** Human-readable session name. */
  name: string;
  /** Room or location label (e.g. A101). */
  room: string;
  /** Display name of the host. */
  hostName: string;
  /** Participant id of the host (teacher) who owns the session. */
  hostId: string;
  /** Human-friendly room code (e.g. A101-7XK). */
  roomCode: string;
  /** Maximum participants allowed. */
  maxParticipants: number;
  /** Session audio configuration. */
  audioSettings: AudioSettings;
  /** Floor speaking mode. */
  speakingMode: string;
  /** IDs of participants currently in the session. */
  participantIds: string[];
  /** Session status. */
  status: "created" | "active" | "paused" | "ended";
  /** Creation time, epoch milliseconds (UTC). */
  createdAt: number;
}

/**
 * A single attendee (or host) device connected to a session.
 */
export interface Participant {
  /** Unique participant identifier. */
  id: string;
  /** Session this participant belongs to. */
  sessionId: string;
  /** Human-readable name shown in the UI. */
  displayName: string;
  /** Whether this participant hosts the session or is an attendee. */
  role: "host" | "attendee";
  /** Current lifecycle state. */
  state: ParticipantState;
  /** Join time, epoch milliseconds (UTC). */
  joinedAt: number;
  /** Whether participant currently has the floor */
  hasFloor?: boolean;
  /** Whether participant is muted */
  isMuted?: boolean;
  /** Optional network telemetry (e.g. for lobby display) */
  networkInfo?: {
    transportType: "wifi" | "bluetooth";
    detail: string; // e.g. "Wi-Fi (802.11ac)" or "Bluetooth LE 5.2"
    signal: string; // e.g. "-42dBm" or "RSSI: -68"
    ipOrAddress: string; // e.g. "192.168.4.12"
  };
}

/**
 * Metadata describing a participant's microphone input.
 */
export interface AudioSource {
  /** Unique audio-source identifier. */
  id: string;
  /** Participant that owns this microphone source. */
  participantId: string;
  /** Human-readable label (e.g. device name or "Microphone"). */
  label: string;
  /** Whether the source is currently contributing audio (unmuted). */
  enabled: boolean;
}

/**
 * A control-plane record of a peer-to-peer link between two participants.
 */
export interface Connection {
  /** Unique connection identifier. */
  id: string;
  /** Session in which this connection exists. */
  sessionId: string;
  /** Participant that initiated the connection. */
  fromParticipantId: string;
  /** Remote participant on the other end. */
  toParticipantId: string;
  /** Current connection state. */
  state: ConnectionState;
}
