import { NextResponse } from "next/server";

// Liveness probe: deliberately does not touch the database so it cannot
// prevent a serverless database from autosuspending.
export function GET() {
  return NextResponse.json({ ok: true });
}
