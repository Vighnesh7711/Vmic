import {
  AudioTransport,
  AudioTransportType,
} from "./audio-transport";
import { VMICAudioEngine } from "../audio-engine";

export interface BluetoothAudioDevice {
  deviceId: string;
  label: string;
}

export class BluetoothTransport
  implements AudioTransport {

  readonly type:
    AudioTransportType =
      "bluetooth";

  private connectedParticipants =
    new Map<string, MediaStream>();

  async enumerateBluetoothDevices(): Promise<BluetoothAudioDevice[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Bluetooth Microphone (${device.deviceId.slice(0, 5)})`,
      }));
  }

  async connectBluetoothDevice(
    participantId: string,
    deviceId: string,
    audioEngine: VMICAudioEngine
  ): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.connectedParticipants.set(participantId, stream);

    await audioEngine.addParticipantStream(participantId, stream);

    console.log(
      `[BluetoothTransport] Connected Bluetooth stream for ${participantId} (device ${deviceId})`
    );

    return stream;
  }

  async connect(
    participantId: string
  ): Promise<void> {
    console.log(
      `[BluetoothTransport] Connection initiated for ${participantId}. Use connectBluetoothDevice with deviceId.`
    );
  }

  async disconnect(
    participantId: string
  ): Promise<void> {
    const stream = this.connectedParticipants.get(participantId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.connectedParticipants.delete(participantId);
    }
  }

  isConnected(
    participantId: string
  ): boolean {
    return this.connectedParticipants.has(participantId);
  }

}
