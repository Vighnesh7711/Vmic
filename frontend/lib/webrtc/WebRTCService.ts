/**
 * VoxMesh / Vmic — Dedicated WebRTC Audio Transport Service.
 *
 * Manages browser-to-browser peer connections for local Wi-Fi audio.
 * Audio bytes travel purely peer-to-peer over WebRTC (never through FastAPI,
 * WebSocket, or Redis).
 */

import { SignalingClient } from "../websocket/SignalingClient";
import {
  IceCandidatePayload,
  WebRTCAnswerPayload,
  WebRTCOfferPayload,
} from "../websocket/types";
import {
  PeerConnectionEntry,
  WebRTCEventType,
  WebRTCLogEvent,
  WebRTCServiceEvents,
} from "./types";

export class WebRTCService {
  private sessionId: string;
  private localParticipantId: string;
  private isHost: boolean;
  private signalingClient: SignalingClient;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnectionEntry> = new Map();
  private events: WebRTCServiceEvents;
  private unsubs: Array<() => void> = [];

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // Standard STUN for local Wi-Fi subnet discovery
    ],
    iceCandidatePoolSize: 2,
  };

  constructor(
    sessionId: string,
    localParticipantId: string,
    isHost: boolean,
    signalingClient: SignalingClient,
    events: WebRTCServiceEvents = {}
  ) {
    this.sessionId = sessionId;
    this.localParticipantId = localParticipantId;
    this.isHost = isHost;
    this.signalingClient = signalingClient;
    this.events = events;

    this.setupSignalingListeners();
  }

  private log(
    participantId: string,
    event: WebRTCEventType,
    details: Record<string, unknown> = {}
  ): void {
    const logEvent: WebRTCLogEvent = {
      timestamp: Date.now(),
      participantId,
      event,
      details,
    };
    this.events.onLog?.(logEvent);
  }

  /**
   * Attach local microphone MediaStream to be transmitted over WebRTC.
   */
  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;

    // Attach to existing peer connections if any
    this.peers.forEach((entry) => {
      stream.getAudioTracks().forEach((track) => {
        const senders = entry.peerConnection.getSenders();
        const hasTrack = senders.some((s) => s.track?.id === track.id);
        if (!hasTrack) {
          entry.peerConnection.addTrack(track, stream);
        }
      });
    });
  }

  /**
   * Subscribe to Phase 3 signaling messages (WEBRTC_OFFER, WEBRTC_ANSWER, ICE_CANDIDATE).
   */
  private setupSignalingListeners(): void {
    const unsubOffer = this.signalingClient.on<WebRTCOfferPayload>(
      "WEBRTC_OFFER",
      async (msg) => {
        if (msg.toParticipantId === this.localParticipantId) {
          await this.handleIncomingOffer(msg.fromParticipantId, msg.sdp);
        }
      }
    );

    const unsubAnswer = this.signalingClient.on<WebRTCAnswerPayload>(
      "WEBRTC_ANSWER",
      async (msg) => {
        if (msg.toParticipantId === this.localParticipantId) {
          await this.handleIncomingAnswer(msg.fromParticipantId, msg.sdp);
        }
      }
    );

    const unsubIce = this.signalingClient.on<IceCandidatePayload>(
      "ICE_CANDIDATE",
      async (msg) => {
        if (msg.toParticipantId === this.localParticipantId) {
          await this.handleIncomingIceCandidate(
            msg.fromParticipantId,
            msg.candidate
          );
        }
      }
    );

    this.unsubs.push(unsubOffer, unsubAnswer, unsubIce);
  }

  /**
   * Create and configure an RTCPeerConnection for a remote participant.
   */
  private createPeerConnection(remoteParticipantId: string): PeerConnectionEntry {
    let entry = this.peers.get(remoteParticipantId);
    if (entry) return entry;

    const pc = new RTCPeerConnection(WebRTCService.RTC_CONFIG);

    entry = {
      participantId: remoteParticipantId,
      peerConnection: pc,
      remoteStream: null,
      audioElement: null,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      reconnectAttempts: 0,
    };

    this.peers.set(remoteParticipantId, entry);

    // Attach local audio track if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // 1. Remote track reception
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const stream = remoteStream || new MediaStream([event.track]);
      entry!.remoteStream = stream;

      // Create audio element for host speaker playback
      if (typeof window !== "undefined") {
        if (!entry!.audioElement) {
          const audio = new Audio();
          audio.autoplay = true;
          audio.srcObject = stream;
          entry!.audioElement = audio;
        }
      }

      this.log(remoteParticipantId, "track_received", {
        kind: event.track.kind,
        label: event.track.label,
        streamId: stream.id,
      });

      this.events.onTrackReceived?.(remoteParticipantId, stream);
    };

    // 2. ICE Candidate gathering & forwarding
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.sendIceCandidate(
          this.sessionId,
          this.localParticipantId,
          remoteParticipantId,
          event.candidate.toJSON()
        );
        this.log(remoteParticipantId, "ice_candidate_sent", {
          candidate: event.candidate.candidate,
        });
      }
    };

    // 3. Connection state monitoring & logging
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      entry!.connectionState = state;

      this.log(remoteParticipantId, "connection_state_change", { state });
      this.events.onConnectionStateChange?.(remoteParticipantId, state);

      if (state === "failed") {
        this.handleConnectionFailure(remoteParticipantId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      entry!.iceConnectionState = state;

      this.log(remoteParticipantId, "ice_state_change", { state });
      this.events.onIceConnectionStateChange?.(remoteParticipantId, state);

      if (state === "disconnected" || state === "failed") {
        this.handleConnectionFailure(remoteParticipantId);
      }
    };

    pc.onicegatheringstatechange = () => {
      this.log(remoteParticipantId, "ice_gathering_change", {
        state: pc.iceGatheringState,
      });
    };

    return entry;
  }

  /**
   * Initiate a WebRTC connection to a remote participant by creating an SDP offer.
   */
  public async connectToPeer(remoteParticipantId: string): Promise<void> {
    const entry = this.createPeerConnection(remoteParticipantId);
    const pc = entry.peerConnection;

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      this.signalingClient.sendOffer(
        this.sessionId,
        this.localParticipantId,
        remoteParticipantId,
        offer.sdp || ""
      );

      this.log(remoteParticipantId, "offer_created", { sdpType: offer.type });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Failed to create offer");
      this.log(remoteParticipantId, "error", { error: error.message });
      this.events.onError?.(remoteParticipantId, error);
      throw error;
    }
  }

  /**
   * Handle an incoming SDP offer from a remote peer.
   */
  private async handleIncomingOffer(
    fromParticipantId: string,
    sdp: string
  ): Promise<void> {
    const entry = this.createPeerConnection(fromParticipantId);
    const pc = entry.peerConnection;

    try {
      this.log(fromParticipantId, "offer_received");
      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp })
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.signalingClient.sendAnswer(
        this.sessionId,
        this.localParticipantId,
        fromParticipantId,
        answer.sdp || ""
      );

      this.log(fromParticipantId, "answer_created", { sdpType: answer.type });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Failed to handle offer");
      this.log(fromParticipantId, "error", { error: error.message });
      this.events.onError?.(fromParticipantId, error);
    }
  }

  /**
   * Handle an incoming SDP answer from a remote peer.
   */
  private async handleIncomingAnswer(
    fromParticipantId: string,
    sdp: string
  ): Promise<void> {
    const entry = this.peers.get(fromParticipantId);
    if (!entry) {
      this.log(fromParticipantId, "error", {
        error: "Received answer for non-existent peer connection",
      });
      return;
    }

    try {
      this.log(fromParticipantId, "answer_received");
      await entry.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp })
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Failed to set remote answer");
      this.log(fromParticipantId, "error", { error: error.message });
      this.events.onError?.(fromParticipantId, error);
    }
  }

  /**
   * Handle incoming remote ICE candidates.
   */
  private async handleIncomingIceCandidate(
    fromParticipantId: string,
    candidateInit: RTCIceCandidateInit
  ): Promise<void> {
    const entry = this.peers.get(fromParticipantId);
    if (!entry) return;

    try {
      if (candidateInit && candidateInit.candidate) {
        await entry.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidateInit)
        );
        this.log(fromParticipantId, "ice_candidate_received", {
          candidate: candidateInit.candidate,
        });
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error("Failed to add ICE candidate");
      this.log(fromParticipantId, "error", { error: error.message });
    }
  }

  /**
   * Reconnection Trigger + Backoff Logic:
   * - Trigger: connectionState === "failed" or iceConnectionState === "disconnected" | "failed"
   * - Max attempts: 5
   * - Backoff delay: Math.min(10000, 1000 * Math.pow(1.5, attempt)) + Math.random() * 300
   */
  private handleConnectionFailure(participantId: string): void {
    const entry = this.peers.get(participantId);
    if (!entry) return;

    if (entry.reconnectAttempts >= WebRTCService.MAX_RECONNECT_ATTEMPTS) {
      this.log(participantId, "error", {
        error: `Max reconnect attempts (${WebRTCService.MAX_RECONNECT_ATTEMPTS}) exceeded`,
      });
      return;
    }

    entry.reconnectAttempts += 1;
    const attempt = entry.reconnectAttempts;
    const delay =
      Math.min(10000, 1000 * Math.pow(1.5, attempt)) + Math.random() * 300;

    this.log(participantId, "reconnect_scheduled", {
      attempt,
      delayMs: Math.round(delay),
    });

    setTimeout(async () => {
      this.log(participantId, "reconnect_attempt", { attempt });
      try {
        if (
          "restartIce" in entry.peerConnection &&
          typeof entry.peerConnection.restartIce === "function"
        ) {
          entry.peerConnection.restartIce();
        }
        await this.connectToPeer(participantId);
      } catch (err) {
        this.log(participantId, "error", {
          error: `Reconnect attempt ${attempt} failed`,
        });
      }
    }, delay);
  }

  /**
   * Disconnect a single peer connection.
   */
  public disconnectPeer(participantId: string): void {
    const entry = this.peers.get(participantId);
    if (entry) {
      if (entry.audioElement) {
        entry.audioElement.srcObject = null;
        entry.audioElement = null;
      }
      entry.peerConnection.close();
      this.peers.delete(participantId);
      this.events.onTrackRemoved?.(participantId);
      this.log(participantId, "track_ended");
    }
  }

  /**
   * Clean up all peer connections and signaling subscriptions.
   */
  public dispose(): void {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    this.peers.forEach((entry) => {
      if (entry.audioElement) {
        entry.audioElement.srcObject = null;
        entry.audioElement = null;
      }
      entry.peerConnection.close();
    });
    this.peers.clear();
  }

  public getPeer(participantId: string): PeerConnectionEntry | undefined {
    return this.peers.get(participantId);
  }

  public getAllPeers(): PeerConnectionEntry[] {
    return Array.from(this.peers.values());
  }
}
