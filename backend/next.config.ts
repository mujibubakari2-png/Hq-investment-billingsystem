import type { NextConfig } from "next";

// CORS is handled by src/proxy.ts (the single source of truth).
// Do not add CORS headers here to avoid conflicting/duplicate headers.
const nextConfig: NextConfig = {};

export default nextConfig;
