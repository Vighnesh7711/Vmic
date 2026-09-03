"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { getSocket } from "@/services/socket";
import { VMICHostWebRTC } from "@/services/host-webrtc";
import { VMICAudioEngine } from "@/services/audio-engine";
import { VMICParticipant, SpeakingMode, AudioTransportType } from "@/types/participant";
import { VMICWebRTCStats } from "@/types/webrtc-stats";
import { VMICTransportManager } from "@/services/transport-manager";
import { WiFiWebRTCTransport } from "@/services/transports/wifi-webrtc-transport";
import { BluetoothTransport, BluetoothAudioDevice } from "@/services/transports/bluetooth-transport";
import { ParticipantCard } from "@/components/participant/participant-card";
import { SOCKET_EVENTS } from "@/lib/socket-events";
import { getFrontendUrl } from "@/lib/config";

export default function HostSessionPage() {

  const [socket] = useState(
    () => getSocket()
  );

  const [participants, setParticipants] =
    useState<VMICParticipant[]>([]);

  const [diagnostics, setDiagnostics] = useState<Map<string, VMICWebRTCStats>>(
    new Map()
  );

  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothAudioDevice[]>([]);
  const [selectedBtDevice, setSelectedBtDevice] = useState<string>("");
  const [targetBtParticipant, setTargetBtParticipant] = useState<string>("");

  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>("");

  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [speakerQueue, setSpeakerQueue] = useState<string[]>([]);
  const [speakingMode, setSpeakingMode] = useState<SpeakingMode>("open");
  const [roomCode, setRoomCode] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");

  const [audioEngine] = useState(
    () =>
      new VMICAudioEngine(
        (
          participantId,
          level
        ) => {

          setParticipants(
            (current) =>
              current.map(
                (participant) =>
                  participant
                    .participantId ===
                  participantId
                    ? {
                        ...participant,

                        audioLevel:
                          level,

                        speaking:
                          level >
                          0.08,
                      }
                    : participant
              )
          );

        }
      )
  );

  const [hostWebRTC] =
    useState(
      () =>
        new VMICHostWebRTC(
          (participantId, candidate) => {
            const roomCode = localStorage.getItem("vmic-host-room");
            if (!roomCode) return;

            socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, {
              room_code: roomCode,
              participant_id: participantId,
              candidate: candidate.toJSON(),
            });
          },
          (participantId, stream) => {
            audioEngine
              .addParticipantStream(participantId, stream)
              .catch((error) => {
                console.error("[Audio] Failed to add stream:", error);
              });
          },
          (participantId, state) => {
            let connectionState: VMICParticipant["connectionState"];
            switch (state) {
              case "connected":
                connectionState = "connected";
                break;
              case "failed":
                connectionState = "failed";
                break;
              case "disconnected":
                connectionState = "disconnected";
                break;
              default:
                connectionState = "connecting";
            }

            setParticipants((current) =>
              current.map((participant) =>
                participant.participantId === participantId
                  ? { ...participant, connectionState }
                  : participant
              )
            );
          },
          (stats) => {
            setDiagnostics((current) => {
              const updated = new Map(current);
              updated.set(stats.participantId, stats);
              return updated;
            });
          }
        )
    );

  const [bluetoothTransport] = useState(
    () => new BluetoothTransport()
  );

  const [wifiTransport] = useState(
    () => new WiFiWebRTCTransport(hostWebRTC)
  );

  const [transportManager] = useState(
    () => new VMICTransportManager(wifiTransport, bluetoothTransport)
  );

  const [status, setStatus] =
    useState("Waiting for participants");

  useEffect(() => {
    const code = localStorage.getItem("vmic-host-room") || "K7A2P9";
    setRoomCode(code);
    setJoinUrl(`${getFrontendUrl()}/join?room=${code}`);

    if (code) {
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, {
        room_code: code,
        role: "host",
      });
    }

    // Auto-discover connected Bluetooth Speakers / Output Sinks
    handleScanOutputDevices();

    const handleOffer = async (data: { participant_id: string; sdp: string }) => {
      try {
        const answer = await hostWebRTC.handleOffer(data.participant_id, data.sdp);
        socket.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
          room_code: code,
          participant_id: data.participant_id,
          sdp: answer.sdp,
        });

        wifiTransport.connect(data.participant_id);
        setStatus(`Answer sent to ${data.participant_id}`);
      } catch (error) {
        console.error("[Host WebRTC] Error:", error);
        setStatus("WebRTC negotiation failed");
      }
    };

    const handleIceCandidate = async (data: { participant_id: string; candidate: RTCIceCandidateInit }) => {
      await hostWebRTC.addIceCandidate(data.participant_id, data.candidate);
    };

    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);

    return () => {
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
      socket.off(SOCKET_EVENTS.ICE_CANDIDATE, handleIceCandidate);
    };
  }, [socket, hostWebRTC, wifiTransport]);

  /* Listen for participant_joined */
  useEffect(() => {
    const handleParticipantJoined = (data: {
      participant: {
        participant_id: string;
        display_name: string;
        transport?: string;
        volume?: number;
        muted?: boolean;
      };
    }) => {
      const p = data.participant;
      const transportType: AudioTransportType =
        (p.transport?.toLowerCase() as AudioTransportType) || "wifi";

      setParticipants((current) => {
        const exists = current.some(
          (participant) => participant.participantId === p.participant_id
        );
        if (exists) return current;

        return [
          ...current,
          {
            participantId: p.participant_id,
            displayName: p.display_name || `Participant ${p.participant_id.slice(0, 6)}`,
            connectionType: transportType,
            transport: transportType,
            connectionState: "connecting",
            volume: p.volume !== undefined ? Math.round(p.volume * 100) : 100,
            muted: p.muted ?? false,
            audioLevel: 0,
            speaking: false,
            floorState: "none",
            pushToTalkActive: false,
          },
        ];
      });
    };

    socket.on(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);

    return () => {
      socket.off(SOCKET_EVENTS.PARTICIPANT_JOINED, handleParticipantJoined);
    };
  }, [socket]);

  /* Listen for participant_left */
  useEffect(() => {
    const handleParticipantLeft = async (data: { participant_id: string }) => {
      const participantId = data.participant_id;
      const participant = participants.find((p) => p.participantId === participantId);
      const transportType = participant?.transport || "wifi";

      try {
        const transport = transportManager.get(transportType);
        await transport.disconnect(participantId);
      } catch (err) {
        console.warn("[TransportManager] Disconnect error:", err);
      }

      audioEngine.removeParticipant(participantId);

      setDiagnostics((current) => {
        const updated = new Map(current);
        updated.delete(participantId);
        return updated;
      });

      setParticipants((current) =>
        current.filter((p) => p.participantId !== participantId)
      );
    };

    socket.on(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);

    return () => {
      socket.off(SOCKET_EVENTS.PARTICIPANT_LEFT, handleParticipantLeft);
    };
  }, [socket, audioEngine, transportManager, participants]);

  /* Listen for floor_updated */
  useEffect(() => {
    const handleFloorUpdated = (data: {
      current_speaker: string | null;
      queue: string[];
    }) => {
      setCurrentSpeaker(data.current_speaker);
      setSpeakerQueue(data.queue);

      setParticipants((current) =>
        current.map((p) => {
          let floorState: VMICParticipant["floorState"] = "none";
          const isGranted = p.participantId === data.current_speaker;

          if (isGranted) {
            floorState = "granted";
          } else if (data.queue.includes(p.participantId)) {
            floorState = "requested";
          }

          audioEngine.setParticipantFloor(p.participantId, isGranted);

          return { ...p, floorState };
        })
      );
    };

    socket.on(SOCKET_EVENTS.FLOOR_UPDATED, handleFloorUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.FLOOR_UPDATED, handleFloorUpdated);
    };
  }, [socket, audioEngine]);

  /* Listen for push_to_talk_updated */
  useEffect(() => {
    const handlePTTUpdated = (data: { participant_id: string; active: boolean }) => {
      audioEngine.setParticipantPushToTalk(data.participant_id, data.active);

      setParticipants((current) =>
        current.map((p) =>
          p.participantId === data.participant_id
            ? { ...p, pushToTalkActive: data.active }
            : p
        )
      );
    };

    socket.on(SOCKET_EVENTS.PUSH_TO_TALK_UPDATED, handlePTTUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.PUSH_TO_TALK_UPDATED, handlePTTUpdated);
    };
  }, [socket, audioEngine]);

  const handleScanBluetoothDevices = async () => {
    try {
      const devices = await bluetoothTransport.enumerateBluetoothDevices();
      setBluetoothDevices(devices);
      if (devices.length > 0) {
        setSelectedBtDevice(devices[0].deviceId);
      }
    } catch (err) {
      console.error("Failed to scan Bluetooth devices:", err);
    }
  };

  const handleConnectBluetoothAudio = async () => {
    if (!selectedBtDevice || !targetBtParticipant) {
      alert("Please select both a Bluetooth device and a participant.");
      return;
    }

    try {
      await bluetoothTransport.connectBluetoothDevice(
        targetBtParticipant,
        selectedBtDevice,
        audioEngine
      );

      setParticipants((current) =>
        current.map((p) =>
          p.participantId === targetBtParticipant
            ? { ...p, connectionType: "bluetooth", transport: "bluetooth", connectionState: "connected" }
            : p
        )
      );

      alert(`Successfully connected Bluetooth audio to participant!`);
    } catch (err) {
      console.error("Bluetooth connection error:", err);
      alert("Failed to connect Bluetooth audio device.");
    }
  };

  const handleMute = (participantId: string) => {
    setParticipants((current) =>
      current.map((p) => {
        if (p.participantId === participantId) {
          const nextMuted = !p.muted;

          if (nextMuted) {
            audioEngine.muteParticipant(participantId);
            socket.emit(SOCKET_EVENTS.MUTE_PARTICIPANT, { participant_id: participantId });
          } else {
            audioEngine.unmuteParticipant(participantId, p.volume / 100);
            socket.emit(SOCKET_EVENTS.UNMUTE_PARTICIPANT, { participant_id: participantId });
          }

          return { ...p, muted: nextMuted };
        }
        return p;
      })
    );
  };

  const handleVolumeChange = (participantId: string, volume: number) => {
    audioEngine.setParticipantVolume(participantId, volume / 100);
    socket.emit(SOCKET_EVENTS.SET_PARTICIPANT_VOLUME, {
      participant_id: participantId,
      volume: volume / 100,
    });

    setParticipants((current) =>
      current.map((p) =>
        p.participantId === participantId ? { ...p, volume } : p
      )
    );
  };

  const handleGrantFloor = (participantId: string) => {
    socket.emit(SOCKET_EVENTS.GRANT_FLOOR, { participant_id: participantId });
  };

  const handleReleaseFloor = (participantId: string) => {
    socket.emit(SOCKET_EVENTS.RELEASE_FLOOR, { participant_id: participantId });
  };

  const toggleSpeakingMode = () => {
    const nextMode = speakingMode === "controlled" ? "open" : "controlled";
    setSpeakingMode(nextMode);
    audioEngine.setSpeakingMode(nextMode);
  };

  const handleScanOutputDevices = async () => {
    await audioEngine.initialize();
    const devices = await audioEngine.getAudioOutputDevices();
    setOutputDevices(devices);
    if (devices.length > 0 && !selectedOutputDevice) {
      setSelectedOutputDevice(devices[0].deviceId);
    }
  };

  const handleSelectOutputDevice = async (deviceId: string) => {
    setSelectedOutputDevice(deviceId);
    await audioEngine.setOutputDevice(deviceId);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 py-12 text-white">

      <div className="w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">

        <h1 className="text-2xl font-bold text-green-400">
          VMIC Host Dashboard
        </h1>

        {/* QR Code Joining Panel */}
        {joinUrl && (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl bg-gray-950 border border-gray-800 p-6">
            <div className="rounded-xl bg-white p-3 shadow-lg">
              <QRCodeSVG value={joinUrl} size={180} />
            </div>

            <div className="mt-4 text-center">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                SCAN WITH MOBILE CAMERA TO JOIN
              </span>
              <p className="mt-1 text-lg font-mono font-bold text-green-400">
                ROOM CODE: {roomCode}
              </p>
              <p className="mt-1 text-xs text-gray-400 font-mono break-all">
                {joinUrl}
              </p>
            </div>
          </div>
        )}

        <p className="mt-4 text-gray-400 text-sm">
          {status}
        </p>

        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-sm text-gray-400">Speaking Mode:</span>
          <button
            onClick={toggleSpeakingMode}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition ${
              speakingMode === "open"
                ? "bg-green-500 text-black"
                : "bg-blue-500 text-white"
            }`}
          >
            {speakingMode} Floor Mode
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          Connected Participants: {participants.length}
        </p>

        {currentSpeaker && (
          <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm text-blue-400">
            Current Speaker: <span className="font-bold">{currentSpeaker}</span>
          </div>
        )}

        {speakerQueue.length > 0 && (
          <p className="mt-2 text-xs text-yellow-400">
            Queue ({speakerQueue.length}): {speakerQueue.join(", ")}
          </p>
        )}

      </div>

      {/* Host Audio Output Speaker Router (Bluetooth / External Speaker) */}
      <div className="mt-6 w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-md text-green-400">
            🔊 Classroom Audio Output Device (Speakers / BT Speaker)
          </span>
          <button
            onClick={handleScanOutputDevices}
            className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/20"
          >
            SCAN OUTPUT DEVICES
          </button>
        </div>

        {outputDevices.length > 0 ? (
          <div className="mt-3 text-xs">
            <label className="block text-gray-400 mb-1">Target Audio Output Sink:</label>
            <select
              value={selectedOutputDevice}
              onChange={(e) => handleSelectOutputDevice(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 p-2.5 text-white font-mono"
            >
              {outputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Audio Output Device (${d.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">
            Click &quot;SCAN OUTPUT DEVICES&quot; to discover connected Bluetooth Speakers or External Audio Sinks.
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={async () => {
              await audioEngine.initialize();
              await handleScanOutputDevices();
            }}
            className="rounded-lg bg-green-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-green-400"
          >
            🔊 ENABLE AUDIO OUTPUT
          </button>
          <button
            onClick={() => audioEngine.playTestTone()}
            className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/20"
          >
            🧪 TEST SPEAKER SOUND
          </button>
        </div>
      </div>

      {/* Bluetooth Microphone Input Routing Panel */}
      <div className="mt-6 w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-md text-blue-400">
            🎤 Bluetooth Microphone Input Routing
          </span>
          <button
            onClick={handleScanBluetoothDevices}
            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
          >
            SCAN OS BT DEVICES
          </button>
        </div>

        {bluetoothDevices.length > 0 && (
          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block text-gray-400 mb-1">Select Bluetooth Input Device:</label>
              <select
                value={selectedBtDevice}
                onChange={(e) => setSelectedBtDevice(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-white"
              >
                {bluetoothDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Target Participant:</label>
              <select
                value={targetBtParticipant}
                onChange={(e) => setTargetBtParticipant(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-white"
              >
                <option value="">-- Select Participant --</option>
                {participants.map((p) => (
                  <option key={p.participantId} value={p.participantId}>
                    {p.displayName} ({p.participantId.slice(0, 6)})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleConnectBluetoothAudio}
              className="w-full rounded-lg bg-blue-500 py-2 font-semibold text-white hover:bg-blue-400"
            >
              CONNECT BT AUDIO STREAM TO MIXER
            </button>
          </div>
        )}
      </div>

      {/* Master Volume Control */}
      <div className="mt-6 w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-lg">Master Volume</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          defaultValue="100"
          onChange={(event) => {
            audioEngine.setMasterVolume(Number(event.target.value) / 100);
          }}
          className="mt-4 w-full accent-green-500"
        />
      </div>

      {/* Participant Cards List */}
      <div className="mt-8 w-full max-w-xl space-y-4">
        {participants.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            No active participants in this session yet.
          </p>
        ) : (
          participants.map((participant) => (
            <ParticipantCard
              key={participant.participantId}
              participant={participant}
              stats={diagnostics.get(participant.participantId)}
              onMute={handleMute}
              onVolumeChange={handleVolumeChange}
              onGrantFloor={handleGrantFloor}
              onReleaseFloor={handleReleaseFloor}
            />
          ))
        )}
      </div>

    </main>
  );
}
