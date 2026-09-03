export type ConnectionType =
  | "wifi"
  | "bluetooth";

export type AudioTransportType =
  | "wifi"
  | "bluetooth";

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export type FloorState =
  | "none"
  | "requested"
  | "granted";

export type SpeakingMode =
  | "open"
  | "controlled";

export interface VMICParticipant {
  participantId: string;
  displayName: string;

  connectionType:
    ConnectionType;

  transport:
    AudioTransportType;

  connectionState:
    ConnectionState;

  volume: number;

  muted: boolean;

  audioLevel: number;

  speaking: boolean;

  floorState: FloorState;

  pushToTalkActive: boolean;
}
