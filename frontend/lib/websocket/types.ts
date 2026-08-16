/**
 * VoxMesh / Vmic — WebSocket Signaling & Control Message Types (Frontend).
 *
 * Audio NEVER flows through these messages.
 */

export interface SignalingParticipant {
  id: string;
  displayName: string;
  role: "host" | "attendee";
  state: string;
  isMuted: boolean;
  hasFloor: boolean;
  joinedAt?: number;
}

export interface JoinRoomPayload {
  type: "JOIN_ROOM";
  sessionId: string;
  participantId: string;
  displayName: string;
  role?: "host" | "attendee";
}

export interface UserJoinedPayload {
  type: "USER_JOINED";
  sessionId: string;
  participant: SignalingParticipant;
}

export interface UserLeftPayload {
  type: "USER_LEFT";
  sessionId: string;
  participantId: string;
  reason?: string;
}

export interface WebRTCOfferPayload {
  type: "WEBRTC_OFFER";
  sessionId: string;
  fromParticipantId: string;
  toParticipantId: string;
  sdp: string;
}

export interface WebRTCAnswerPayload {
  type: "WEBRTC_ANSWER";
  sessionId: string;
  fromParticipantId: string;
  toParticipantId: string;
  sdp: string;
}

export interface IceCandidatePayload {
  type: "ICE_CANDIDATE";
  sessionId: string;
  fromParticipantId: string;
  toParticipantId: string;
  candidate: RTCIceCandidateInit;
}

export interface MutePayload {
  type: "MUTE";
  sessionId: string;
  participantId: string;
}

export interface UnmutePayload {
  type: "UNMUTE";
  sessionId: string;
  participantId: string;
}

export interface RequestFloorPayload {
  type: "REQUEST_FLOOR";
  sessionId: string;
  participantId: string;
}

export interface GrantFloorPayload {
  type: "GRANT_FLOOR";
  sessionId: string;
  participantId: string;
}

export interface ReleaseFloorPayload {
  type: "RELEASE_FLOOR";
  sessionId: string;
  participantId: string;
}

export interface SessionStartedPayload {
  type: "SESSION_STARTED";
  sessionId: string;
  startedAt?: number;
}

export interface SessionEndedPayload {
  type: "SESSION_ENDED";
  sessionId: string;
  endedAt?: number;
}

export type SignalingMessage =
  | JoinRoomPayload
  | UserJoinedPayload
  | UserLeftPayload
  | WebRTCOfferPayload
  | WebRTCAnswerPayload
  | IceCandidatePayload
  | MutePayload
  | UnmutePayload
  | RequestFloorPayload
  | GrantFloorPayload
  | ReleaseFloorPayload
  | SessionStartedPayload
  | SessionEndedPayload;

export type SignalingMessageType = SignalingMessage["type"];
