"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRPanelProps {
  roomCode: string;
  gatewayIp?: string;
  ssid?: string;
  encryption?: string;
}

export function QRPanel({
  roomCode,
  gatewayIp = "192.168.4.1",
  ssid = "VOXMESH-LOCAL",
  encryption = "WPA3-SAE / AES",
}: QRPanelProps) {
  const [joinUrl, setJoinUrl] = useState(`http://localhost:3000/join?code=${roomCode}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinUrl(`${window.location.origin}/join?code=${encodeURIComponent(roomCode)}`);
    }
  }, [roomCode]);

  return (
    <div className="col-span-12 lg:col-span-5 flex flex-col gap-md">
      <div className="bg-surface-container-low border border-outline-variant rounded p-lg flex flex-col items-center justify-center gap-lg relative">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-primary m-sm"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-primary m-sm"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-primary m-sm"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-primary m-sm"></div>

        <div className="flex flex-col items-center gap-unit">
          <span className="text-headline-sm font-headline-sm text-on-surface">
            SCAN TO JOIN
          </span>
          <span className="text-label-caps text-on-surface-variant">
            Direct Client Connectivity
          </span>
        </div>

        {/* Real QR Code */}
        <div className="w-64 h-64 bg-surface p-sm border border-outline-variant relative group flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <div className="p-2 bg-white rounded flex items-center justify-center shadow-inner">
            <QRCodeSVG
              value={joinUrl}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Room & Network details */}
        <div className="grid grid-cols-2 gap-x-xl gap-y-sm w-full pt-md border-t border-outline-variant/50">
          <div className="flex flex-col">
            <span className="text-label-caps text-on-surface-variant">ROOM CODE</span>
            <span className="text-headline-sm text-primary tracking-widest font-mono">
              {roomCode}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-caps text-on-surface-variant">GATEWAY IP</span>
            <span className="text-headline-sm text-on-surface tracking-wider font-mono">
              {gatewayIp}
            </span>
          </div>
          <div className="flex flex-col mt-sm">
            <span className="text-label-caps text-on-surface-variant">SSID</span>
            <span className="text-body-sm text-on-surface">{ssid}</span>
          </div>
          <div className="flex flex-col mt-sm">
            <span className="text-label-caps text-on-surface-variant">ENCRYPTION</span>
            <span className="text-body-sm text-on-surface">{encryption}</span>
          </div>
        </div>
      </div>

      {/* Broadcasting Indicator */}
      <div className="bg-surface-container border border-outline-variant p-md flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">router</span>
          <span className="text-body-sm text-on-surface">Mesh AP Broadcasting</span>
        </div>
        <div className="flex items-center gap-xs">
          <span className="w-1.5 h-6 bg-primary animate-pulse"></span>
          <span className="w-1.5 h-4 bg-primary/70 animate-pulse delay-75"></span>
          <span className="w-1.5 h-8 bg-primary animate-pulse delay-150"></span>
          <span className="w-1.5 h-3 bg-primary/50 animate-pulse delay-200"></span>
        </div>
      </div>
    </div>
  );
}
