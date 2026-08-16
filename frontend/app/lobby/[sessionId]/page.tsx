"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LobbyView } from "@/components/lobby/LobbyView";
import { getSession } from "@/lib/api";
import type { Session } from "@/lib/types";

export default function LobbyPage() {
  const params = useParams();
  const sessionId = Array.isArray(params?.sessionId)
    ? params.sessionId[0]
    : params?.sessionId;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    getSession(sessionId)
      .then((data) => {
        if (isMounted) {
          setSession(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load session");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <>
        <Header hostName="..." roomId="..." sessionStatus="CONNECTING" />
        <main className="w-full pt-[112px] bg-surface min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-md font-mono-data text-primary">
            <span className="w-3 h-3 rounded-full bg-primary animate-ping"></span>
            <span>INITIALIZING SESSION LOBBY [{sessionId}]...</span>
          </div>
        </main>
      </>
    );
  }

  if (error || !session) {
    return (
      <>
        <Header hostName="Unknown" roomId="Error" sessionStatus="ERROR" />
        <main className="w-full pt-[112px] bg-surface min-h-screen flex items-center justify-center p-md">
          <div className="border border-error bg-surface-container-low p-lg flex flex-col gap-md max-w-lg">
            <span className="font-label-caps text-error">
              [SESSION_ERROR]: {error || "Session not found"}
            </span>
            <p className="font-mono-data text-on-surface-variant text-body-sm">
              The requested session ID could not be loaded from the state store.
            </p>
            <a
              href="/create-session"
              className="font-label-caps text-primary border border-primary px-md py-xs text-center hover:bg-primary hover:text-background transition-colors"
            >
              [ RETURN TO CREATE SESSION ]
            </a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        hostName={session.hostName}
        roomId={session.room}
        sessionStatus="READY"
      />
      <main className="w-full pt-[112px] bg-surface min-h-screen">
        <LobbyView session={session} />
      </main>
    </>
  );
}
