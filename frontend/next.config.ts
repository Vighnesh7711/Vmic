import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.95.210.201",
    "10.104.12.231",
    "10.110.120.201",
    "192.168.137.1",
    "192.168.56.1",
    "localhost",
    "127.0.0.1",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://127.0.0.1:8000/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;

