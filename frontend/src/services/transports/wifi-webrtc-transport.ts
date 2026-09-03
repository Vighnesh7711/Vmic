import {
  AudioTransport,
  AudioTransportType,
} from "./audio-transport";
import { VMICHostWebRTC } from "../host-webrtc";

export class WiFiWebRTCTransport
  implements AudioTransport {

  readonly type:
    AudioTransportType =
      "wifi";

  private connectedParticipants =
    new Set<string>();

  constructor(
    private hostWebRTC?: VMICHostWebRTC
  ) {}

  setHostWebRTC(hostWebRTC: VMICHostWebRTC) {
    this.hostWebRTC = hostWebRTC;
  }

  async connect(
    participantId: string
  ): Promise<void> {

    this.connectedParticipants.add(
      participantId
    );

  }

  async disconnect(
    participantId: string
  ): Promise<void> {

    if (this.hostWebRTC) {
      this.hostWebRTC.closeParticipant(
        participantId
      );
    }

    this.connectedParticipants.delete(
      participantId
    );

  }

  isConnected(
    participantId: string
  ): boolean {

    return this.connectedParticipants
      .has(participantId);

  }

}
