'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Timer, Save, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { API_KEY } from '@/lib/config';
import { logSystemEvent } from '@/lib/systemEvents';
import toast from 'react-hot-toast';

interface AutoLockCardProps {
  currentDuration?: number; // from ESP32 status
}

export function AutoLockCard({ currentDuration }: AutoLockCardProps) {
  const [duration, setDuration] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load config from database on mount
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setDuration(data.autoLockDuration ?? 5);
      }
    } catch {
      // Use default
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (duration < 1 || duration > 10) {
      toast.error('Duration must be between 1-10 seconds');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Save to database
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ autoLockDuration: duration }),
      });

      if (!dbRes.ok) throw new Error('Failed to save to database');

      // 2. Push to ESP32
      try {
        await api.pushAutoLockDuration(duration);
        toast.success(`Auto-lock set to ${duration}s`);
        logSystemEvent('autolock_changed', `Auto-lock duration set to ${duration}s`);
      } catch {
        toast.success(`Saved to database (${duration}s)`, { icon: '⚠️' });
        toast('ESP32 push failed — will apply on next sync', {
          icon: '📡',
          duration: 4000,
        });
      }
    } catch {
      toast.error('Failed to save auto-lock duration');
    } finally {
      setIsSaving(false);
    }
  };

  const liveDuration = currentDuration ?? duration;
  const isOutOfSync = isLoaded && currentDuration !== undefined && currentDuration !== duration;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <Timer className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>Auto-Lock Timer</CardTitle>
            <CardDescription>Duration before auto-lock</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current live value */}
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {liveDuration}<span className="text-base font-normal ml-1" style={{ color: 'var(--text-muted)' }}>sec</span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Door auto-locks after unlocking
            </p>
          </div>

          {/* Slider */}
          <div>
            <input
              type="range"
              min={1}
              max={10}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: 'var(--primary)' }}
            />
            <div className="flex justify-between text-[10px] mt-1 px-0.5" style={{ color: 'var(--text-muted)' }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i + 1} className={duration === i + 1 ? 'font-bold' : ''} style={duration === i + 1 ? { color: 'var(--primary)' } : undefined}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>

          {/* Out of sync warning */}
          {isOutOfSync && (
            <div
              className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
              style={{
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
                color: 'var(--warning)',
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>ESP32 reports {currentDuration}s — save to sync</span>
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            variant="primary"
            size="sm"
            className="w-full"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save & Push to ESP32
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
