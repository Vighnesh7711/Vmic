export type AudioTransportType =
  | "wifi"
  | "bluetooth";

export interface AudioTransportParticipant {
  participantId: string;
  transport: AudioTransportType;
}

export interface AudioTransport {

  readonly type:
    AudioTransportType;

  connect(
    participantId: string
  ): Promise<void>;

  disconnect(
    participantId: string
  ): Promise<void>;

  isConnected(
    participantId: string
  ): boolean;

}
