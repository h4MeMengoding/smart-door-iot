import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Note: all API routes use `dynamic = 'force-dynamic'` which prevents static output.
  // Routes that need CDN caching (health/db, docs) set their own Cache-Control headers.
  // MQTT routes (/api/esp, /api/door) may need extra time on cold start.
};

export default nextConfig;
