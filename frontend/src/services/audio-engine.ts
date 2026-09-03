export interface ParticipantAudioState {
  participantId: string;
  volume: number;
  muted: boolean;
  floorGranted: boolean;
  pushToTalkActive: boolean;
}

interface ParticipantAudioNodes {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  worklet?: AudioWorkletNode;
  volume: number;
  muted: boolean;
  floorGranted: boolean;
  pushToTalkActive: boolean;
}

export type AudioLevelCallback = (
  participantId: string,
  level: number
) => void;

export class VMICAudioEngine {

  private audioContext: AudioContext | null = null;

  private mixer: GainNode | null = null;

  private masterGain: GainNode | null = null;

  private workletLoaded = false;

  private speakingMode: "open" | "controlled" = "open";

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
    onAudioLevel?: AudioLevelCallback
  ) {

    this.levelCallback =
      onAudioLevel ?? null;

  }

  async initialize() {

    if (!this.audioContext) {

      this.audioContext =
        new AudioContext();

      /*
       * Common mixer node
       */
      this.mixer =
        this.audioContext.createGain();

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
       *   Master Gain
       *        ↓
       *     Speakers
       */

      this.mixer.connect(
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

    const floorAllowed =
      this.speakingMode === "open"
        ? true
        : p.floorGranted;

    const pttAllowed =
      this.speakingMode === "open"
        ? true
        : p.pushToTalkActive;

    const effectiveGain =
      p.volume *
      (p.muted ? 0 : 1) *
      (floorAllowed ? 1 : 0) *
      (pttAllowed ? 1 : 0);

    p.gain.gain.value = effectiveGain;

    console.log(
      `[Audio] ${participantId} effective gain: ${effectiveGain}`
    );
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

    const gain =
      this.audioContext
        .createGain();

    gain.gain.value = 1.0;

    const analyser =
      this.audioContext.createAnalyser();

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    let worklet: AudioWorkletNode | undefined = undefined;

    source.connect(gain);
    gain.connect(this.mixer!);
    gain.connect(analyser);

    const participantNodes: ParticipantAudioNodes = {
      source,
      gain,
      analyser,
      worklet,
      volume: 1.0,
      muted: false,
      floorGranted: true,
      pushToTalkActive: true,
    };

    this.participants.set(
      participantId,
      participantNodes
    );

    this.updateParticipantGain(participantId);

    console.log(
      `[Audio] Added participant: ${participantId}`
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

    nodes.gain.disconnect();

    nodes.analyser.disconnect();

    nodes.worklet?.disconnect();

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

    this.masterGain.gain.value =
      clamped;

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

    if (this.meterAnimationFrame !== null) {
      cancelAnimationFrame(this.meterAnimationFrame);
      this.meterAnimationFrame = null;
    }

    this.participants.forEach(
      (nodes) => {

        nodes.source.disconnect();
        nodes.gain.disconnect();
        nodes.analyser.disconnect();
        nodes.worklet?.disconnect();

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
