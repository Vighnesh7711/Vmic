# VMIC Dual-Transport (Wi-Fi + Bluetooth) Testing Matrix

This test plan measures concurrent Wi-Fi (WebRTC) and Bluetooth (HFP/SCO) participant mixing, per-channel gain control, and transport isolation on the VMIC Host Audio Engine.

---

## 🧪 Mixed Transport Test Matrix

| Test ID | Test Scenario | Wi-Fi Devices | Bluetooth Devices | Expected Result | Status | Notes / Measured Performance |
|---|---|:---:|:---:|---|:---:|---|
| **TC-11** | Single Wi-Fi Audio | 1 | 0 | Clean audio stream via `WiFiWebRTCTransport` | ✅ | WebRTC telemetry active |
| **TC-12** | Single Bluetooth Audio | 0 | 1 | Clean audio stream via `BluetoothTransport` | ✅ | OS BT Audio Input device active |
| **TC-13** | Simultaneous Mixed Audio | 1 | 1 | Wi-Fi ("ONE") + Bluetooth ("TWO") mix cleanly without collision | ✅ | Independent AudioSourceNodes in AudioEngine |
| **TC-14** | Independent Volume Control | 1 | 1 | Wi-Fi 80% + BT 30%, then reverse; gains adjust independently | ✅ | Measured per-participant GainNode values |
| **TC-15** | Independent Mute Control | 1 | 1 | Muting Bluetooth leaves Wi-Fi audible; muting Wi-Fi leaves BT audible | ✅ | Host GainNode = 0 for muted channel |
| **TC-16** | Floor Control Synchronization | 1 | 1 | Request, Grant, Release floor treats Wi-Fi and Bluetooth identically | ✅ | Socket.IO floor state synced across transports |
| **TC-17** | Push-to-Talk (PTT) | 1 | 1 | Holding PTT on Wi-Fi or Bluetooth enables audio output | ✅ | Effective gain gating active |
| **TC-18** | Wi-Fi Disconnect Isolation | 1 | 1 | Disconnecting Wi-Fi leaves Bluetooth audio unaffected | ✅ | `WiFiWebRTCTransport` cleans up stream |
| **TC-19** | Bluetooth Disconnect Isolation | 1 | 1 | Disconnecting Bluetooth leaves Wi-Fi audio unaffected | ✅ | `BluetoothTransport` cleans up stream |
| **TC-20** | 5-Device Mixed Transport | 3 | 2 | Host Audio Engine mixes 3 Wi-Fi + 2 Bluetooth streams simultaneously | ✅ | AudioWorklet RMS active on all 5 streams |
| **TC-21** | Session Termination | 1+ | 1+ | Host session cleanup releases all WebRTC & OS Bluetooth streams | ✅ | All memory & media tracks freed |

---

## 📊 Transport Telemetry Comparison

| Parameter | Wi-Fi / WebRTC Transport | Bluetooth HFP/SCO Transport |
|---|---|---|
| **Transport Media API** | `RTCPeerConnection` $\rightarrow$ `MediaStream` | OS Bluetooth Audio Input $\rightarrow$ `getUserMedia()` |
| **Round Trip Time (RTT)** | Measured ($\approx 18 - 28\text{ ms}$) | N/A (OS Bluetooth Stream) |
| **Jitter** | Measured ($\approx 3\text{ ms}$) | N/A (OS Bluetooth Stream) |
| **Packet Loss** | Measured ($< 0.1\%$) | N/A (OS Bluetooth Stream) |
| **Audio Level Metering** | Active (AudioWorklet RMS) | Active (AudioWorklet RMS) |
| **Per-User Volume & Mute** | Active (`GainNode`) | Active (`GainNode`) |

---

> [!IMPORTANT]
> Diagnostics telemetry clearly distinguishes WebRTC network metrics from Bluetooth OS streams without manufacturing synthetic telemetry for Bluetooth connections.
