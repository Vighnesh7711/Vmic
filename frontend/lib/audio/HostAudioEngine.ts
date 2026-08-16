/**
 * VoxMesh / Vmic — Host-Side Audio Engine.
 *
 * Implements the complete Web Audio API signal chain on the host:
 * Incoming WebRTC Streams -> MediaStreamAudioSourceNode (per participant) ->
 * per-participant GainNode -> AudioWorklet Mixer Node -> Compressor -> Limiter ->
 * Master GainNode -> audioContext.destination.
 *
 * Exposes real-time RMS metering and speaking state detection.
 */

import {
  HostAudioEngineEvents,
  ParticipantAudioTelemetry,
  ParticipantAudioTrack,
} from "./types";

export class HostAudioEngine {
  private audioContext: AudioContext | null = null;
  private mixerNode: AudioNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private masterAnalyserNode: AnalyserNode | null = null;

  private participants: Map<string, ParticipantAudioTrack> = new Map();
  private masterVolume: number = 1.0;
  private masterLevel: number = 0.0;
  private animationFrameId: number | null = null;
  private events: HostAudioEngineEvents;

  /** Speaking detection threshold (RMS value, ~ -34 dBFS) */
  public static readonly SPEAKING_THRESHOLD = 0.02;

  constructor(events: HostAudioEngineEvents = {}) {
    this.events = events;
  }

  /**
   * Instantiate AudioContext and construct the master processing chain once.
   * Never called repeatedly on React renders.
   */
  public async init(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== "closed") {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) {
      throw new Error("Web Audio API is not supported in this browser");
    }

    const ctx = new AudioCtx({ latencyHint: "interactive" });
    this.audioContext = ctx;

    // 1. Mixer Stage (AudioWorklet with fallback to summing junction)
    try {
      if (ctx.audioWorklet) {
        await ctx.audioWorklet.addModule(
          "/worklets/mixer-processor.js"
        );
        if (this.audioContext !== ctx || ctx.state === "closed") return;
        this.mixerNode = new AudioWorkletNode(
          ctx,
          "vmic-mixer-processor",
          {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
          }
        );
      } else {
        // Fallback summing junction
        this.mixerNode = ctx.createGain();
      }
    } catch (e) {
      if (this.audioContext !== ctx || ctx.state === "closed") return;
      this.mixerNode = ctx.createGain();
    }

    if (this.audioContext !== ctx || ctx.state === "closed" || !this.mixerNode) return;

    // 2. Dynamic Compressor (Gentle leveling)
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(
      -24,
      ctx.currentTime
    );
    this.compressorNode.knee.setValueAtTime(12, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(4, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(
      0.003,
      ctx.currentTime
    );
    this.compressorNode.release.setValueAtTime(
      0.25,
      ctx.currentTime
    );

    // 3. Brickwall Limiter (Fast attack to prevent digital clipping)
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(
      -2,
      ctx.currentTime
    );
    this.limiterNode.knee.setValueAtTime(0, ctx.currentTime);
    this.limiterNode.ratio.setValueAtTime(20, ctx.currentTime);
    this.limiterNode.attack.setValueAtTime(
      0.001,
      ctx.currentTime
    );
    this.limiterNode.release.setValueAtTime(
      0.05,
      ctx.currentTime
    );

    // 4. Master Gain Node
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(
      this.masterVolume,
      ctx.currentTime
    );

    // 5. Master VU Analyser
    this.masterAnalyserNode = ctx.createAnalyser();
    this.masterAnalyserNode.fftSize = 64;

    // Connect the master chain: Mixer -> Compressor -> Limiter -> Master Gain -> Analyser -> Destination
    this.mixerNode.connect(this.compressorNode);
    this.compressorNode.connect(this.limiterNode);
    this.limiterNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.masterAnalyserNode);
    this.masterAnalyserNode.connect(ctx.destination);

    this.startTelemetryPolling();
  }

  /**
   * Connect an incoming participant WebRTC MediaStream into the host signal chain.
   */
  public addParticipantStream(id: string, stream: MediaStream): void {
    if (!this.audioContext || !this.mixerNode) {
      console.warn("Cannot add participant stream before HostAudioEngine is initialized");
      return;
    }

    // Remove existing if already present
    if (this.participants.has(id)) {
      this.removeParticipantStream(id);
    }

    try {
      const sourceNode = this.audioContext.createMediaStreamSource(stream);
      const gainNode = this.audioContext.createGain();
      const analyserNode = this.audioContext.createAnalyser();
      analyserNode.fftSize = 64;

      gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Signal flow: Source -> Gain -> Analyser -> Mixer
      sourceNode.connect(gainNode);
      gainNode.connect(analyserNode);
      gainNode.connect(this.mixerNode);

      const track: ParticipantAudioTrack = {
        id,
        sourceNode,
        gainNode,
        analyserNode,
        volume: 1.0,
        isMuted: false,
        audioLevel: 0.0,
        isSpeaking: false,
        stream,
      };

      this.participants.set(id, track);
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error("Failed to add participant audio stream");
      this.events.onError?.(error);
    }
  }

