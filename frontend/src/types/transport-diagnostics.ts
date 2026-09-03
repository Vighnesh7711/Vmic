import { AudioTransportType } from "./participant";

export interface VMICTransportDiagnostics {
  participantId: string;

  transport: AudioTransportType;

  connectionState:
    | "connecting"
    | "connected"
    | "disconnected"
    | "failed";

  audioLevel: number;

  latencyMs: number | null;

  jitterMs: number | null;

  packetLoss: number | null;

  networkQuality:
    | "excellent"
    | "good"
    | "fair"
    | "poor"
    | "unknown";
}
