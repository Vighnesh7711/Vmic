/**
 * Vmic — Frontend API client.
 */

import type { CreateSessionPayload, Session } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function createSession(
  payload: CreateSessionPayload
): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function getSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "GET",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get session (${res.status}): ${errorText}`);
  }

  return res.json();
}
