/**
 * VMIC Audio Engine — Host-Side DSP Pipeline
 *
 * Audio graph per participant:
 *
 *   MediaStreamSource
 *        ↓
 *   High-Pass Filter (120 Hz, removes low-freq rumble/hum)
 *        ↓
 *   Adaptive feedback reducer (three narrow notch filters + safety ducking)
 *        ↓
 *   Compressor (dynamic range compression for consistent volume)
 *        ↓
 *   Participant GainNode (per-participant volume + mute)
 *        ↓
 *      Mixer (sum of all participant gains)
 *        ↓
 *   Master GainNode
 *        ↓
 *   AudioContext.destination (speakers)
 *
 * Latency optimizations:
 *   - AudioContext created with { latencyHint: "interactive" } for smallest buffer
 *   - Analyser node has small fftSize (256) for fast metering
 *   - Chrome WebRTC decoder bug workaround (dummy HTMLAudioElement)
 */

export interface ParticipantAudioState {
  participantId: string;
  volume: number;
  muted: boolean;
  floorGranted: boolean;
  pushToTalkActive: boolean;
}

interface ParticipantAudioNodes {
  source: MediaStreamAudioSourceNode;
  highPassFilter: BiquadFilterNode;
  feedbackNotches: BiquadFilterNode[];
  feedbackAnalyser: AnalyserNode;
  feedbackWetGain: GainNode;
  feedbackDryGain: GainNode;
  feedbackDuckGain: GainNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  analyser: AnalyserNode;
  worklet?: AudioWorkletNode;
  dummyAudio: HTMLAudioElement;
  volume: number;
  muted: boolean;
  floorGranted: boolean;
  pushToTalkActive: boolean;
  lastRms: number;
}

export type AudioLevelCallback = (
  participantId: string,
  level: number
) => void;

export interface AudioEngineConfig {
  /** High-pass filter cutoff in Hz (default 120) */
  highPassCutoff: number;
  /** Compressor threshold in dB (default -24) */
  compressorThreshold: number;
  /** Compressor ratio (default 4) */
  compressorRatio: number;
  /** Compressor attack time in seconds (default 0.003) */
  compressorAttack: number;
  /** Compressor release time in seconds (default 0.25) */
  compressorRelease: number;
  /** Compressor knee in dB (default 10) */
  compressorKnee: number;
  /** Enable adaptive host-side feedback reduction. */
  feedbackReductionEnabled: boolean;
  /** Spectrum level (0-255) at which a sharp feedback peak is acted on. */
  feedbackDetectionThreshold: number;
  /** Maximum temporary attenuation while a feedback peak is detected, in dB. */
  feedbackDuckDb: number;
  /** How long the speaker output is muted after a feedback emergency, in ms. */
  feedbackOutputMuteMs: number;
}

const DEFAULT_ENGINE_CONFIG: AudioEngineConfig = {
  highPassCutoff: 120,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  compressorKnee: 10,
  feedbackReductionEnabled: true,
  feedbackDetectionThreshold: 185,
  feedbackDuckDb: -9,
  feedbackOutputMuteMs: 1000,
};

export class VMICAudioEngine {

  private audioContext: AudioContext | null = null;

  private mixer: GainNode | null = null;

  private mixerAnalyser: AnalyserNode | null = null;

  private masterGain: GainNode | null = null;

  private masterVolume = 1;

  private feedbackSafetyCutActive = false;

  private feedbackSafetyCutTimer: ReturnType<typeof setTimeout> | null = null;

  private workletLoaded = false;

  private speakingMode: "open" | "controlled" = "controlled";

  private config: AudioEngineConfig;

  private participants =
    new Map<
      string,
      ParticipantAudioNodes
    >();

  private levelCallback:
    AudioLevelCallback | null = null;

  private meterAnimationFrame:
    number | null = null;

