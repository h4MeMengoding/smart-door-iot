import { NextResponse } from "next/server";
import {
  getCachedStatus,
  getCachedSystemInfo,
  getDeviceAvailability,
  initMqtt,
} from "@/lib/mqtt";

export const dynamic = "force-dynamic";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Public login telemetry. Read cached values only; never accept device commands. */
export async function GET() {
  initMqtt();
  const deviceOnline = getDeviceAvailability();
  // Do not present retained telemetry as current while the device is offline.
  const status = deviceOnline === true ? getCachedStatus() : null;
  const system = deviceOnline === true ? getCachedSystemInfo() : null;
  const uptime = status?.uptime ?? system?.uptime;

  return NextResponse.json(
    {
      deviceOnline,
      doorStatus:
        status?.doorStatus === "LOCKED" || status?.doorStatus === "UNLOCKED"
          ? status.doorStatus
          : null,
      cardCount: finiteNumber(status?.cardCount),
      rssi: finiteNumber(system?.rssi),
      freeHeap: finiteNumber(system?.freeHeap),
      uptime:
        typeof uptime === "number" && Number.isFinite(uptime)
          ? String(uptime)
          : typeof uptime === "string" && /^\d+s?$/.test(uptime)
            ? uptime.replace(/s$/, "")
            : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
