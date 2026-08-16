"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AudioClient } from "@/lib/audio/AudioClient";
import { MobileHeader } from "./MobileHeader";
import { JoinScreen } from "./JoinScreen";
import { PermissionScreen } from "./PermissionScreen";
import { ConnectingScreen } from "./ConnectingScreen";
import { ConnectedScreen } from "./ConnectedScreen";
import { SpeakingScreen } from "./SpeakingScreen";
import { WaitingFloorScreen } from "./WaitingFloorScreen";
import { RequestSpeakScreen } from "./RequestSpeakScreen";
import { DisconnectedScreen } from "./DisconnectedScreen";
import { LeaveScreen } from "./LeaveScreen";

export type MobileScreenType =
  | "join"
  | "permission"
  | "connecting"
  | "connected"
  | "speaking"
  | "waiting_floor"
  | "request_speak"
  | "disconnected"
  | "leave";

interface MobileClientAppProps {
  initialRoomCode?: string;
}

export function MobileClientApp({
  initialRoomCode = "",
}: MobileClientAppProps) {
  const [currentScreen, setCurrentScreen] = useState<MobileScreenType>("join");
  const [previousScreen, setPreviousScreen] = useState<MobileScreenType>("join");

  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [alias, setAlias] = useState("GUEST_USER");
  const [speakingMode] = useState<"open_floor" | "controlled_floor">("open_floor");

  // Single persistent AudioClient instance
  const audioClient = useMemo(() => new AudioClient(), []);

  useEffect(() => {
    return () => {
      audioClient.dispose();
    };
  }, [audioClient]);

  // Flow Step 1: Join Form Submitted
  const handleJoin = (code: string, userAlias: string) => {
    setRoomCode(code);
    setAlias(userAlias);
    // Flow Step 2: Mic permission request
    setCurrentScreen("permission");
  };

  // Flow Step 2: Mic permission granted
  const handleGrantPermission = async () => {
    await audioClient.initialize();
    // Flow Step 3: Connecting Handshake
    setCurrentScreen("connecting");
  };

  // Flow Step 3: Connected
  const handleConnected = () => {
    // Flow Step 4: Connected / Standby (or directly speaking in open floor)
    setCurrentScreen("connected");
  };

  // Flow Step 5: Enter Live PTT
  const handleEnterSpeaking = () => {
    setCurrentScreen("speaking");
  };

  // Flow: Request to Speak (Controlled Floor)
  const handleRequestSpeak = () => {
    setCurrentScreen("request_speak");
  };

  const handleCancelRequest = () => {
    setCurrentScreen(speakingMode === "controlled_floor" ? "waiting_floor" : "connected");
  };

  // Leave Room prompt
  const handlePromptLeave = () => {
    setPreviousScreen(currentScreen);
    setCurrentScreen("leave");
  };

  const handleConfirmLeave = () => {
    audioClient.dispose();
    setCurrentScreen("join");
  };

  const handleCancelLeave = () => {
    setCurrentScreen(previousScreen);
  };

  // Disconnect & Reconnect
  const handleReconnect = () => {
    setCurrentScreen("connecting");
  };

  const handleNewSession = () => {
    audioClient.dispose();
    setCurrentScreen("join");
  };

  // Navigation indicator
  const getHeaderStatus = (): {
    label: string;
    type: "live" | "sync" | "offl";
  } => {
    switch (currentScreen) {
      case "speaking":
        return { label: "LIVE", type: "live" };
      case "connecting":
      case "request_speak":
        return { label: "SYNC", type: "sync" };
      case "disconnected":
      case "leave":
        return { label: "OFFL", type: "offl" };
      case "permission":
        return { label: "AUTH", type: "sync" };
      case "connected":
      case "waiting_floor":
        return { label: "READY", type: "live" };
      default:
        return { label: "RX READY", type: "sync" };
    }
  };

  const headerStatus = getHeaderStatus();

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-surface font-body-lg">
      <MobileHeader
        statusLabel={headerStatus.label}
        statusType={headerStatus.type}
        onLeaveClick={currentScreen !== "join" && currentScreen !== "leave" ? handlePromptLeave : undefined}
      />

      <main className="flex-1 w-full pt-14 pb-safe flex flex-col justify-center">
        {currentScreen === "join" && (
          <JoinScreen initialCode={roomCode} onJoin={handleJoin} />
        )}

        {currentScreen === "permission" && (
          <PermissionScreen
            onGrantPermission={handleGrantPermission}
            onCancel={() => setCurrentScreen("join")}
          />
        )}

        {currentScreen === "connecting" && (
          <ConnectingScreen
            roomCode={roomCode}
            alias={alias}
            onConnected={handleConnected}
          />
        )}

        {currentScreen === "connected" && (
          <ConnectedScreen
            roomCode={roomCode}
            alias={alias}
            speakingMode={speakingMode}
            onEnterSpeaking={handleEnterSpeaking}
            onRequestSpeak={handleRequestSpeak}
            onLeave={handlePromptLeave}
          />
        )}

        {currentScreen === "speaking" && (
          <SpeakingScreen
            audioClient={audioClient}
            alias={alias}
            onLeave={handlePromptLeave}
          />
        )}

        {currentScreen === "waiting_floor" && (
          <WaitingFloorScreen
            onRequestFloor={handleRequestSpeak}
            onLeave={handlePromptLeave}
          />
        )}

        {currentScreen === "request_speak" && (
          <RequestSpeakScreen
            onCancelRequest={handleCancelRequest}
            onLeave={handlePromptLeave}
          />
        )}

        {currentScreen === "disconnected" && (
          <DisconnectedScreen
            onReconnect={handleReconnect}
            onNewSession={handleNewSession}
          />
        )}

        {currentScreen === "leave" && (
          <LeaveScreen
            roomCode={roomCode}
            alias={alias}
            onConfirmLeave={handleConfirmLeave}
            onCancel={handleCancelLeave}
          />
        )}
      </main>
    </div>
  );
}