  constructor(
    onAudioLevel?: AudioLevelCallback,
    config?: Partial<AudioEngineConfig>
  ) {

    this.levelCallback =
      onAudioLevel ?? null;
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  /**
   * Update DSP settings at runtime and reapply to all active participants.
   */
  updateConfig(config: Partial<AudioEngineConfig>) {
    this.config = { ...this.config, ...config };

    // Reapply filter settings to all active participants
    this.participants.forEach((nodes) => {
      nodes.highPassFilter.frequency.value = this.config.highPassCutoff;
      nodes.compressor.threshold.value = this.config.compressorThreshold;
      nodes.compressor.ratio.value = this.config.compressorRatio;
      nodes.compressor.attack.value = this.config.compressorAttack;
      nodes.compressor.release.value = this.config.compressorRelease;
      nodes.compressor.knee.value = this.config.compressorKnee;
      this.setFeedbackPathEnabled(nodes, this.config.feedbackReductionEnabled);
    });
  }

  private setFeedbackPathEnabled(nodes: ParticipantAudioNodes, enabled: boolean) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    nodes.feedbackWetGain.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.015);
    nodes.feedbackDryGain.gain.setTargetAtTime(enabled ? 0 : 1, now, 0.015);
  }

  getConfig(): AudioEngineConfig {
    return { ...this.config };
  }

  getMixerAnalyser(): AnalyserNode | null {
    return this.mixerAnalyser;
  }

  async initialize() {

    if (!this.audioContext) {

      // ── Low-Latency AudioContext ──
      // "interactive" hint requests the smallest hardware buffer size.
      // On most systems this gives ~5ms latency instead of the default ~20-40ms.
      this.audioContext =
        new AudioContext({
          latencyHint: "interactive",
          sampleRate: 48000,
        });

      console.log(
        `[AudioEngine] Created AudioContext: sampleRate=${this.audioContext.sampleRate}, ` +
        `baseLatency=${(this.audioContext.baseLatency * 1000).toFixed(1)}ms, ` +
        `outputLatency=${((this.audioContext.outputLatency ?? 0) * 1000).toFixed(1)}ms`
      );

      /*
       * Common mixer node
       */
      this.mixer =
        this.audioContext.createGain();

      this.mixerAnalyser =
        this.audioContext.createAnalyser();
      this.mixerAnalyser.fftSize = 256;
      this.mixerAnalyser.smoothingTimeConstant = 0.8;

      /*
       * Final master volume
       */
      this.masterGain =
        this.audioContext.createGain();

      /*
       * Initial master volume
       */
      this.masterGain.gain.value = 1.0;

      /*
       * Audio graph:
       *
       * Participant Gains
       *        ↓
       *      Mixer
       *        ↓
       *   Mixer Analyser
       *        ↓
       *   Master Gain
       *        ↓
       *     Speakers
       */

      this.mixer.connect(
        this.mixerAnalyser
      );

      this.mixerAnalyser.connect(
        this.masterGain
      );

      this.masterGain.connect(
        this.audioContext.destination
      );

      /* Load AudioWorklet module */
      try {
        await this.audioContext.audioWorklet.addModule(
          "/audio-worklets/vmic-processor.js"
        );
        this.workletLoaded = true;
        console.log("[AudioWorklet] Module loaded successfully");
      } catch (error) {
        console.warn(
          "[AudioWorklet] Module loading skipped/failed:",
          error
        );
      }

      if (this.meterAnimationFrame === null) {
        this.startMetering();
      }
    }


    if (
      this.audioContext.state ===
      "suspended"
    ) {

      await this.audioContext.resume();

    }

  }

  private startMetering() {

    const updateMeters = () => {

      this.participants.forEach(
        (nodes, participantId) => {

          const data =
            new Uint8Array(
              nodes.analyser.fftSize
            );

          nodes.analyser.getByteTimeDomainData(
            data
          );


          let sum = 0;


          for (
            let i = 0;
            i < data.length;
            i++
          ) {

            const normalized =
              (data[i] - 128) / 128;

            sum +=
              normalized *
              normalized;

          }


          const rms =
            Math.sqrt(
              sum / data.length
            );

          // ── Sudden Spike Suppressor (Transient Ducking) ──
          // If level jumps abruptly (>0.30 in 16ms), duck the gain to prevent explosion
          const deltaRms = rms - (nodes.lastRms || 0);
          nodes.lastRms = rms;

          if (deltaRms > 0.30 && this.audioContext) {
            const now = this.audioContext.currentTime;
            nodes.gain.gain.setTargetAtTime(0.15, now, 0.003); // Instant ducking
            nodes.gain.gain.setTargetAtTime(
              nodes.volume * (nodes.muted ? 0 : 1), now + 0.15, 0.1
            ); // Smooth recovery without unintentionally unmuting a participant
          }

          // ── Adaptive Pitch Spike Whistle Hunter (FFT Notch Filter) ──
          this.reduceFeedback(nodes);

          /*
           * Convert approximately
           * into 0–1 range.
           */

          const level =
            Math.min(
              1,
              rms * 3
            );


          if (this.levelCallback) {

            this.levelCallback(
              participantId,
              level
            );

          }

        }
      );


      this.meterAnimationFrame =
        requestAnimationFrame(
          updateMeters
        );

    };


    updateMeters();

  }

  private updateParticipantGain(participantId: string) {
    const p = this.participants.get(participantId);
    if (!p) return;

    const effectiveGain =
      p.volume *
      (p.muted ? 0 : 1);

    p.gain.gain.value = effectiveGain;

    console.log(
      `[Audio] ${participantId} effective gain: ${effectiveGain}`
    );
  }

  /** Tracks narrow, sustained peaks typical of microphone/speaker feedback. */
  private reduceFeedback(nodes: ParticipantAudioNodes) {
    if (!this.audioContext || !this.config.feedbackReductionEnabled) return;

    const spectrum = new Uint8Array(nodes.feedbackAnalyser.frequencyBinCount);
    nodes.feedbackAnalyser.getByteFrequencyData(spectrum);
    const binHz = this.audioContext.sampleRate / nodes.feedbackAnalyser.fftSize;
    const start = Math.max(1, Math.ceil(250 / binHz));
    const end = Math.min(spectrum.length - 2, Math.floor(7000 / binHz));
    const peaks: Array<{ bin: number; level: number }> = [];

    for (let bin = start; bin <= end; bin++) {
      const level = spectrum[bin];
      const neighbour = Math.max(spectrum[bin - 1], spectrum[bin + 1]);
      if (level >= this.config.feedbackDetectionThreshold && level - neighbour >= 12) {
        peaks.push({ bin, level });
      }
    }

    peaks.sort((a, b) => b.level - a.level);
    const selected = peaks.filter((peak, index, all) =>
      !all.slice(0, index).some((chosen) => Math.abs(chosen.bin - peak.bin) * binHz < 120)
    ).slice(0, nodes.feedbackNotches.length);
    const now = this.audioContext.currentTime;

    selected.forEach((peak, index) => {
      nodes.feedbackNotches[index].frequency.setTargetAtTime(peak.bin * binHz, now, 0.025);
    });

    // Duck briefly while a notch moves into place, preventing a ringing build-up.
    if (selected.length > 0) {
      const attenuation = Math.pow(10, this.config.feedbackDuckDb / 20);
      nodes.feedbackDuckGain.gain.setTargetAtTime(attenuation, now, 0.008);
      nodes.feedbackDuckGain.gain.setTargetAtTime(1, now + 0.12, 0.12);
      this.triggerFeedbackSafetyCut();
    }
  }

  /**
   * Break a speaker/microphone loop decisively. The adaptive filters continue
   * learning while the output is silent, then the configured volume returns.
   * The active flag prevents each animation frame from extending the mute.
   */
  private triggerFeedbackSafetyCut() {
    if (!this.audioContext || !this.masterGain || this.feedbackSafetyCutActive) return;

    this.feedbackSafetyCutActive = true;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, 0.004);
    console.warn(`[Feedback] Emergency output cut for ${this.config.feedbackOutputMuteMs}ms`);

    this.feedbackSafetyCutTimer = setTimeout(() => {
      if (!this.audioContext || !this.masterGain) return;
      const resumeAt = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(resumeAt);
      this.masterGain.gain.setTargetAtTime(this.masterVolume, resumeAt, 0.03);
      this.feedbackSafetyCutActive = false;
      this.feedbackSafetyCutTimer = null;
      console.info("[Feedback] Output restored after safety cut");
    }, this.config.feedbackOutputMuteMs);
  }

  async addParticipantStream(
    participantId: string,
    stream: MediaStream
  ) {

    await this.initialize();

    if (!this.audioContext) {
      return;
    }

    if (
      this.participants.has(
        participantId
      )
    ) {

      console.warn(
        `Audio source already exists: ${participantId}`
      );

      return;

    }

    // Chrome WebRTC Bug Fix: Attach stream to HTMLAudioElement to activate Chrome audio decoder pipeline
    const dummyAudio = document.createElement("audio");
    dummyAudio.srcObject = stream;
    dummyAudio.muted = true;
    dummyAudio.play().catch((err) => console.warn("[AudioEngine] Audio element play error:", err));

    const source =
      this.audioContext
        .createMediaStreamSource(
          stream
        );

    // ── High-Pass Filter ──
    // Removes low-frequency rumble, hum (AC/fan), and handling noise below cutoff.
    const highPassFilter =
      this.audioContext.createBiquadFilter();
    highPassFilter.type = "highpass";
    highPassFilter.frequency.value = this.config.highPassCutoff;
    highPassFilter.Q.value = 0.707; // Butterworth (maximally flat)

    // Three narrow notches can remove several feedback modes without broadly
    // colouring speech. The dry path below provides a click-free bypass.
    const feedbackNotches = Array.from({ length: 3 }, (_, index) => {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = "notch";
      filter.frequency.value = [1000, 2200, 3800][index];
      filter.Q.value = 18;
      return filter;
    });
    const feedbackAnalyser = this.audioContext.createAnalyser();
    feedbackAnalyser.fftSize = 2048;
    feedbackAnalyser.smoothingTimeConstant = 0.2;
    const feedbackWetGain = this.audioContext.createGain();
    const feedbackDryGain = this.audioContext.createGain();
    const feedbackDuckGain = this.audioContext.createGain();
    feedbackWetGain.gain.value = this.config.feedbackReductionEnabled ? 1 : 0;
    feedbackDryGain.gain.value = this.config.feedbackReductionEnabled ? 0 : 1;
    feedbackDuckGain.gain.value = 1;

    // ── Dynamics Compressor & Spike Limiter ──
    // Fast attack (1ms) clamps down on sudden transient feedback spikes
    const compressor =
      this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = this.config.compressorThreshold;
    compressor.ratio.value = this.config.compressorRatio;
    compressor.attack.value = this.config.compressorAttack;
    compressor.release.value = this.config.compressorRelease;
    compressor.knee.value = this.config.compressorKnee;

    const gain =
      this.audioContext
        .createGain();

    gain.gain.value = 1.0;

    const analyser =
      this.audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const worklet: AudioWorkletNode | undefined = undefined;

    // ── Signal Chain ──
    // source → highpass → analyser → adaptive notches → duck → compressor → gain → mixer
    //                                                     └→ analyser (metering)
    source.connect(highPassFilter);
    highPassFilter.connect(feedbackAnalyser);
    feedbackAnalyser.connect(feedbackNotches[0]);
    feedbackNotches.forEach((filter, index) => {
      if (index < feedbackNotches.length - 1) filter.connect(feedbackNotches[index + 1]);
    });
    feedbackNotches[feedbackNotches.length - 1].connect(feedbackDuckGain);
    feedbackDuckGain.connect(feedbackWetGain);
    feedbackWetGain.connect(compressor);
    highPassFilter.connect(feedbackDryGain);
    feedbackDryGain.connect(compressor);
    compressor.connect(gain);
    gain.connect(this.mixer!);
    gain.connect(analyser);

    const participantNodes: ParticipantAudioNodes = {
      source,
      highPassFilter,
      feedbackNotches,
      feedbackAnalyser,
      feedbackWetGain,
      feedbackDryGain,
      feedbackDuckGain,
      compressor,
      gain,
      analyser,
      worklet,
      dummyAudio,
      volume: 1.0,
      muted: false,
      floorGranted: false,
      pushToTalkActive: true,
      lastRms: 0,
    };

    this.participants.set(
      participantId,
      participantNodes
    );

    this.updateParticipantGain(participantId);

    console.log(
      `[Audio] Added participant: ${participantId} ` +
      `(highpass=${this.config.highPassCutoff}Hz, ` +
      `compressor threshold=${this.config.compressorThreshold}dB)`
    );

  }


  removeParticipant(
    participantId: string
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    nodes.source.disconnect();
    nodes.highPassFilter.disconnect();
    nodes.feedbackNotches.forEach((filter) => filter.disconnect());
    nodes.feedbackAnalyser.disconnect();
    nodes.feedbackWetGain.disconnect();
    nodes.feedbackDryGain.disconnect();
    nodes.feedbackDuckGain.disconnect();
    nodes.compressor.disconnect();
    nodes.gain.disconnect();
    nodes.analyser.disconnect();
    nodes.worklet?.disconnect();

    // Clean up the dummy audio element
    nodes.dummyAudio.pause();
    nodes.dummyAudio.srcObject = null;

    this.participants.delete(
      participantId
    );

    console.log(
      `[Audio] Removed participant: ${participantId}`
    );

  }


  setParticipantVolume(
    participantId: string,
    volume: number
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    const clamped =
      Math.max(
        0,
        Math.min(
          1,
          volume
        )
      );

    nodes.volume = clamped;

    this.updateParticipantGain(participantId);

  }


  muteParticipant(
    participantId: string
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    nodes.muted = true;

    this.updateParticipantGain(participantId);

  }


  unmuteParticipant(
    participantId: string,
    volume = 1
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    nodes.muted = false;
    nodes.volume = Math.max(0, Math.min(1, volume));

    this.updateParticipantGain(participantId);

  }

  setParticipantFloor(
    participantId: string,
    granted: boolean
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    nodes.floorGranted = granted;

    this.updateParticipantGain(participantId);

  }

  setParticipantPushToTalk(
    participantId: string,
    active: boolean
  ) {

    const nodes =
      this.participants.get(
        participantId
      );

    if (!nodes) {
      return;
    }

    nodes.pushToTalkActive = active;

    this.updateParticipantGain(participantId);

  }

  setSpeakingMode(mode: "open" | "controlled") {
    this.speakingMode = mode;
    this.participants.forEach((_, id) => this.updateParticipantGain(id));
  }


  setMasterVolume(
    volume: number
  ) {

    if (!this.masterGain) {
      return;
    }

    const clamped =
      Math.max(
        0,
        Math.min(
          1,
          volume
        )
      );

    this.masterVolume = clamped;
    if (!this.feedbackSafetyCutActive) {
      this.masterGain.gain.value = clamped;
    }

  }

  async getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      // Request audio permission briefly to unlock device labels and audiooutput sinks in browser security policy
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.warn("[AudioEngine] Could not prompt audio permission to unlock device labels:", e);
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audiooutput");
  }

  async setOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.audioContext) {
      await this.initialize();
    }
    if (!this.audioContext) return false;

    // Check if AudioContext supports setSinkId
    const ctx = this.audioContext as unknown as { setSinkId?: (id: string) => Promise<void> };
    if (typeof ctx.setSinkId === "function") {
      try {
        await ctx.setSinkId(deviceId);
        console.log(`[AudioEngine] Output sink set to: ${deviceId}`);
        return true;
      } catch (err) {
        console.error("[AudioEngine] Failed to setSinkId:", err);
        return false;
      }
    } else {
      console.warn("[AudioEngine] setSinkId not supported on this browser context.");
      return false;
    }
  }


  async playTestTone() {
    await this.initialize();
    if (!this.audioContext || !this.mixer) return;
    await this.audioContext.resume();

    const osc = this.audioContext.createOscillator();
    const toneGain = this.audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = 440;
    toneGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 1.0);

    osc.connect(toneGain);
    toneGain.connect(this.mixer);

    osc.start();
    osc.stop(this.audioContext.currentTime + 1.0);
    console.log("[AudioEngine] Test tone played through mixer.");
  }

  /**
   * Get current pipeline latency estimate in milliseconds.
   */
  getLatencyMs(): number {
    if (!this.audioContext) return 0;
    const base = this.audioContext.baseLatency ?? 0;
    const output = this.audioContext.outputLatency ?? 0;
    return (base + output) * 1000;
  }

  async resume() {
    await this.audioContext?.resume();
  }


  async suspend() {

    await this.audioContext?.suspend();

  }


  getParticipantIds(): string[] {

    return Array.from(
      this.participants.keys()
    );

  }


  close() {

    if (this.feedbackSafetyCutTimer !== null) {
      clearTimeout(this.feedbackSafetyCutTimer);
      this.feedbackSafetyCutTimer = null;
    }
    this.feedbackSafetyCutActive = false;

    if (this.meterAnimationFrame !== null) {
      cancelAnimationFrame(this.meterAnimationFrame);
      this.meterAnimationFrame = null;
    }

    this.participants.forEach(
      (nodes) => {

        nodes.source.disconnect();
        nodes.highPassFilter.disconnect();
        nodes.feedbackNotches.forEach((filter) => filter.disconnect());
        nodes.feedbackAnalyser.disconnect();
        nodes.feedbackWetGain.disconnect();
        nodes.feedbackDryGain.disconnect();
        nodes.feedbackDuckGain.disconnect();
        nodes.compressor.disconnect();
        nodes.gain.disconnect();
        nodes.analyser.disconnect();
        nodes.worklet?.disconnect();

        nodes.dummyAudio.pause();
        nodes.dummyAudio.srcObject = null;
      }
    );

    this.participants.clear();

    this.mixer?.disconnect();

    this.masterGain?.disconnect();

    this.audioContext?.close();

    this.audioContext = null;

    this.mixer = null;

    this.masterGain = null;

  }

}
