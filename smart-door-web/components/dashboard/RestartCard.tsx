'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Power, RotateCcw, Loader2, CheckCircle, Clock, Timer, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { ScheduledRestartConfig } from '@/lib/types';
import { logSystemEvent } from '@/lib/systemEvents';
import toast from 'react-hot-toast';

type RestartState = 'idle' | 'confirming' | 'restarting' | 'success';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];

export function RestartCard() {
  const [state, setState] = useState<RestartState>('idle');
  const [schedule, setSchedule] = useState<ScheduledRestartConfig>({ mode: 0, hour: 3, interval: 6 });
  const [pendingSchedule, setPendingSchedule] = useState<ScheduledRestartConfig | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch current schedule from ESP32
  const fetchSchedule = useCallback(async () => {
    try {
      const config = await api.getScheduledRestart();
      setSchedule(config);
      setIsLoadingSchedule(false);
    } catch {
      setIsLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Countdown timer for scheduled restart
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (schedule.mode === 0) {
      setCountdown(null);
      return;
    }

    const updateCountdown = async () => {
      try {
        const espTime = await api.getEspTime();
        const now = new Date(espTime.epoch * 1000);
        const currentHour = espTime.hour;
        const currentMin = espTime.minute;
        const currentSec = espTime.second;

        let hoursUntil = 0;

        if (schedule.mode === 1) {
          // at_hour mode
          hoursUntil = schedule.hour - currentHour;
          if (hoursUntil <= 0) hoursUntil += 24;
        } else if (schedule.mode === 2) {
          // every_hours mode — next restart is at the next multiple of interval
          const nextRestart = Math.ceil((currentHour + 1) / schedule.interval) * schedule.interval;
          hoursUntil = nextRestart - currentHour;
          if (hoursUntil <= 0) hoursUntil += schedule.interval;
        }

        const totalSec = (hoursUntil * 3600) - (currentMin * 60) - currentSec;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);

        if (h > 0) {
          setCountdown(`${h}h ${m}m`);
        } else {
          setCountdown(`${m}m`);
        }
      } catch {
        setCountdown(null);
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 60000); // Update every minute

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [schedule.mode, schedule.hour, schedule.interval]);

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
        logSystemEvent('esp_restart', 'ESP32 restarted from restart card');
        setTimeout(() => setState('idle'), 12000);
      } catch {
        toast.error('Failed to restart ESP32');
        setState('idle');
      }
    }
  };

  const handleCancel = () => {
    setState('idle');
  };

  const handleOpenSchedule = () => {
    setPendingSchedule({ ...schedule });
    setShowSchedulePicker(true);
  };

  const handleSaveSchedule = async () => {
    if (!pendingSchedule) return;
    setIsSavingSchedule(true);
    try {
      const result = await api.setScheduledRestart(pendingSchedule);
      setSchedule(pendingSchedule);
      setShowSchedulePicker(false);
      setPendingSchedule(null);
      if (pendingSchedule.mode === 0) {
        toast.success('Scheduled restart disabled');
      } else if (pendingSchedule.mode === 1) {
        toast.success(`Restart scheduled daily at ${String(pendingSchedule.hour).padStart(2, '0')}:00`);
      } else {
        toast.success(`Restart scheduled every ${pendingSchedule.interval}h`);
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleCancelSchedule = () => {
    setShowSchedulePicker(false);
    setPendingSchedule(null);
  };

  const isScheduleActive = schedule.mode !== 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center relative"
            style={{ background: 'var(--danger-light)' }}
          >
            <Power className="w-4 h-4" style={{ color: 'var(--danger)' }} />
            {/* Red dot indicator when schedule is active */}
            {isScheduleActive && (
              <div
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{
                  background: 'var(--danger)',
                  boxShadow: '0 0 6px var(--danger)',
                }}
              />
            )}
          </div>
          <div>
            <CardTitle>Restart ESP32</CardTitle>
            <CardDescription>
              {isScheduleActive && countdown
                ? `Next restart in ${countdown}`
                : 'Reboot the device'
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Schedule Picker */}
        {showSchedulePicker && pendingSchedule ? (
          <div className="space-y-3">
            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Schedule Mode</p>
              <div className="flex gap-1.5">
                {[
                  { mode: 0, label: 'Off' },
                  { mode: 1, label: 'Daily at' },
                  { mode: 2, label: 'Every' },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setPendingSchedule({ ...pendingSchedule, mode })}
                    className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={{
                      background: pendingSchedule.mode === mode ? 'var(--primary)' : 'var(--bg-surface)',
                      color: pendingSchedule.mode === mode ? 'var(--primary-text)' : 'var(--text-muted)',
                      border: `1px solid ${pendingSchedule.mode === mode ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour picker for at_hour mode */}
            {pendingSchedule.mode === 1 && (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Restart at hour</p>
                <div className="relative">
                  <select
                    value={pendingSchedule.hour}
                    onChange={(e) => setPendingSchedule({ ...pendingSchedule, hour: parseInt(e.target.value) })}
                    className="w-full py-2.5 px-3 rounded-xl text-sm font-medium appearance-none cursor-pointer"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
              </div>
            )}

            {/* Interval picker for every_hours mode */}
            {pendingSchedule.mode === 2 && (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Restart every</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {INTERVAL_OPTIONS.map((h) => (
                    <button
                      key={h}
                      onClick={() => setPendingSchedule({ ...pendingSchedule, interval: h })}
                      className="py-2 rounded-xl text-xs font-semibold transition-all duration-200"
                      style={{
                        background: pendingSchedule.interval === h ? 'var(--primary)' : 'var(--bg-surface)',
                        color: pendingSchedule.interval === h ? 'var(--primary-text)' : 'var(--text-muted)',
                        border: `1px solid ${pendingSchedule.interval === h ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSaveSchedule}
                variant="primary"
                size="lg"
                className="flex-1 rounded-2xl"
                disabled={isSavingSchedule}
              >
                {isSavingSchedule ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
              <Button
                onClick={handleCancelSchedule}
                variant="secondary"
                size="lg"
                className="rounded-2xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Restart states */}
            {state === 'idle' && (
              <>
                {/* Schedule status badge */}
                {isScheduleActive && (
                  <div
                    className="flex items-center gap-2 p-3 rounded-2xl mb-1"
                    style={{
                      background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                    }}
                  >
                    {schedule.mode === 1 ? (
                      <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                    ) : (
                      <Timer className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                        {schedule.mode === 1
                          ? `Daily at ${String(schedule.hour).padStart(2, '0')}:00`
                          : `Every ${schedule.interval} hours`
                        }
                      </p>
                      {countdown && (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Next restart in {countdown}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Restart the ESP32 microcontroller. The device will be offline for approximately 10 seconds during reboot.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleRestart}
                    variant="danger"
                    size="lg"
                    className="flex-1 rounded-2xl"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Now
                  </Button>
                  <Button
                    onClick={handleOpenSchedule}
                    variant="secondary"
                    size="lg"
                    className="rounded-2xl"
                    title="Schedule restart"
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
