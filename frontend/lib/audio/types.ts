/**
 * VoxMesh / Vmic — Host Audio Engine Types.
 */

export interface ParticipantAudioTrack {
  id: string;
  sourceNode: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  volume: number; // 0.0 to 2.0 (default 1.0)
  isMuted: boolean;
  audioLevel: number; // 0.0 to 1.0 RMS meter
  isSpeaking: boolean; // audioLevel >= SPEAKING_THRESHOLD (0.02)
  stream: MediaStream;
}

export interface ParticipantAudioTelemetry {
  id: string;
  volume: number;
  isMuted: boolean;
  audioLevel: number;
  isSpeaking: boolean;
}

export interface HostAudioEngineEvents {
  onTelemetryUpdate?: (
    telemetry: Record<string, ParticipantAudioTelemetry>,
    masterLevel: number
  ) => void;
  onError?: (error: Error) => void;
}
