// ============================================
// Door Control API — for iOS Shortcuts & Dashboard
// ============================================
// POST /api/door — unlock/lock door via MQTT
// GET  /api/door — get door status via MQTT

import { NextRequest, NextResponse } from 'next/server';
import { sendCommand, getCachedStatus, isDeviceOnline, initMqtt } from '@/lib/mqtt';
import { TOPICS } from '@/lib/mqttTopics';

export const dynamic = 'force-dynamic';

// Verify API key (for iOS Shortcuts) — dashboard auth handled by Cloudflare Access
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  return !!(apiKey && apiKey === process.env.ESP32_API_KEY);
}

export async function GET(request: NextRequest) {
  // Auth handled by Cloudflare Access (or API key for iOS Shortcuts)
  initMqtt();

  // Return cached status if available, otherwise request from ESP32
  const cached = getCachedStatus();
  if (cached) {
    return NextResponse.json({
      ...cached,
      deviceOnline: isDeviceOnline(),
      source: 'mqtt_cache',
    });
  }

  // On cold start: MQTT not connected yet → return offline immediately
  // Don't wait 5+s for MQTT connect+subscribe → prevents Vercel timeout
  if (!isDeviceOnline()) {
    return NextResponse.json({
      success: false,
      message: 'MQTT connecting, device status pending',
      deviceOnline: false,
      source: 'cold_start',
    });
  }

  // No cache but MQTT connected — request status from ESP32
  try {
    const response = await sendCommand(TOPICS.CMD_DOOR, { action: 'status' }, 5000);
    return NextResponse.json({ ...response, deviceOnline: isDeviceOnline() });
  } catch {
    return NextResponse.json({
      success: false,
      message: 'Device offline or not responding',
      deviceOnline: false,
      source: 'timeout',
    });
  }
}

export async function POST(request: NextRequest) {
  // Auth handled by Cloudflare Access (or API key for iOS Shortcuts)
  initMqtt();

  try {
    const body = await request.json();
    const action = body.action || 'unlock'; // Default: unlock for iOS Shortcuts

    if (action !== 'unlock' && action !== 'lock') {
      return NextResponse.json({ success: false, message: 'Invalid action. Use "unlock" or "lock".' }, { status: 400 });
    }

    if (!isDeviceOnline()) {
      return NextResponse.json({ success: false, message: 'Device offline', deviceOnline: false });
    }

    const response = await sendCommand(TOPICS.CMD_DOOR, { action }, 10000);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Command failed';
    return NextResponse.json({ success: false, message, deviceOnline: false });
  }
}
