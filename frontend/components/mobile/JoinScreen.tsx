"use client";

import React, { useState } from "react";

interface JoinScreenProps {
  initialCode?: string;
  onJoin: (roomCode: string, alias: string, transport: "tcp" | "bt") => void;
}

export function JoinScreen({ initialCode = "", onJoin }: JoinScreenProps) {
  const [roomCode, setRoomCode] = useState(initialCode);
  const [alias, setAlias] = useState("");
  const [transport, setTransport] = useState<"tcp" | "bt">("tcp");
  const [scanning, setScanning] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    onJoin(
      roomCode.trim().toUpperCase(),
      alias.trim() || `NODE_${Math.floor(1000 + Math.random() * 9000)}`,
      transport
    );
  };

  const handleSimulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      if (!roomCode) setRoomCode("A101-7XK");
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-surface-container-highest border-dashed">
        <h1 className="text-headline-md text-primary font-headline-md uppercase tracking-wider">
          Join Session
        </h1>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_4px_#75ff9e]"></span>
          <span className="text-label-caps text-on-surface-variant font-label-caps">
            RX READY
          </span>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="relative w-full aspect-square border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center p-4 group overflow-hidden">
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-primary"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-primary"></div>

        {/* Scan Line */}
        <div className="absolute top-0 left-0 w-full h-px bg-primary opacity-50 scan-line"></div>

        <span className="material-symbols-outlined text-display-lg text-primary mb-4 z-10">
          qr_code_scanner
        </span>
        <button
          type="button"
          onClick={handleSimulateScan}
          className="z-10 px-6 py-2 border border-primary text-primary font-label-caps text-label-caps hover:bg-primary hover:text-surface transition-colors duration-200"
        >
          {scanning ? "[ SCANNING MATRIX... ]" : "[ SCAN QR CODE ]"}
        </button>
        <p className="z-10 mt-4 text-mono-data text-on-surface-variant font-mono-data text-center">
          Aim camera at host&apos;s routing matrix
        </p>
      </div>

      {/* Manual Entry Form */}
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="flex flex-col space-y-4 bg-surface-container border border-surface-container-highest p-4">
          <h2 className="text-label-caps text-on-surface-variant font-label-caps border-b border-surface-container-highest pb-2 mb-2">
            Manual Override
          </h2>
          {/* Room Code */}
          <div className="flex flex-col space-y-1">
            <label className="text-label-caps text-primary font-label-caps">
              NODE ID (ROOM CODE)
            </label>
            <input
              className="bg-surface border border-outline-variant text-on-surface font-mono-data text-mono-data p-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase tracking-widest placeholder:text-on-surface-variant/50"
              placeholder="XXXX-XXXX"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              required
            />
          </div>
          {/* Alias */}
          <div className="flex flex-col space-y-1">
            <label className="text-label-caps text-primary font-label-caps">
              CLIENT ALIAS
            </label>
            <input
              className="bg-surface border border-outline-variant text-on-surface font-mono-data text-mono-data p-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/50"
              placeholder="GUEST_USER"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
        </div>

        {/* Protocol Selection */}
        <div className="flex flex-col space-y-2 bg-surface-container border border-surface-container-highest p-4">
          <h2 className="text-label-caps text-on-surface-variant font-label-caps border-b border-surface-container-highest pb-2 mb-2">
            Transport Layer
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTransport("tcp")}
              className={`p-2 flex flex-col items-center justify-center space-y-2 transition-all font-label-caps text-label-caps border ${
                transport === "tcp"
                  ? "border-primary bg-primary text-surface"
                  : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined">wifi</span>
              <span>[ TCP/IP ]</span>
            </button>
            <button
              type="button"
              onClick={() => setTransport("bt")}
              className={`p-2 flex flex-col items-center justify-center space-y-2 transition-all font-label-caps text-label-caps border ${
                transport === "bt"
                  ? "border-primary bg-primary text-surface"
                  : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined">bluetooth</span>
              <span>[ BT_LE ]</span>
            </button>
          </div>
        </div>

        {/* Action */}
        <button
          type="submit"
          className="w-full bg-primary text-surface font-label-caps text-label-caps py-4 mt-auto border border-primary hover:bg-primary-fixed transition-colors flex items-center justify-center space-x-2 group"
        >
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            login
          </span>
          <span>[ INITIATE HANDSHAKE ]</span>
        </button>
      </form>

      <style jsx>{`
        .scan-line {
          animation: scan 2s linear infinite;
        }
        @keyframes scan {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(280px);
          }
        }
      `}</style>
    </div>
  );
}
