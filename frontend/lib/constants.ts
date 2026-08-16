/**
 * VoxMesh — shared state constants (frontend).
 *
 * Connection- and participant-lifecycle states, expressed as `as const`
 * objects with derived union types (no TS `enum`). Import the value for
 * runtime checks and the same name as a type for annotations:
 *
 *   import { ConnectionState } from "@/lib/constants";
 *   const s: ConnectionState = ConnectionState.Connected;
 */

/**
 * Peer/transport connection lifecycle.
 *
 * Values mirror the browser's `RTCPeerConnectionState` so they map 1:1 onto
 * the WebRTC peer connections introduced in a later phase — no translation
 * layer needed.
 */
export const ConnectionState = {
  New: "new",
  Connecting: "connecting",
  Connected: "connected",
  Disconnected: "disconnected",
  Failed: "failed",
  Closed: "closed",
} as const;

export type ConnectionState =
  (typeof ConnectionState)[keyof typeof ConnectionState];

/**
 * Participant lifecycle within a session (control-plane view).
 */
export const ParticipantState = {
  Joining: "joining",
  Active: "active",
  Muted: "muted",
  Left: "left",
} as const;

export type ParticipantState =
  (typeof ParticipantState)[keyof typeof ParticipantState];