  /**
   * Disconnect and remove a participant's audio graph.
   */
  public removeParticipantStream(id: string): void {
    const track = this.participants.get(id);
    if (!track) return;

    try {
      track.sourceNode.disconnect();
      track.gainNode.disconnect();
      track.analyserNode.disconnect();
    } catch (e) {
      console.warn(`Error disconnecting participant ${id} audio nodes:`, e);
    }

    this.participants.delete(id);
  }

  // -------------------------------------------------------------------------
  // Control Functions (Exact Signatures Required)
  // -------------------------------------------------------------------------

  /**
   * Set participant volume multiplier (0.0 to 2.0).
   */
  public setParticipantVolume(id: string, volume: number): void {
    const track = this.participants.get(id);
    if (!track || !this.audioContext) return;

    track.volume = Math.max(0, Math.min(2.0, volume));
    if (!track.isMuted) {
      track.gainNode.gain.setValueAtTime(
        track.volume,
        this.audioContext.currentTime
      );
    }
  }

  /**
   * Mute a participant's audio input.
   */
  public muteParticipant(id: string): void {
    const track = this.participants.get(id);
    if (!track || !this.audioContext) return;

    track.isMuted = true;
    track.gainNode.gain.setValueAtTime(0.0, this.audioContext.currentTime);
  }

  /**
   * Unmute a participant's audio input.
   */
  public unmuteParticipant(id: string): void {
    const track = this.participants.get(id);
    if (!track || !this.audioContext) return;

    track.isMuted = false;
    track.gainNode.gain.setValueAtTime(
      track.volume,
      this.audioContext.currentTime
    );
  }

  /**
   * Set master output volume (0.0 to 1.5).
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1.5, volume));
    if (this.masterGainNode && this.audioContext) {
      this.masterGainNode.gain.setValueAtTime(
        this.masterVolume,
        this.audioContext.currentTime
      );
    }
  }

  // -------------------------------------------------------------------------
  // Telemetry Polling (RMS Level & Speaking State)
  // -------------------------------------------------------------------------

  private startTelemetryPolling(): void {
    const sampleBuffer = new Float32Array(32);
    const masterBuffer = new Float32Array(32);

    const poll = () => {
      if (!this.audioContext || this.audioContext.state === "closed") return;

      const telemetrySnapshot: Record<string, ParticipantAudioTelemetry> = {};

      // 1. Calculate per-participant RMS levels and speaking states
      this.participants.forEach((track, id) => {
        track.analyserNode.getFloatTimeDomainData(sampleBuffer);
        let sumSquares = 0;
        for (let i = 0; i < sampleBuffer.length; i++) {
          sumSquares += sampleBuffer[i] * sampleBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / sampleBuffer.length);
        const level = track.isMuted ? 0.0 : Math.min(1.0, rms * 3.5); // Scaled for UI meter

        track.audioLevel = level;
        track.isSpeaking = !track.isMuted && rms >= HostAudioEngine.SPEAKING_THRESHOLD;

        telemetrySnapshot[id] = {
          id,
          volume: track.volume,
          isMuted: track.isMuted,
          audioLevel: track.audioLevel,
          isSpeaking: track.isSpeaking,
        };
      });

      // 2. Calculate master output RMS level
      if (this.masterAnalyserNode) {
        this.masterAnalyserNode.getFloatTimeDomainData(masterBuffer);
        let masterSum = 0;
        for (let i = 0; i < masterBuffer.length; i++) {
          masterSum += masterBuffer[i] * masterBuffer[i];
        }
        this.masterLevel = Math.min(1.0, Math.sqrt(masterSum / masterBuffer.length) * 3.5);
      }

      this.events.onTelemetryUpdate?.(telemetrySnapshot, this.masterLevel);
      this.animationFrameId = requestAnimationFrame(poll);
    };

    this.animationFrameId = requestAnimationFrame(poll);
  }

  public getMasterLevel(): number {
    return this.masterLevel;
  }

  public getParticipantState(id: string): ParticipantAudioTrack | undefined {
    return this.participants.get(id);
  }

  public getAllParticipants(): ParticipantAudioTrack[] {
    return Array.from(this.participants.values());
  }

  /**
   * Teardown AudioContext and stop metering loops on session end.
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.participants.forEach((track) => {
      try {
        track.sourceNode.disconnect();
        track.gainNode.disconnect();
        track.analyserNode.disconnect();
      } catch (e) {
        // ignore on dispose
      }
    });
    this.participants.clear();

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }
  }
}
