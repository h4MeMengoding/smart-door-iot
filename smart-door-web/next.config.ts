import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Note: all API routes use `dynamic = 'force-dynamic'` which prevents static output.
  // Routes that need CDN caching (health/db, docs) set their own Cache-Control headers.
  // MQTT routes (/api/esp, /api/door) may need extra time on cold start.
  headers: async () => [
    {
      // Allow service worker to control the entire scope
      source: '/sw.js',
      headers: [
        { key: 'Service-Worker-Allowed', value: '/' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
  ],
};

export default nextConfig;
