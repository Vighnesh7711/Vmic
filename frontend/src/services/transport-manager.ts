import {
  AudioTransport,
  AudioTransportType,
} from "./transports/audio-transport";
import { WiFiWebRTCTransport } from "./transports/wifi-webrtc-transport";
import { BluetoothTransport } from "./transports/bluetooth-transport";

export class VMICTransportManager {

  private transports =
    new Map<
      AudioTransportType,
      AudioTransport
    >();

  constructor(
    wifiTransport?: WiFiWebRTCTransport,
    bluetoothTransport?: BluetoothTransport
  ) {

    this.register(
      wifiTransport ?? new WiFiWebRTCTransport()
    );

    this.register(
      bluetoothTransport ?? new BluetoothTransport()
    );

  }

  register(
    transport: AudioTransport
  ) {

    this.transports.set(
      transport.type,
      transport
    );

  }

  get(
    type: AudioTransportType
  ): AudioTransport {

    const transport =
      this.transports.get(type);

    if (!transport) {
      throw new Error(
        `Transport not registered: ${type}`
      );
    }

    return transport;

  }

  getBluetoothTransport(): BluetoothTransport {
    return this.get("bluetooth") as BluetoothTransport;
  }

  getWiFiTransport(): WiFiWebRTCTransport {
    return this.get("wifi") as WiFiWebRTCTransport;
  }

}
