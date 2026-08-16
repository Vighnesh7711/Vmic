/**
 * VoxMesh / Vmic — Reusable SignalingClient Service.
 *
 * Provides a typed WebSocket abstraction for control-plane communication.
 * UI components must use this service rather than opening raw WebSockets.
 * Audio NEVER flows through this channel.
 */

import {
  SignalingMessage,
  SignalingMessageType,
  SignalingParticipant,
} from "./types";

type MessageHandler<T extends SignalingMessage> = (message: T) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private handlers: Map<SignalingMessageType, Set<MessageHandler<any>>> =
    new Map();
  private openResolvers: Array<() => void> = [];

  constructor(url?: string) {
    this.url =
      url ||
      process.env.NEXT_PUBLIC_WS_URL ||
      "ws://localhost:8000/ws";
  }

  public connect(customUrl?: string): Promise<void> {
    if (customUrl) this.url = customUrl;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve) => {
        this.openResolvers.push(resolve);
      });
    }

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(this.url);
        this.ws = socket;

        socket.onopen = () => {
          if (this.ws !== socket) return;
          this.isConnected = true;
          this.openResolvers.forEach((r) => r());
          this.openResolvers = [];
          resolve();
        };

        socket.onmessage = (event) => {
          try {
            const data: SignalingMessage = JSON.parse(event.data);
            if (data && data.type) {
              const callbacks = this.handlers.get(data.type);
              if (callbacks) {
                callbacks.forEach((cb) => cb(data));
              }
            }
          } catch (err) {
            console.error("Failed to parse signaling message:", err);
          }
        };

        socket.onerror = (err) => {
          if (this.ws === socket) {
            reject(err);
          }
        };

        socket.onclose = () => {
          if (this.ws === socket) {
            this.isConnected = false;
            this.ws = null;
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public on<T extends SignalingMessage>(
    type: T["type"],
    handler: MessageHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send signaling message, socket not open:", message);
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  // -------------------------------------------------------------------------
  // Control-plane operations
  // -------------------------------------------------------------------------

  public joinRoom(
    sessionId: string,
    participantId: string,
    displayName: string,
    role: "host" | "attendee" = "attendee"
  ): void {
    this.send({
      type: "JOIN_ROOM",
      sessionId,
      participantId,
      displayName,
      role,
    });
  }

  public leaveRoom(
    sessionId: string,
    participantId: string,
    reason: string = "normal"
  ): void {
    this.send({
      type: "USER_LEFT",
      sessionId,
      participantId,
      reason,
    });
  }

  public sendOffer(
    sessionId: string,
    fromParticipantId: string,
    toParticipantId: string,
    sdp: string
  ): void {
    this.send({
      type: "WEBRTC_OFFER",
      sessionId,
      fromParticipantId,
      toParticipantId,
      sdp,
    });
  }

  public sendAnswer(
    sessionId: string,
    fromParticipantId: string,
    toParticipantId: string,
    sdp: string
  ): void {
    this.send({
      type: "WEBRTC_ANSWER",
      sessionId,
      fromParticipantId,
      toParticipantId,
      sdp,
    });
  }

  public sendIceCandidate(
    sessionId: string,
    fromParticipantId: string,
    toParticipantId: string,
    candidate: RTCIceCandidateInit
  ): void {
    this.send({
      type: "ICE_CANDIDATE",
      sessionId,
      fromParticipantId,
      toParticipantId,
      candidate,
    });
  }

  public setMute(
    sessionId: string,
    participantId: string,
    muted: boolean
  ): void {
    if (muted) {
      this.send({ type: "MUTE", sessionId, participantId });
    } else {
      this.send({ type: "UNMUTE", sessionId, participantId });
    }
  }

  public requestFloor(sessionId: string, participantId: string): void {
    this.send({ type: "REQUEST_FLOOR", sessionId, participantId });
  }

  public grantFloor(sessionId: string, participantId: string): void {
    this.send({ type: "GRANT_FLOOR", sessionId, participantId });
  }

  public releaseFloor(sessionId: string, participantId: string): void {
    this.send({ type: "RELEASE_FLOOR", sessionId, participantId });
  }

  public startSession(sessionId: string): void {
    this.send({
      type: "SESSION_STARTED",
      sessionId,
      startedAt: Date.now(),
    });
  }

  public endSession(sessionId: string): void {
    this.send({
      type: "SESSION_ENDED",
      sessionId,
      endedAt: Date.now(),
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}
