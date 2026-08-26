# VMIC Native Android Bluetooth Transport Architecture

This document describes the Native Android Bluetooth client architecture for routing phone microphone streams to the Host VMIC Audio Engine.

---

## 🏗️ Architecture

```
                    ┌─────────────────────────┐
                    │  NATIVE ANDROID CLIENT  │
                    │                         │
                    │  AudioRecord (Mic)      │
                    │         ↓               │
                    │  Bluetooth SCO Profile  │
                    └───────────┬─────────────┘
                                │
                                │ Bluetooth HFP / SCO Audio Stream
                                ▼
                    ┌─────────────────────────┐
                    │    HOST LAPTOP OS       │
                    │                         │
                    │ Bluetooth Input Device  │
                    └───────────┬─────────────┘
                                │
                                │ mediaDevices.getUserMedia()
                                ▼
                    ┌─────────────────────────┐
                    │   BluetoothTransport    │
                    │ (VMIC Host Web Engine)  │
                    └───────────┬─────────────┘
                                │
                                ▼
                       Audio Source Adapter
                                │
                                ▼
                       Participant GainNode
                                │
                                ▼
                           AudioWorklet
                                │
                                ▼
                           Master Mixer
                                │
                                ▼
                            Speakers
```

---

## 🔑 Key Design Principles

1. **OS Bluetooth Audio Profile (Option A):** Uses standard Android Bluetooth SCO/HFP profiles. The laptop OS recognizes the phone as a Bluetooth Audio Input device.
2. **Unified Audio Engine Pipeline:** The Host Audio Engine treats Bluetooth input identically to WebRTC audio streams (`MediaStream` $\rightarrow$ `ParticipantGain` $\rightarrow$ `AudioWorklet` $\rightarrow$ `Mixer`).
3. **Transport Separation:** `BluetoothTransport` implements `AudioTransport`, ensuring the mixer is agnostic to whether audio originated over Wi-Fi/WebRTC or Bluetooth.
