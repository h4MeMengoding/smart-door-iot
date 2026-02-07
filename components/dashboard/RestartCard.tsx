'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Power, RotateCcw, Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

type RestartState = 'idle' | 'confirming' | 'restarting' | 'success';

export function RestartCard() {
  const [state, setState] = useState<RestartState>('idle');

  const handleRestart = async () => {
    if (state === 'idle') {
      setState('confirming');
      return;
    }

    if (state === 'confirming') {
      setState('restarting');
      try {
        await api.restartEsp();
        setState('success');
        toast.success('ESP32 is restarting...');
        setTimeout(() => {
          setState('idle');
        }, 12000);
      } catch {
        toast.error('Failed to restart ESP32');
        setState('idle');
      }
    }
  };

  const handleCancel = () => {
    setState('idle');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--danger-light)' }}
          >
            <Power className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
          </div>
          <div>
            <CardTitle>Restart ESP32</CardTitle>
            <CardDescription>Reboot the device</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === 'idle' && (
          <>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Restart the ESP32 microcontroller. The device will be offline for approximately 10 seconds during reboot.
            </p>
            <Button
              onClick={handleRestart}
              variant="danger"
              size="lg"
              className="w-full rounded-2xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart Device
            </Button>
          </>
        )}

        {state === 'confirming' && (
          <>
            <div
              className="flex items-start gap-3 p-3.5 rounded-2xl"
              style={{
                background: 'var(--danger-light)',
                border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              }}
            >
              <Power className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--danger-text)' }}>
                  Are you sure?
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  The door will auto-lock and the device will be offline for ~10 seconds.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRestart}
                variant="danger"
                size="lg"
                className="flex-1 rounded-2xl"
              >
                <Power className="w-4 h-4 mr-2" />
                Confirm Restart
              </Button>
              <Button
                onClick={handleCancel}
                variant="secondary"
                size="lg"
                className="rounded-2xl"
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {state === 'restarting' && (
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl"
            style={{
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>
                Restarting ESP32...
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Please wait, device will be back online shortly.
              </p>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl"
            style={{
              background: 'var(--success-light)',
              border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
            }}
          >
            <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--success-text)' }}>
                Restart initiated
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                ESP32 should be back online in ~10 seconds.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
