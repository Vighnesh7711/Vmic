/**
 * VoxMesh / Vmic — AudioClient Abstraction.
 *
 * Encapsulates client-side microphone capture, Web Audio API analysis,
 * gain control, and local PTT state.
 *
 * NOTE: Peer-to-peer WebRTC transport is explicitly stubbed and will be
 * wired in Phase 4.
 */

export interface AudioConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  deviceId?: string;
}

export type AudioClientState =
  | "uninitialized"
  | "requesting_permission"
  | "permission_denied"
  | "ready"
  | "transmitting"
  | "muted"
  | "error";

export interface AudioClientEvents {
  onStateChange?: (state: AudioClientState) => void;
  onVolumeChange?: (volume: number) => void; // 0.0 - 1.0 live meter
  onError?: (error: Error) => void;
}

export interface IAudioClient {
  /** Request mic permission and initialize local MediaStream */
  initialize(constraints?: Partial<AudioConstraints>): Promise<MediaStream>;

  /** Start transmission / PTT hold (STUB: audio transport wired in Phase 4) */
  startTransmission(): void;

  /** Stop transmission / release PTT */
  stopTransmission(): void;

  /** Toggle self-mute */
  setMuted(muted: boolean): void;

  /** Update microphone input gain (0.0 to 2.0) */
  setGain(gain: number): void;

  /** Clean up audio context and media tracks */
  dispose(): void;

  /** Getters */
  getState(): AudioClientState;
  getMediaStream(): MediaStream | null;
  isMuted(): boolean;
}

export class AudioClient implements IAudioClient {
  private state: AudioClientState = "uninitialized";
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isSelfMuted: boolean = false;
  private animationFrameId: number | null = null;
  private events: AudioClientEvents;

  public static readonly DEFAULT_CONSTRAINTS: AudioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true, // Selected for consistent mobile vocal levels
  };

  constructor(events: AudioClientEvents = {}) {
    this.events = events;
  }

  private setState(newState: AudioClientState): void {
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  /**
   * Request microphone access and setup Web Audio processing graph.
   */
  public async initialize(
    constraints?: Partial<AudioConstraints>
  ): Promise<MediaStream> {
    const finalConstraints: AudioConstraints = {
      ...AudioClient.DEFAULT_CONSTRAINTS,
      ...constraints,
    };

    try {
      this.setState("requesting_permission");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: finalConstraints.echoCancellation,
          noiseSuppression: finalConstraints.noiseSuppression,
          autoGainControl: finalConstraints.autoGainControl,
          ...(finalConstraints.deviceId
            ? { deviceId: { exact: finalConstraints.deviceId } }
            : {}),
        },
        video: false,
      });

      this.mediaStream = stream;

      // Initialize Web Audio graph for local metering and gain
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.sourceNode = this.audioContext.createMediaStreamSource(stream);
        this.gainNode = this.audioContext.createGain();
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 64;

        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);

        this.startMeterPolling();
      }

      this.setState("ready");
      return stream;
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error("Failed to access microphone");
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        this.setState("permission_denied");
      } else {
        this.setState("error");
      }
      this.events.onError?.(error);
      throw error;
    }
  }

  /**
   * Start local PTT audio transmission.
   */
  public startTransmission(): void {
    if (this.state !== "ready" && this.state !== "muted") return;
    if (this.isSelfMuted) return;

    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(console.error);
    }

    // Enable tracks
    this.mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });

    // STUB: Real peer-to-peer WebRTC audio transport wired in Phase 4
    this.setState("transmitting");
  }

  /**
   * Stop local PTT audio transmission.
   */
  public stopTransmission(): void {
    if (this.state !== "transmitting") return;

    // In PTT mode, mute track when not holding button
    this.mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });

    // STUB: Stop WebRTC stream frame push
    this.setState(this.isSelfMuted ? "muted" : "ready");
  }

  /**
   * Self-mute toggle.
   */
  public setMuted(muted: boolean): void {
    this.isSelfMuted = muted;
    if (muted && this.state === "transmitting") {
      this.stopTransmission();
    }
    this.setState(muted ? "muted" : "ready");
  }

  /**
   * Adjust mic input gain multiplier (e.g. 0.0 - 2.0).
   */
  public setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        Math.max(0, gain),
        this.audioContext?.currentTime || 0
      );
    }
  }

  private startMeterPolling(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const poll = () => {
      if (!this.analyserNode || this.state === "uninitialized") return;

      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedVolume = Math.min(1.0, average / 128); // 0.0 to 1.0

      this.events.onVolumeChange?.(normalizedVolume);
      this.animationFrameId = requestAnimationFrame(poll);
    };

    this.animationFrameId = requestAnimationFrame(poll);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    this.setState("uninitialized");
  }

  public getState(): AudioClientState {
    return this.state;
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public isMuted(): boolean {
    return this.isSelfMuted;
  }
}
