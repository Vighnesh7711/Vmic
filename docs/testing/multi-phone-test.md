# VMIC Multi-Phone Stress & Audio Diagnostics Testing Matrix

This test plan measures multi-participant WebRTC audio scaling, signaling stability, and telemetry accuracy across local Wi-Fi networks.

---

## 🧪 Test Matrix

| Test ID | Test Scenario | Devices | Expected Result | Status | Notes / Measured Metrics |
|---|---|:---:|---|:---:|---|
| **TC-01** | Basic Audio Path | 1 | Microphone stream reaches Host GainNode and speakers | ✅ | Clean audio output |
| **TC-02** | Simultaneous Audio Streams | 2 | Both audio streams mix independently without distortion | ✅ | Independent WebRTC PeerConnections |
| **TC-03** | Individual Mute Control | 2 | Muting Participant A leaves Participant B audible | ✅ | Host GainNode = 0 for A |
| **TC-04** | Individual Volume Control | 2 | Adjusting Volume A (30%) leaves Volume B (100%) unchanged | ✅ | Measured per-participant gain |
| **TC-05** | Floor Queue Order | 5 | Sequential requests populate queue correctly | ✅ | Queue populates (A -> B -> C -> D -> E) |
| **TC-06** | Simultaneous WebRTC Streams | 5 | Host Audio Engine processes 5 independent streams | ✅ | AudioWorklet RMS active on all 5 |
| **TC-07** | Graceful Disconnect | 5 | Sudden socket drop cleans up PeerConnection & Card | ✅ | `participant_left` removes GainNode |
| **TC-08** | Clean Reconnect | 5 | Rejoining participant creates fresh RTCPeerConnection | ✅ | No stale state reused |
| **TC-09** | Session Termination | 5 | Closing host session cleans up AudioContext & sockets | ✅ | All memory freed |
| **TC-10** | High-Load Stress Test | 10 | 10 concurrent streams remain stable on local Wi-Fi | ✅ | Target capacity 5–20 devices |

---

## 📊 WebRTC Diagnostics Telemetry Metrics

| Metric | Target / Benchmark | Description |
|---|---|---|
| **Round Trip Time (RTT)** | `< 50 ms` (Local Wi-Fi) | Network RTT measured via `candidate-pair` |
| **Jitter** | `< 10 ms` | Packet arrival variation measured via `inbound-rtp` |
| **Packet Loss** | `< 1.0 %` | Loss rate derived from $\frac{\text{PacketsLost}}{\text{PacketsReceived} + \text{PacketsLost}}$ |
| **Audio Level** | 0.0 – 1.0 RMS | Measured via AudioWorklet processor & AnalyserNode |

---

> [!NOTE]
> RTT represents network round-trip time and is distinct from total end-to-end audio latency ($L_{E2E}$), which includes capture, encoding, buffering, audio graph processing, and speaker playback.
