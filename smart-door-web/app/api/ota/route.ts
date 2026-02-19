// ============================================
// OTA Firmware Upload via ESP32 HTTP Proxy
// ============================================
// POST /api/ota — Proxies firmware to ESP32's /ota HTTP endpoint
// 1. Authenticates with ESP32 OTA (password login → session cookie)
// 2. Forwards firmware binary as multipart upload

import { NextRequest, NextResponse } from 'next/server';
import { ESP32_OTA_URL, ESP32_OTA_PASSWORD } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('firmware') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'No firmware file provided' }, { status: 400 });
    }

    const totalSize = file.size;

    if (totalSize < 1000) {
      return NextResponse.json({ success: false, message: 'File too small to be valid firmware' }, { status: 400 });
    }

    if (totalSize > 2 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: 'Firmware too large (max 2MB)' }, { status: 400 });
    }

    const otaBaseUrl = ESP32_OTA_URL; // e.g. https://esp.ilhame.id/ota
    const otaPassword = ESP32_OTA_PASSWORD;

    if (!otaBaseUrl || !otaPassword) {
      return NextResponse.json({
        success: false,
        message: 'ESP32_OTA_URL or ESP32_OTA_PASSWORD not configured',
      }, { status: 500 });
    }

    console.log(`[OTA] Starting HTTP OTA upload: ${totalSize} bytes → ${otaBaseUrl}`);

    // Step 1: Login to ESP32 OTA to get session cookie
    const loginUrl = otaBaseUrl.replace(/\/$/, '') + '/login';
    const loginBody = new URLSearchParams({ password: otaPassword });

    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody.toString(),
      redirect: 'manual', // Don't follow redirect — we need the Set-Cookie header
    });

    // ESP32 returns 302 redirect on success with Set-Cookie
    const setCookie = loginRes.headers.get('set-cookie');
    if (!setCookie || !setCookie.includes('ota_session=')) {
      console.error('[OTA] Login failed — no session cookie received. Status:', loginRes.status);
      return NextResponse.json({
        success: false,
        message: 'Failed to authenticate with ESP32 OTA. Check password.',
      }, { status: 401 });
    }

    // Extract cookie value
    const cookieMatch = setCookie.match(/ota_session=([^;]+)/);
    const sessionCookie = cookieMatch ? `ota_session=${cookieMatch[1]}` : '';

    console.log('[OTA] Authenticated with ESP32, uploading firmware...');

    // Step 2: Upload firmware to ESP32 /ota with session cookie
    const uploadForm = new FormData();
    uploadForm.append('firmware', file);

    const uploadRes = await fetch(otaBaseUrl, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
      },
      body: uploadForm,
    });

    const responseText = await uploadRes.text();

    if (uploadRes.ok && responseText.trim() === 'OK') {
      console.log(`[OTA] Firmware upload successful: ${totalSize} bytes. ESP32 restarting...`);
      return NextResponse.json({
        success: true,
        message: `Firmware updated: ${totalSize} bytes. ESP32 restarting...`,
        totalSize,
      });
    } else {
      console.error(`[OTA] Upload failed: ${uploadRes.status} — ${responseText}`);
      return NextResponse.json({
        success: false,
        message: `ESP32 OTA failed: ${responseText || `HTTP ${uploadRes.status}`}`,
      }, { status: uploadRes.status || 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OTA upload failed';
    console.error('[OTA] Error:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
