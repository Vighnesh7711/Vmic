/**
 * VMIC Network Configuration
 *
 * Your laptop has multiple network interfaces:
 *   10.110.120.201   — Wi-Fi Router (GGGGG)
 *   192.168.137.1    — Mobile Hotspot
 *   192.168.56.1     — VirtualBox (ignore)
 */

export const KNOWN_LAN_IPS = [
  "10.110.120.201",  // Wi-Fi Router
  "192.168.137.1",   // Mobile Hotspot
];

export function getSelectedLanIp(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("vmic-selected-ip");
    if (saved) return saved;

    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return hostname;
    }
  }

  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_LAN_IP) {
    return process.env.NEXT_PUBLIC_LAN_IP;
  }

  return KNOWN_LAN_IPS[0];
}

export function setSelectedLanIp(ip: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("vmic-selected-ip", ip);
  }
}

/**
 * Backend always runs on HTTP port 8000.
 * (FastAPI does not need HTTPS for API/Socket.IO calls from the browser —
 *  the browser's secure-context requirement is for getUserMedia, not fetch.)
 */
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000`;
  }
  return `http://${getSelectedLanIp()}:8000`;
}

/**
 * Frontend URL for QR codes.
 * Uses HTTPS since the Next.js dev server now runs with --experimental-https.
 */
export function getFrontendUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const port = window.location.port || "3000";

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `https://${getSelectedLanIp()}:${port}`;
    }

    return `https://${hostname}:${port}`;
  }
  return `https://${getSelectedLanIp()}:3000`;
}
