'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import {
  X, Wifi, Volume2, Sun, Moon, Clock, RefreshCw, Terminal,
  ChevronRight, Monitor,
} from 'lucide-react';
import { getMqttWsUrl } from '@/lib/config';
import { api } from '@/lib/api';
import { EspTime } from '@/lib/types';
import { useTheme } from '@/components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { logSystemEvent } from '@/lib/systemEvents';
import { PWAInstallSection, NotificationPreferencesSection } from './PWASettings';
import { SecuritySettings } from './SecuritySettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ─── Section label ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </p>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [mqttWsUrl] = useState(() => getMqttWsUrl());
  const [isRestarting, setIsRestarting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { theme, setTheme } = useTheme();

  // ESP32 Clock
  const [espTime, setEspTime] = useState<EspTime | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timePushedRef = useRef(false);

  // Event log
  const [events, setEvents] = useState<{ id: string; eventType: string; description: string | null; createdAt: string }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEspTime();
      clockIntervalRef.current = setInterval(fetchEspTime, 2000);
      fetchEvents();
    }
    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const fetchEspTime = async () => {
    try {
      const t = await api.getEspTime();
      setEspTime(t);
      if (!t.ntpSynced && !timePushedRef.current) {
        timePushedRef.current = true;
        try {
          const epoch = Math.floor(Date.now() / 1000);
          const result = await api.setEspTime(epoch);
          if (result.success) {
            toast.success(`Time set from browser: ${result.time}`);
            logSystemEvent('time_set', `Time set from browser (auto): ${result.time}`);
            const updated = await api.getEspTime();
            setEspTime(updated);
          }
        } catch { /* ignore */ }
      }
    } catch { /* esp offline */ }
  };

  const handleSyncTime = async () => {
    setIsSyncing(true);
    try {
      const result = await api.syncEspTime();
      if (result.success) {
        toast.success(`NTP synced: ${result.time || 'OK'}`);
        logSystemEvent('ntp_sync', `NTP synced: ${result.time}`);
        await fetchEspTime();
      } else {
        toast('NTP failed, pushing browser time...', { icon: '⏱️' });
        const epoch = Math.floor(Date.now() / 1000);
        const pushResult = await api.setEspTime(epoch);
        if (pushResult.success) {
          toast.success(`Time set from browser: ${pushResult.time}`);
          logSystemEvent('time_set', `Time set from browser (manual): ${pushResult.time}`);
          await fetchEspTime();
        } else toast.error('Failed to set time');
      }
    } catch {
      try {
        const epoch = Math.floor(Date.now() / 1000);
        const pushResult = await api.setEspTime(epoch);
        if (pushResult.success) {
          toast.success(`Time set from browser: ${pushResult.time}`);
          logSystemEvent('time_set', `Time set from browser (fallback): ${pushResult.time}`);
          await fetchEspTime();
        } else toast.error('Failed to sync time');
      } catch { toast.error('Failed to sync time'); }
    } finally { setIsSyncing(false); }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/system-events');
      if (res.ok) setEvents(await res.json());
    } catch { /* ignore */ } finally { setEventsLoading(false); }
  };

  const handleRestartEsp = async () => {
    if (!confirm('Restart the ESP32? It will be offline for a few seconds.')) return;
    setIsRestarting(true);
    try {
      await api.restartEsp();
      toast.success('ESP32 is restarting...');
      logSystemEvent('esp_restart', 'ESP32 restarted from settings');
      setTimeout(() => { toast.success('ESP32 should be back online'); setIsRestarting(false); }, 10000);
    } catch { toast.error('Failed to restart'); setIsRestarting(false); }
  };

  const handleTestBuzzer = async () => {
    setIsTesting(true);
    try {
      await api.playBuzzer('VALID_CARD');
      toast.success('Buzzer test sent');
      logSystemEvent('buzzer_test', 'Buzzer test played');
    } catch { toast.error('Failed to test buzzer'); }
    finally { setIsTesting(false); }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      toast.loading('Testing...', { id: 'test-conn' });
      const status = await api.getDoorStatus();
      toast.success(`Connected! Door: ${status.doorStatus}`, { id: 'test-conn' });
    } catch { toast.error('Connection failed', { id: 'test-conn' }); }
    finally { setIsTesting(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Panel — bottom sheet on mobile, centered modal on desktop */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full sm:max-w-md max-h-[92dvh] sm:max-h-[85vh] overflow-hidden sm:mx-4 rounded-t-2xl sm:rounded-2xl flex flex-col"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-5 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {/* Mobile drag indicator */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full sm:hidden" style={{ background: 'var(--border-strong)' }} />
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5">

              {/* ─── GENERAL ─── */}
              <div>
                <SectionLabel>General</SectionLabel>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--primary-light)' }}
                    >
                      {theme === 'dark'
                        ? <Moon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                        : <Sun className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                      }
                    </div>
                    <p className="flex-1 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</p>
                    <div
                      className="flex rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      {(['light', 'dark'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className="px-3 py-1.5 text-[11px] font-semibold transition-all flex items-center gap-1.5"
                          style={{
                            background: theme === t ? 'var(--primary)' : 'var(--bg-surface)',
                            color: theme === t ? 'var(--primary-text)' : 'var(--text-muted)',
                          }}
                        >
                          {t === 'light' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── SECURITY ─── */}
              <div>
                <SectionLabel>Security</SectionLabel>
                <SecuritySettings />
              </div>

              {/* ─── NOTIFICATIONS ─── */}
              <div>
                <SectionLabel>Notifications</SectionLabel>
                <div className="space-y-2">
                  <PWAInstallSection />
                  <NotificationPreferencesSection />
                </div>
              </div>

              {/* ─── DEVICE ─── */}
              <div>
                <SectionLabel>Device</SectionLabel>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {/* ESP32 Clock */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-3"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--info) 12%, transparent)' }}
                    >
                      <Clock className="w-4 h-4" style={{ color: 'var(--info)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>ESP32 Clock</p>
                        {espTime && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: espTime.ntpSynced ? 'var(--success-light)' : 'var(--warning-light)',
                              color: espTime.ntpSynced ? 'var(--success-text)' : 'var(--warning-text)',
                            }}
                          >
                            {espTime.ntpSynced ? 'NTP' : 'No NTP'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {espTime ? `${espTime.time} · ${espTime.date}` : 'Loading...'}
                      </p>
                    </div>
                    <Button
                      onClick={handleSyncTime}
                      isLoading={isSyncing}
                      variant="secondary"
                      size="sm"
                      className="text-[11px] !px-2.5 !py-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                  </div>

                  <div style={{ height: 1, background: 'var(--border)' }} />

                  {/* MQTT */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-3"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--secondary, var(--primary)) 12%, transparent)' }}
                    >
                      <Wifi className="w-4 h-4" style={{ color: 'var(--secondary, var(--primary))' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>MQTT</p>
                      <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>{mqttWsUrl}</p>
                    </div>
                    <Button
                      onClick={handleTestConnection}
                      variant="secondary"
                      size="sm"
                      disabled={isTesting}
                      className="text-[11px] !px-2.5 !py-1.5"
                    >
                      Test
                    </Button>
                  </div>

                  <div style={{ height: 1, background: 'var(--border)' }} />

                  {/* Buzzer */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-3"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}
                    >
                      <Volume2 className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Test Buzzer</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Play sound on ESP32</p>
                    </div>
                    <Button
                      onClick={handleTestBuzzer}
                      isLoading={isTesting}
                      variant="secondary"
                      size="sm"
                      className="text-[11px] !px-2.5 !py-1.5"
                    >
                      <Volume2 className="w-3 h-3 mr-1" />
                      Play
                    </Button>
                  </div>

                  <div style={{ height: 1, background: 'var(--border)' }} />

                  {/* Restart */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-3"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--danger-light)' }}
                    >
                      <Monitor className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Restart ESP32</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Device will be offline briefly</p>
                    </div>
                    <Button
                      onClick={handleRestartEsp}
                      isLoading={isRestarting}
                      variant="secondary"
                      size="sm"
                      className="text-[11px] !px-2.5 !py-1.5"
                    >
                      Restart
                    </Button>
                  </div>
                </div>
              </div>

              {/* ─── SYSTEM LOG ─── */}
              <div>
                <SectionLabel>System Log</SectionLabel>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setShowEventLog(p => !p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)' }}
                    >
                      <Terminal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Event Log</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {events.length} events recorded
                      </p>
                    </div>
                    <ChevronRight
                      className="w-3.5 h-3.5 transition-transform"
                      style={{ color: 'var(--text-muted)', transform: showEventLog ? 'rotate(90deg)' : 'rotate(0)' }}
                    />
                  </button>

                  <AnimatePresence>
                    {showEventLog && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          <div
                            className="h-40 overflow-y-auto overflow-x-hidden p-3 font-mono text-[10px] leading-relaxed space-y-0.5"
                            style={{ background: '#0d1117', color: '#8b949e' }}
                          >
                            {eventsLoading ? (
                              <div className="flex items-center justify-center h-full">
                                <span style={{ color: '#58a6ff' }}>Loading...</span>
                              </div>
                            ) : events.length === 0 ? (
                              <div className="flex items-center justify-center h-full">
                                <span style={{ color: '#484f58' }}>No events</span>
                              </div>
                            ) : (
                              events.map((evt) => {
                                const ts = new Date(evt.createdAt);
                                const timeStr = ts.toLocaleTimeString('en-US', { hour12: false });
                                const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                                const typeColor = evt.eventType.includes('error') || evt.eventType.includes('denied')
                                  ? '#f85149'
                                  : evt.eventType.includes('unlock') || evt.eventType.includes('granted') || evt.eventType.includes('success')
                                    ? '#3fb950'
                                    : evt.eventType.includes('warn')
                                      ? '#d29922'
                                      : '#58a6ff';
                                return (
                                  <div key={evt.id} className="flex gap-2 whitespace-nowrap">
                                    <span style={{ color: '#484f58' }}>{dateStr} {timeStr}</span>
                                    <span style={{ color: typeColor }}>[{evt.eventType}]</span>
                                    <span className="truncate" style={{ color: '#c9d1d9' }}>{evt.description || '—'}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="px-3 py-2" style={{ borderTop: '1px solid #21262d' }}>
                            <button
                              onClick={fetchEvents}
                              className="flex items-center gap-1.5 text-[10px] font-medium"
                              style={{ color: '#58a6ff' }}
                            >
                              <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
