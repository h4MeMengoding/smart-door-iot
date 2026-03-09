// ============================================
// Generic ESP32 Command Proxy via MQTT
// ============================================
// POST /api/esp — send any command to ESP32 via MQTT
// GET  /api/esp — query ESP32 status/data via MQTT
//
// All dashboard commands are routed through this endpoint.
// The frontend sends { command: "door.unlock", ...params }
// and this route maps it to the appropriate MQTT topic.

import { NextRequest, NextResponse } from 'next/server';
import { sendCommand, getCachedStatus, getCachedSystemInfo, isDeviceOnline, initMqtt } from '@/lib/mqtt';
import { TOPICS } from '@/lib/mqttTopics';

export const dynamic = 'force-dynamic';

// Command → MQTT topic mapping
const COMMAND_MAP: Record<string, { topic: string; action: string }> = {
  // Door
  'door.unlock':    { topic: TOPICS.CMD_DOOR, action: 'unlock' },
  'door.lock':      { topic: TOPICS.CMD_DOOR, action: 'lock' },
  'door.status':    { topic: TOPICS.CMD_DOOR, action: 'status' },
  
  // Cards
  'cards.list':     { topic: TOPICS.CMD_CARDS, action: 'list' },
  'cards.add':      { topic: TOPICS.CMD_CARDS, action: 'add' },
  'cards.remove':   { topic: TOPICS.CMD_CARDS, action: 'remove' },
  'cards.sync':     { topic: TOPICS.CMD_CARDS, action: 'sync' },
  
  // Config
  'config.get':          { topic: TOPICS.CMD_CONFIG, action: 'get' },
  'config.set_autolock': { topic: TOPICS.CMD_CONFIG, action: 'set_autolock' },
  'config.set_card_delay': { topic: TOPICS.CMD_CONFIG, action: 'set_card_delay' },
  'config.get_schedules': { topic: TOPICS.CMD_CONFIG, action: 'get_schedules' },
  'config.set_schedule':  { topic: TOPICS.CMD_CONFIG, action: 'set_schedule' },
  'config.set_delay_enabled': { topic: TOPICS.CMD_CONFIG, action: 'set_delay_enabled' },
  'config.remove_all_schedules': { topic: TOPICS.CMD_CONFIG, action: 'remove_all_schedules' },
  
  // Mode
  'mode.register':     { topic: TOPICS.CMD_MODE, action: 'register' },
  'mode.clone_start':  { topic: TOPICS.CMD_MODE, action: 'clone_start' },
  'mode.clone_cancel': { topic: TOPICS.CMD_MODE, action: 'clone_cancel' },
  'mode.clone_status': { topic: TOPICS.CMD_MODE, action: 'clone_status' },
  
  // RFID
  'rfid.toggle':        { topic: TOPICS.CMD_RFID, action: 'toggle' },
  'rfid.status':        { topic: TOPICS.CMD_RFID, action: 'status' },
  'rfid.disable_timed': { topic: TOPICS.CMD_RFID, action: 'disable_timed' },
  
  // System
  'system.info':    { topic: TOPICS.CMD_SYSTEM, action: 'info' },
  'system.restart': { topic: TOPICS.CMD_SYSTEM, action: 'restart' },
  'system.buzzer':  { topic: TOPICS.CMD_SYSTEM, action: 'buzzer' },
  
  // Time
  'time.get':  { topic: TOPICS.CMD_TIME, action: 'get' },
  'time.sync': { topic: TOPICS.CMD_TIME, action: 'sync' },
  'time.set':  { topic: TOPICS.CMD_TIME, action: 'set' },
  
  // Schedule
  'schedule.get': { topic: TOPICS.CMD_SCHEDULE, action: 'get' },
  'schedule.set': { topic: TOPICS.CMD_SCHEDULE, action: 'set' },
  
  // OTA
  'ota.begin': { topic: TOPICS.CMD_OTA, action: 'begin' },
  'ota.abort': { topic: TOPICS.CMD_OTA, action: 'abort' },
};

export async function GET(request: NextRequest) {
  initMqtt();
  
  const { searchParams } = new URL(request.url);
  const command = searchParams.get('command') || 'door.status';
  
  // For read-only queries, try cached data first (avoids MQTT round-trip)
  if (command === 'door.status') {
    const cached = getCachedStatus();
    if (cached) {
      return NextResponse.json({ 
        success: true, 
        ...cached, 
        deviceOnline: isDeviceOnline(),
        source: 'mqtt_cache' 
      });
    }
    // On cold start: MQTT not connected yet → return offline immediately
    // Don't wait 10+s for MQTT connect+subscribe → prevents Vercel timeout
    if (!isDeviceOnline()) {
      return NextResponse.json({
        success: false,
        message: 'MQTT connecting, device status pending',
        deviceOnline: false,
        source: 'cold_start',
      });
    }
  }
  
  if (command === 'system.info') {
    const cached = getCachedSystemInfo();
    if (cached) {
      return NextResponse.json({ 
        success: true, 
        ...cached, 
        deviceOnline: isDeviceOnline(),
        source: 'mqtt_cache' 
      });
    }
    // Same cold-start optimization for system.info
    if (!isDeviceOnline()) {
      return NextResponse.json({
        success: false,
        message: 'MQTT connecting, system info pending',
        deviceOnline: false,
        source: 'cold_start',
      });
    }
  }
  
  // Send actual MQTT command
  const mapping = COMMAND_MAP[command];
  if (!mapping) {
    return NextResponse.json({ success: false, message: `Unknown command: ${command}` }, { status: 400 });
  }
  
  try {
    const response = await sendCommand(mapping.topic, { action: mapping.action }, 10000);
    return NextResponse.json({ ...response, deviceOnline: isDeviceOnline() });
  } catch {
    // Return graceful degradation instead of 503 — dashboard handles offline state
    return NextResponse.json({ 
      success: false, 
      message: 'Device not responding', 
      deviceOnline: false,
      source: 'timeout' 
    });
  }
}

export async function POST(request: NextRequest) {
  initMqtt();
  
  try {
    const body = await request.json();
    const { command, ...params } = body;
    
    if (!command) {
      return NextResponse.json({ success: false, message: 'Missing "command" field' }, { status: 400 });
    }
    
    const mapping = COMMAND_MAP[command];
    if (!mapping) {
      return NextResponse.json({ success: false, message: `Unknown command: ${command}` }, { status: 400 });
    }
    
    // Build MQTT payload: merge action with additional params
    const payload = { action: mapping.action, ...params };
    delete payload.command; // Remove 'command' key, not needed in MQTT payload
    
    // Longer timeout for OTA and system restart
    const timeout = command.startsWith('ota.') || command === 'system.restart' || command === 'time.sync' 
      ? 30000 
      : 10000;
    
    const response = await sendCommand(mapping.topic, payload, timeout);
    return NextResponse.json({ ...response, deviceOnline: isDeviceOnline() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Command failed';
    // Return 200 with success:false for MQTT timeouts — dashboard handles gracefully
    // Only real errors (bad request) get error status codes
    return NextResponse.json({ success: false, message, deviceOnline: isDeviceOnline() });
  }
}
