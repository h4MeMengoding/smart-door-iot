'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Activity, Wifi, Clock, Database, HardDrive, Thermometer, MemoryStick, Radio } from 'lucide-react';
import { SystemInfo } from '@/lib/types';

interface SystemInfoCardProps {
  uptimeRaw?: string; // e.g. "12345s" from ESP32
  isConnected?: boolean;
  sysInfo?: SystemInfo | null; // Received via MQTT from parent
}

function parseUptimeSeconds(raw?: string): number {
  if (!raw) return 0;
  const seconds = parseInt(raw.replace('s', ''));
  return isNaN(seconds) ? 0 : seconds;
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function getSignalInfo(rssi?: number) {
  if (rssi === undefined || rssi === null) return { label: '-', color: 'var(--text-muted)', bars: 0 };
  if (rssi > -50) return { label: 'Excellent', color: 'var(--success)', bars: 4 };
  if (rssi > -60) return { label: 'Good', color: 'var(--success)', bars: 3 };
  if (rssi > -70) return { label: 'Fair', color: 'var(--warning)', bars: 2 };
  return { label: 'Poor', color: 'var(--danger)', bars: 1 };
}

export function SystemInfoCard({ uptimeRaw, isConnected = false, sysInfo = null }: SystemInfoCardProps) {
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const baseUptimeRef = useRef(0);
  const baseTimestampRef = useRef(0);

  // When we get a new uptime from ESP32, reset the base
  useEffect(() => {
    if (!baseTimestampRef.current) baseTimestampRef.current = Date.now();
    const parsed = parseUptimeSeconds(uptimeRaw);
    if (parsed > 0) {
      baseUptimeRef.current = parsed;
      baseTimestampRef.current = Date.now();
      setTimeout(() => setUptimeSeconds(parsed), 0);
    }
  }, [uptimeRaw]);

  // Tick every second to keep uptime realtime
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - baseTimestampRef.current) / 1000);
      setUptimeSeconds(baseUptimeRef.current + elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Check DB health
  const checkDbHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/db');
      const data = await res.json();
      setDbConnected(data.connected === true);
    } catch {
      setDbConnected(false);
    }
  }, []);

  useEffect(() => {
    const initialCheck = setTimeout(() => { void checkDbHealth(); }, 0);
    const id = setInterval(checkDbHealth, 60000);
    return () => {
      clearTimeout(initialCheck);
      clearInterval(id);
    };
  }, [checkDbHealth]);

  const signal = getSignalInfo(sysInfo?.rssi);
  const ramPct = sysInfo?.totalHeap && sysInfo?.freeHeap
    ? Math.round(((sysInfo.totalHeap - sysInfo.freeHeap) / sysInfo.totalHeap) * 100)
    : null;
  // Use partitionSize (app partition) for flash %, matches PIO output
  const flashDenom = sysInfo?.partitionSize || sysInfo?.totalFlash;
  const flashPct = flashDenom && sysInfo?.usedFlash
    ? Math.round((sysInfo.usedFlash / flashDenom) * 100)
    : null;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <Activity className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>System Info</CardTitle>
            <CardDescription>Device health & network</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:block hidden">
        {/* WiFi Signal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <Wifi className="w-4 h-4" />
            <span className="text-[13px]">WiFi</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Signal bars */}
            <div className="flex items-end gap-0.5 h-3.5">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className="rounded-sm transition-colors"
                  style={{
                    width: '3px',
                    height: `${bar * 25}%`,
                    background: bar <= signal.bars ? signal.color : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <span className="text-[13px] font-semibold" style={{ color: signal.color }}>
              {isConnected ? signal.label : 'Offline'}
            </span>
          </div>
        </div>

        {/* MQTT Broker */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <Radio className="w-4 h-4" />
            <span className="text-[13px]">MQTT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'animate-pulse' : ''}`}
              style={{ background: isConnected ? 'var(--success)' : 'var(--danger)' }}
            />
            <span className="text-[13px] font-semibold" style={{ color: isConnected ? 'var(--success-text)' : 'var(--danger-text)' }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <Database className="w-4 h-4" />
            <span className="text-[13px]">Database</span>
          </div>
          <div className="flex items-center gap-1.5">
            {dbConnected === null ? (
              <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Checking...</span>
            ) : (
              <>
                <div
                  className={`w-2 h-2 rounded-full ${dbConnected ? 'animate-pulse' : ''}`}
                  style={{ background: dbConnected ? 'var(--success)' : 'var(--danger)' }}
                />
                <span className="text-[13px] font-semibold" style={{ color: dbConnected ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {dbConnected ? 'Connected' : 'Disconnected'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* RAM Usage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <MemoryStick className="w-4 h-4" />
            <span className="text-[13px]">RAM</span>
          </div>
          <div className="flex items-center gap-2">
            {ramPct !== null && (
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${ramPct}%`,
                    background: ramPct > 80 ? 'var(--danger)' : ramPct > 60 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            )}
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {ramPct !== null ? `${ramPct}%` : '-'}
            </span>
          </div>
        </div>

        {/* Flash Usage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <HardDrive className="w-4 h-4" />
            <span className="text-[13px]">Flash</span>
          </div>
          <div className="flex items-center gap-2">
            {flashPct !== null && (
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${flashPct}%`,
                    background: flashPct > 80 ? 'var(--danger)' : flashPct > 60 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            )}
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {flashPct !== null ? `${flashPct}%` : '-'}
            </span>
          </div>
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <Thermometer className="w-4 h-4" />
            <span className="text-[13px]">Temperature</span>
          </div>
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{
              color: sysInfo?.temperature !== undefined
                ? sysInfo.temperature > 70 ? 'var(--danger)' : sysInfo.temperature > 55 ? 'var(--warning)' : 'var(--text-primary)'
                : 'var(--text-primary)',
            }}
          >
            {sysInfo?.temperature !== undefined ? `${sysInfo.temperature.toFixed(1)}°C` : '-'}
          </span>
        </div>

        {/* Realtime Uptime */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--text-muted)' }}>
            <Clock className="w-4 h-4" />
            <span className="text-[13px]">Uptime</span>
          </div>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {uptimeSeconds > 0 ? formatUptime(uptimeSeconds) : '-'}
          </p>
        </div>
      </CardContent>
      <CardContent className="space-y-3 block sm:hidden">
        {/* Simplified content for mobile with 3 rows and combined WiFi + Database */}
        <div className="grid grid-cols-3 gap-y-2 gap-x-4">
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>WiFi & DB</span>
            <span className="text-[13px] font-semibold" style={{ color: isConnected && dbConnected ? 'var(--success)' : 'var(--danger)' }}>
              {isConnected && dbConnected ? 'OK' : 'Issue'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>MQTT</span>
            <span className="text-[13px] font-semibold" style={{ color: isConnected ? 'var(--success)' : 'var(--danger)' }}>
              {isConnected ? 'OK' : 'Issue'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>RAM</span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {ramPct !== null ? `${ramPct}%` : '-'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Flash</span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {flashPct !== null ? `${flashPct}%` : '-'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Temp</span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: sysInfo?.temperature !== undefined && sysInfo.temperature !== undefined && sysInfo.temperature > 70 ? 'var(--danger)' : sysInfo?.temperature !== undefined && sysInfo.temperature > 55 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {sysInfo?.temperature !== undefined ? `${sysInfo.temperature.toFixed(1)}°C` : '-'}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Uptime</span>
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {uptimeSeconds > 0 ? `${Math.floor(uptimeSeconds / 86400)}d ${Math.floor((uptimeSeconds % 86400) / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m` : '-'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
