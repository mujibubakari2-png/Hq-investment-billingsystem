import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    const corsOrigin = process.env.CORS_ORIGIN || "*";
    const allowCredentials = corsOrigin !== "*";
    
    const headers = [
      { key: "Access-Control-Allow-Origin", value: corsOrigin },
      { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
      { key: "Access-Control-Max-Age", value: "86400" }, // 24 hours
    ];

    if (allowCredentials) {
      headers.push({ key: "Access-Control-Allow-Credentials", value: "true" });
    }

    return [
      {
        source: "/api/:path*",
        headers,
      },
    ];
  },
};

export default nextConfig;

