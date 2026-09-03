export type TransportPreference =
  | "auto"
  | "wifi"
  | "bluetooth";

export interface TransportAvailability {
  wifi: boolean;
  bluetooth: boolean;
}

export interface TransportSelectionResult {
  transport: "wifi" | "bluetooth";
  reason: string;
}

export class VMICTransportSelector {

  select(
    preference: TransportPreference,
    availability: TransportAvailability
  ): TransportSelectionResult {

    if (preference === "wifi") {
      if (!availability.wifi) {
        throw new Error("Wi-Fi transport unavailable on this device/network.");
      }
      return {
        transport: "wifi",
        reason: "Wi-Fi transport explicitly selected.",
      };
    }

    if (preference === "bluetooth") {
      if (!availability.bluetooth) {
        throw new Error("Bluetooth transport unavailable on this device.");
      }
      return {
        transport: "bluetooth",
        reason: "Bluetooth transport explicitly selected.",
      };
    }

    // AUTO policy: Wi-Fi WebRTC is primary low-latency choice; Bluetooth is fallback
    if (availability.wifi) {
      return {
        transport: "wifi",
        reason: "Wi-Fi available; selected as primary transport.",
      };
    }

    if (availability.bluetooth) {
      return {
        transport: "bluetooth",
        reason: "Wi-Fi unavailable; Bluetooth selected as fallback.",
      };
    }

    throw new Error("No supported audio transport available on this device.");
  }

}
