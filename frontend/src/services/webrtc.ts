/**
 * VMIC Participant WebRTC Client — with Noise Gate
 *
 * FEEDBACK LOOP PREVENTION:
 *   The #1 problem in classroom wireless mic setups is the feedback loop:
 *     Phone mic → WebRTC → Host speaker → Phone mic picks it up → loop
 *
 *   Solution: A client-side NOISE GATE that silences the mic track unless
 *   the audio level exceeds a threshold (someone speaking directly into phone).
 *   The gate runs via Web Audio API on the participant's phone:
 *
 *     Raw Mic Stream
 *          ↓
 *     AnalyserNode (measures RMS level every 50ms)
 *          ↓
 *     If level > gateThreshold → GainNode = 1.0 (OPEN)
 *     If level < gateThreshold → GainNode = 0.0 (CLOSED)
 *          ↓
 *     MediaStreamDestination (gated stream sent to WebRTC)
 *
 *   This prevents the phone from re-transmitting ambient speaker output.
 */

export interface AudioProcessingConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** Noise gate threshold (0.0 – 1.0). Audio below this RMS level is silenced.
   *  Higher = more aggressive gate (only loud/close speech passes).
   *  Default 0.06 is tuned for phone held ~30cm from mouth. */
  gateThreshold: number;
  /** Gate hold time in ms. Keeps gate open this long after speech stops
   *  to avoid cutting off word endings. Default 250ms. */
  gateHoldMs: number;
}

const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  gateThreshold: 0.06,
  gateHoldMs: 250,
};

export class VMICWebRTC {

  private peerConnection:
    RTCPeerConnection | null = null;

  private localStream:
    MediaStream | null = null;

  /** The processed stream that goes to WebRTC (after noise gate) */
  private processedStream:
    MediaStream | null = null;

  private onIceCandidate:
    ((candidate: RTCIceCandidate) => void) | null = null;

  private audioConfig: AudioProcessingConfig;

  // Noise gate Web Audio nodes
  private gateContext: AudioContext | null = null;
  private gateAnalyser: AnalyserNode | null = null;
  private gateGain: GainNode | null = null;
  private gateTimerId: ReturnType<typeof setInterval> | null = null;
  private gateOpen = false;
  private gateHoldTimer: ReturnType<typeof setTimeout> | null = null;

  // Callback for UI level meter on participant side
  private onMicLevel: ((level: number, gateOpen: boolean) => void) | null = null;

  constructor(
    onIceCandidate?: (
      candidate: RTCIceCandidate
    ) => void,
    audioConfig?: Partial<AudioProcessingConfig>,
    onMicLevel?: (level: number, gateOpen: boolean) => void
  ) {
    this.onIceCandidate =
      onIceCandidate ?? null;
    this.audioConfig = { ...DEFAULT_AUDIO_CONFIG, ...audioConfig };
    this.onMicLevel = onMicLevel ?? null;
  }

