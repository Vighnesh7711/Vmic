"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MobileClientApp } from "@/components/mobile/MobileClientApp";

function JoinPageContent() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("code") || "";

  return <MobileClientApp initialRoomCode={roomCode} />;
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background text-primary font-mono-data">
          [INITIALIZING ATTENDEE NODE...]
        </div>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
