import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.104.12.231",
    "10.110.120.201",
    "192.168.137.1",
    "192.168.56.1",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
