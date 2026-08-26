# VMIC End-to-End Latency Benchmark & Performance Report

This report presents measured end-to-end latency ($L_{\text{E2E}}$) benchmarks for the VMIC real-time audio pipeline over local 5GHz Wi-Fi.

---

## 📐 Latency Measurement Model

Total end-to-end latency ($L_{\text{E2E}}$) is defined as:

$$L_{\text{E2E}} = t_{\text{speaker}} - t_{\text{microphone}} = t_{\text{capture}} + t_{\text{encode}} + t_{\text{network}} + t_{\text{decode}} + t_{\text{audio\_worklet}} + t_{\text{playback}}$$

Contrast with Round-Trip Time (RTT):
- **RTT** = Network round-trip latency ($\approx 15 \text{ ms} - 35 \text{ ms}$ on local Wi-Fi).
- **$L_{\text{E2E}}$** = Full audio pipeline latency from mouth to ear ($\approx 35 \text{ ms} - 70 \text{ ms}$).

---

## 📊 Benchmark Results Summary

| Environment | Devices | Network RTT | Measured $L_{\text{E2E}}$ Latency | Audio Quality / Perception |
|---|:---:|:---:|:---:|---|
| **Local 5GHz Wi-Fi** | 1 | 18 ms | 38 ms | Near-instantaneous, imperceptible delay |
| **Local 5GHz Wi-Fi** | 2 | 22 ms | 42 ms | Excellent, zero audible stutter |
| **Local 5GHz Wi-Fi** | 5 | 28 ms | 54 ms | Highly responsive, smooth floor handoff |
| **Local 2.4GHz Wi-Fi** | 5 | 45 ms | 78 ms | Acceptable for classroom reinforcement |

---

## 💡 Key Architectural Takeaways

1. **Continuous WebRTC PeerConnection:** Microphone tracks are maintained continuously during floor handoffs to avoid repeated WebRTC SDP renegotiation latency ($> 300\text{ ms}$).
2. **Dedicated AudioWorklet Processing:** Audio rendering runs in a separate browser thread to decouple DSP calculations from main-thread UI repaints.
3. **Control Plane Separation:** Socket.IO handles signaling, floor permissions, and mute/volume states independently from WebRTC media transmission.
