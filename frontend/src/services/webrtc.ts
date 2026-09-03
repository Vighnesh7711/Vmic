export class VMICWebRTC {

  private peerConnection:
    RTCPeerConnection | null = null;

  private localStream:
    MediaStream | null = null;

  private onIceCandidate:
    ((candidate: RTCIceCandidate) => void) | null = null;

  constructor(
    onIceCandidate?: (
      candidate: RTCIceCandidate
    ) => void
  ) {
    this.onIceCandidate =
      onIceCandidate ?? null;
  }

  async initializeMicrophone() {

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Microphone access unavailable. " +
        "Mobile browsers require HTTPS for microphone permission. " +
        "Make sure you are accessing VMIC via https:// (not http://)."
      );
    }

    this.localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

    return this.localStream;
  }

  async createPeerConnection() {

    this.peerConnection =
      new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

    if (!this.localStream) {
      await this.initializeMicrophone();
    }

    this.localStream
      ?.getTracks()
      .forEach((track) => {

        this.peerConnection?.addTrack(
          track,
          this.localStream!
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

    this.localStream
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    this.peerConnection?.close();

    this.localStream = null;
    this.peerConnection = null;
  }
}