  /**
   * Update audio processing settings at runtime.
   * Applies immediately to the active microphone track if one exists.
   */
  async setAudioProcessing(config: Partial<AudioProcessingConfig>) {
    this.audioConfig = { ...this.audioConfig, ...config };

    // Apply constraints to the live track if available
    const track = this.localStream?.getAudioTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          echoCancellation: this.audioConfig.echoCancellation,
          noiseSuppression: this.audioConfig.noiseSuppression,
          autoGainControl: this.audioConfig.autoGainControl,
        });
        console.log("[WebRTC] Audio constraints updated live:", this.audioConfig);
      } catch (err) {
        console.warn("[WebRTC] Could not apply live constraints:", err);
      }
    }
  }

  getAudioProcessingConfig(): AudioProcessingConfig {
    return { ...this.audioConfig };
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.gateAnalyser;
  }

  async initializeMicrophone() {

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Microphone access unavailable. " +
        "Mobile browsers require HTTPS for microphone permission. " +
        "Make sure you are accessing VMIC via https:// (not http://)."
      );
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // ── Echo Cancellation ──
          echoCancellation: { ideal: this.audioConfig.echoCancellation },

          // ── Noise Suppression ──
          noiseSuppression: { ideal: this.audioConfig.noiseSuppression },

          // ── Auto Gain Control ──
          autoGainControl: { ideal: this.audioConfig.autoGainControl },

          // ── Low-Latency Mono Voice ──
          channelCount: 1,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
        video: false,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";

      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error("Microphone permission was denied. Allow microphone access for this site in Chrome settings, then reload.");
      }

      if (name === "NotReadableError" || name === "AbortError") {
        throw new Error("The microphone is busy or unavailable. Close other apps or browser tabs using the microphone, then reload.");
      }

      throw new Error("Could not start the microphone. Check the phone microphone permission and try again.");
    }

    // Log actual constraints applied by browser
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      const settings = track.getSettings();
      console.log("[WebRTC] Microphone initialized:", {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
      });
    }

    // ── Build Noise Gate Pipeline ──
    this.processedStream = this.buildNoiseGate(this.localStream);

    return this.processedStream;
  }

  /**
   * Build a Web Audio noise gate that silences the mic unless
   * the RMS level exceeds the gate threshold.
   *
   * Raw Mic → Source → Analyser → GainNode → MediaStreamDestination
   *                     ↓ (level check every 50ms)
   *               if level < threshold → gain = 0 (CLOSED)
   *               if level ≥ threshold → gain = 1 (OPEN)
   */
  private buildNoiseGate(rawStream: MediaStream): MediaStream {
    // Create a low-latency AudioContext for the gate
    this.gateContext = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 48000,
    });

    const source = this.gateContext.createMediaStreamSource(rawStream);

    // Analyser for level detection
    this.gateAnalyser = this.gateContext.createAnalyser();
    this.gateAnalyser.fftSize = 256;
    this.gateAnalyser.smoothingTimeConstant = 0.3;

    // Gate gain node — 0 = closed (silent), 1 = open (pass audio)
    this.gateGain = this.gateContext.createGain();
    this.gateGain.gain.value = 0; // Start closed

    // Output destination that produces a new MediaStream
    const destination = this.gateContext.createMediaStreamDestination();

    // Wire: source → analyser → gateGain → destination
    source.connect(this.gateAnalyser);
    this.gateAnalyser.connect(this.gateGain);
    this.gateGain.connect(destination);

    // Start the gate monitoring loop (runs every 50ms)
    this.startGateMonitor();

    console.log(
      `[NoiseGate] Initialized: threshold=${this.audioConfig.gateThreshold}, ` +
      `holdMs=${this.audioConfig.gateHoldMs}`
    );

    return destination.stream;
  }

  /**
   * Gate monitor loop — checks mic level every 50ms and opens/closes the gate.
   */
  private startGateMonitor() {
    if (this.gateTimerId !== null) return;

    const dataBuffer = new Uint8Array(this.gateAnalyser?.fftSize ?? 256);

    this.gateTimerId = setInterval(() => {
      if (!this.gateAnalyser || !this.gateGain) return;

      // Read time-domain audio data
      this.gateAnalyser.getByteTimeDomainData(dataBuffer);

      // Calculate RMS level (0.0 – 1.0)
      let sum = 0;
      for (let i = 0; i < dataBuffer.length; i++) {
        const normalized = (dataBuffer[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataBuffer.length);

      // Notify UI of current level
      if (this.onMicLevel) {
        this.onMicLevel(rms, this.gateOpen);
      }

      if (rms >= this.audioConfig.gateThreshold) {
        // ── OPEN the gate ──
        if (!this.gateOpen) {
          this.gateOpen = true;
          this.gateGain.gain.setTargetAtTime(1.0, this.gateContext!.currentTime, 0.005);
          console.log(`[NoiseGate] OPEN (level=${rms.toFixed(3)})`);
        }

        // Reset hold timer — keep gate open while speaking
        if (this.gateHoldTimer !== null) {
          clearTimeout(this.gateHoldTimer);
          this.gateHoldTimer = null;
        }
      } else if (this.gateOpen && this.gateHoldTimer === null) {
        // ── Start hold countdown to CLOSE ──
        // Don't close immediately — wait holdMs to avoid cutting off word endings
        this.gateHoldTimer = setTimeout(() => {
          this.gateOpen = false;
          this.gateGain!.gain.setTargetAtTime(0.0, this.gateContext!.currentTime, 0.02);
          this.gateHoldTimer = null;
          console.log(`[NoiseGate] CLOSED (below threshold for ${this.audioConfig.gateHoldMs}ms)`);
        }, this.audioConfig.gateHoldMs);
      }
    }, 50); // Check every 50ms
  }

  private stopGateMonitor() {
    if (this.gateTimerId !== null) {
      clearInterval(this.gateTimerId);
      this.gateTimerId = null;
    }
    if (this.gateHoldTimer !== null) {
      clearTimeout(this.gateHoldTimer);
      this.gateHoldTimer = null;
    }
  }

  async createPeerConnection() {

    this.peerConnection =
      new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 1,
      });

    if (!this.processedStream) {
      await this.initializeMicrophone();
    }

    // Send the GATED stream (not raw mic) through WebRTC
    this.processedStream
      ?.getTracks()
      .forEach((track) => {
        this.peerConnection?.addTrack(
          track,
          this.processedStream!
        );
      });

    this.peerConnection.onicecandidate =
      (event) => {
        if (
          event.candidate &&
          this.onIceCandidate
        ) {
          this.onIceCandidate(
            event.candidate
          );
        }
      };

    this.peerConnection.onconnectionstatechange =
      () => {
        console.log(
          "[WebRTC] Connection:",
          this.peerConnection
            ?.connectionState
        );
      };

    this.peerConnection.oniceconnectionstatechange =
      () => {
        console.log(
          "[WebRTC] ICE:",
          this.peerConnection
            ?.iceConnectionState
        );
      };

    return this.peerConnection;
  }

  async createOffer() {

    if (!this.peerConnection) {
      throw new Error(
        "PeerConnection not initialized"
      );
    }

    const offer =
      await this.peerConnection.createOffer();

    await this.peerConnection.setLocalDescription(
      offer
    );

    return offer;
  }

  setMicrophoneMuted(muted: boolean) {
    // Mute the raw mic tracks
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    // Also force-close the gate when muted
    if (muted && this.gateGain && this.gateContext) {
      this.gateGain.gain.setTargetAtTime(0.0, this.gateContext.currentTime, 0.005);
      this.gateOpen = false;
    }
  }

  async setRemoteAnswer(
    answer: RTCSessionDescriptionInit
  ) {
    if (!this.peerConnection) {
      throw new Error(
        "PeerConnection not initialized"
      );
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }

  async addIceCandidate(
    candidate: RTCIceCandidateInit
  ) {
    if (!this.peerConnection) {
      throw new Error(
        "PeerConnection not initialized"
      );
    }

    await this.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  }

  close() {
    // Stop the noise gate
    this.stopGateMonitor();

    this.localStream
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    this.processedStream
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    this.gateContext?.close();

    this.peerConnection?.close();

    this.localStream = null;
    this.processedStream = null;
    this.peerConnection = null;
    this.gateContext = null;
    this.gateAnalyser = null;
    this.gateGain = null;
  }
}
