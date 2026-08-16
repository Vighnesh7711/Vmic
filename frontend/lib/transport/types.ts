/**
 * VoxMesh / Vmic — Transport Abstraction & Bridge Types.
 *
 * Provides a polymorphic interface for audio transport layers (Wi-Fi/WebRTC,
 * Bluetooth audio, and Native Android BLE/SCO bridges).
 */

export type TransportType = "wifi" | "bluetooth";

export interface TransportStats {
  transportType: TransportType;
  connectionState:
    | RTCPeerConnectionState
    | "disconnected"
    | "connected"
    | "connecting";
  /** Real measurement from WebRTC RTCStatsReport (currentRoundTripTime * 1000) or bridge; undefined if unsupported */
  latencyMs?: number;
  /** Real signal/network quality string (e.g. "-42dBm" or "0% Loss"); undefined if unsupported */
  signalQuality?: string;
  packetsLost?: number;
  bytesTransferred?: number;
}

export interface TransportEvents {
  onStateChange?: (peerId: string, state: string) => void;
  onRemoteTrack?: (peerId: string, stream: MediaStream) => void;
  onTrackRemoved?: (peerId: string) => void;
  onStatsUpdate?: (peerId: string, stats: TransportStats) => void;
  onError?: (peerId: string, error: Error) => void;
}

/**
 * Universal interface for audio transport implementations.
 */
export interface IAudioTransport {
  readonly transportType: TransportType;

  /** Initialize transport layer and optional local audio stream */
  init(localStream?: MediaStream): Promise<void>;

  /** Initiate connection to a remote peer or host node */
  connect(peerId: string): Promise<void>;

  /** Disconnect from a specific peer */
  disconnect(peerId: string): void;

  /** Set / update local audio media stream */
  setLocalStream(stream: MediaStream): void;

  /** Query real-time transport telemetry */
  getStats(peerId: string): Promise<TransportStats | null>;

  /** Clean up all transport resources */
  dispose(): void;
}

/**
 * Contract interface required for a Native Android companion app
 * to stream direct phone-to-phone Bluetooth/BLE audio into Vmic.
 */
export interface IVmicNativeBluetoothBridge {
  /** Check if Bluetooth adapter is enabled and supports LE Audio / SCO */
  isBluetoothAvailable(): Promise<boolean>;

  /** Start advertising local node descriptor over BLE / RFCOMM */
  startAdvertising(roomCode: string, nodeAlias: string): Promise<void>;

  /** Discover nearby host nodes */
  startDiscovery(): Promise<void>;

  /** Connect to remote host device MAC address */
  connectToDevice(macAddress: string): Promise<void>;

  /** Native audio stream hook (feeds PCM Float32 into Web Audio graph) */
  startNativeAudioCapture(sampleRate: number): void;
  stopNativeAudioCapture(): void;
}
