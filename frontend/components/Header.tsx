"use strict";
import React from "react";
import Link from "next/link";

interface HeaderProps {
  hostName?: string;
  roomId?: string;
  sessionStatus?: string;
}

export function Header({
  hostName = "[HostName]",
  roomId = "[RoomID]",
  sessionStatus = "ACTIVE",
}: HeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container/90 backdrop-blur-md border-b border-outline-variant">
      <div className="h-20 w-full px-md flex items-center justify-between">
        <div className="flex flex-col">
          <Link href="/create-session" className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">
              settings_input_antenna
            </span>
            <span className="font-display-lg text-headline-sm tracking-widest text-primary">
              VOXMESH
            </span>
          </Link>
          <span className="font-mono-data text-label-caps text-on-surface-variant uppercase">
            Local Wireless Audio System
          </span>
        </div>
        <div className="flex items-center gap-xl">
          <div className="flex flex-col items-end">
            <span className="font-mono-data text-label-caps text-on-surface-variant uppercase">
              Host
            </span>
            <span className="font-body-sm text-on-surface">{hostName}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-mono-data text-label-caps text-on-surface-variant uppercase">
              Room
            </span>
            <span className="font-body-sm text-on-surface">{roomId}</span>
          </div>
          <div className="flex items-center gap-sm bg-surface-container-high px-md py-sm border border-outline-variant rounded">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container shadow-[0_0_8px_#00e676]"></span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono-data text-label-caps text-on-surface-variant leading-none">
                SESSION STATUS
              </span>
              <span className="font-mono-data text-[11px] text-primary uppercase font-bold">
                {sessionStatus}
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border border-on-primary-container">
            <span className="material-symbols-outlined text-on-primary text-[18px]">
              person
            </span>
          </div>
        </div>
      </div>
      <nav className="flex px-md border-t border-outline-variant/30 bg-surface-container-low">
        <a
          aria-current="page"
          className="px-md py-sm font-mono-data transition-colors text-primary border-b-2 border-primary"
          href="#"
        >
          Monitor
        </a>
        <a
          className="px-md py-sm font-mono-data text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
          href="#"
        >
          Routing
        </a>
        <a
          className="px-md py-sm font-mono-data text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
          href="#"
        >
          Network
        </a>
        <a
          className="px-md py-sm font-mono-data text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
          href="#"
        >
          Event Logs
        </a>
      </nav>
    </header>
  );
}
