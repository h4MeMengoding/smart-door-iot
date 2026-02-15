'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Hourglass, Save, CreditCard, Maximize2, X, Clock, Users, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Card as CardType, CardDelayConfig, CardDelayScheduleConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { API_KEY } from '@/lib/config';
import { formatUid } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const VISIBLE_COUNT = 3;

export function CardDelayCard() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [schedules, setSchedules] = useState<CardDelayScheduleConfig[]>([]);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScheduleFor, setShowScheduleFor] = useState<string | null>(null);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);

  // Schedule form state
  const [schedStartHour, setSchedStartHour] = useState(22);
  const [schedEndHour, setSchedEndHour] = useState(8);
  const [schedDelaySec, setSchedDelaySec] = useState(2);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [espNtpSynced, setEspNtpSynced] = useState<boolean | null>(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if a schedule is currently active
  const isScheduleActive = useCallback((startHour: number, endHour: number) => {
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Wrapping: e.g. 22:00-08:00
      return currentHour >= startHour || currentHour < endHour;
    }
  }, [currentHour]);

  // Get effective delay for a card (schedule overrides static)
  const getEffectiveDelay = useCallback((uid: string): { delay: number; isScheduled: boolean; schedule?: CardDelayScheduleConfig } => {
    const cardSchedules = schedules.filter((s) => s.cardUid === uid);
    for (const sched of cardSchedules) {
      if (isScheduleActive(sched.startHour, sched.endHour)) {
        return { delay: sched.delaySec, isScheduled: true, schedule: sched };
      }
    }
    return { delay: delays[uid] ?? 0, isScheduled: false };
  }, [schedules, delays, isScheduleActive]);

  // Check if any schedule is currently active
  const activeScheduleInfo = useMemo(() => {
    for (const sched of schedules) {
      if (isScheduleActive(sched.startHour, sched.endHour)) {
        return sched;
      }
    }
    return null;
  }, [schedules, isScheduleActive]);

  const loadData = useCallback(async () => {
    try {
      const [cardsRes, configRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/config'),
      ]);

      if (cardsRes.ok) {
        const cardsData: CardType[] = await cardsRes.json();
        setCards(cardsData);
      }

      if (configRes.ok) {
        const configData = await configRes.json();
        const delayMap: Record<string, number> = {};
        (configData.cardDelays || []).forEach((d: CardDelayConfig) => {
          delayMap[d.cardUid] = d.delaySec;
        });
        setDelays(delayMap);
        setSchedules(configData.cardSchedules || []);
      }
    } catch {
      // Use defaults
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const u1 = dashboardEvents.on('cards-changed', loadData);
    const u2 = dashboardEvents.on('card-renamed', loadData);
    return () => { u1(); u2(); };
  }, [loadData]);

  const handleDelayChange = (uid: string, value: number) => {
    setDelays((prev) => ({ ...prev, [uid]: value }));
  };

  const handleSave = async (uid: string) => {
    const delaySec = delays[uid] ?? 0;
    if (delaySec < 0 || delaySec > 30) {
      toast.error('Delay must be 0-30 seconds');
      return;
    }

    setSavingUid(uid);
    try {
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ cardDelay: { cardUid: uid, delaySec } }),
      });
      if (!dbRes.ok) throw new Error('Failed to save');

      try {
        await api.pushCardDelay(uid, delaySec);
        toast.success(`${delaySec === 0 ? 'Instant unlock' : `${delaySec}s delay`} saved`);
      } catch {
        toast.success('Saved to database', { icon: '⚠️' });
        toast('ESP32 push failed — will apply on next sync', { icon: '📡', duration: 4000 });
      }
    } catch {
      toast.error('Failed to save card delay');
    } finally {
      setSavingUid(null);
    }
  };

  const handleSaveSchedule = async (uid: string) => {
    setSavingSchedule(true);
    try {
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          cardSchedule: { cardUid: uid, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec },
        }),
      });
      if (!dbRes.ok) throw new Error('Failed to save schedule');
      const updatedConfig = await dbRes.json();
      setSchedules(updatedConfig.cardSchedules || []);

      try {
        await api.pushCardSchedule(uid, schedStartHour, schedEndHour, schedDelaySec);
        toast.success(`Schedule: ${schedStartHour}:00-${schedEndHour}:00 → ${schedDelaySec}s`);
      } catch {
        toast.success('Schedule saved to DB', { icon: '⚠️' });
        toast('ESP32 push failed — will apply on next sync', { icon: '📡', duration: 4000 });
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRemoveSchedule = async (uid: string, startHour: number, endHour: number) => {
    try {
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ removeSchedule: { cardUid: uid, startHour, endHour } }),
      });
      if (dbRes.ok) {
        const updatedConfig = await dbRes.json();
        setSchedules(updatedConfig.cardSchedules || []);
      }
      try { await api.removeCardSchedule(uid); } catch { /* ESP32 offline */ }
      toast.success('Schedule removed');
    } catch {
      toast.error('Failed to remove schedule');
    }
  };

  const handleBulkSchedule = async () => {
    setSavingSchedule(true);
    try {
      const allUids = cards.map((c) => c.uid);
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          bulkSchedule: { cardUids: allUids, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec },
        }),
      });
      if (!dbRes.ok) throw new Error('Failed to save bulk schedule');
      const updatedConfig = await dbRes.json();
      setSchedules(updatedConfig.cardSchedules || []);

      try {
        const bulkData = allUids.map((uid) => ({
          uid, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec,
        }));
        await api.pushBulkCardSchedules(bulkData);
        toast.success(`Bulk schedule applied to ${allUids.length} cards`);
      } catch {
        toast.success('Saved to DB', { icon: '⚠️' });
        toast('ESP32 push failed', { icon: '📡', duration: 4000 });
      }
      setShowBulkSchedule(false);
    } catch {
      toast.error('Failed to apply bulk schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleBulkRemoveSchedules = async () => {
    setSavingSchedule(true);
    try {
      const allUids = cards.map((c) => c.uid);
      // Remove from DB for each card
      for (const uid of allUids) {
        await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ removeSchedule: { cardUid: uid, all: true } }),
        });
      }
      setSchedules([]);

      // Remove from ESP32
      try {
        const bulkData = allUids.map((uid) => ({ uid, remove: true, startHour: 0, endHour: 0, delaySec: 0 }));
        await api.pushBulkCardSchedules(bulkData);
        toast.success(`All schedules removed from ${allUids.length} cards`);
      } catch {
        toast.success('Removed from DB', { icon: '⚠️' });
        toast('ESP32 push failed', { icon: '📡', duration: 4000 });
      }
      setShowBulkSchedule(false);
    } catch {
      toast.error('Failed to remove schedules');
    } finally {
      setSavingSchedule(false);
    }
  };

  const getCardSchedules = (uid: string) => schedules.filter((s) => s.cardUid === uid);

  // Sync all DB schedules to ESP32
  const handleSyncToEsp = async () => {
    setSyncing(true);
    try {
      // First check ESP32 status
      try {
        const espData = await api.getEspSchedules();
        setEspNtpSynced(espData.ntpSynced);
        if (!espData.ntpSynced) {
          toast('ESP32 NTP belum sync — schedule akan aktif setelah waktu tersinkron', { icon: '⏳', duration: 4000 });
        }
      } catch {
        toast.error('Cannot reach ESP32');
        setSyncing(false);
        return;
      }

      // Push all schedules from DB to ESP32
      if (schedules.length > 0) {
        const bulkData = schedules.map((s) => ({
          uid: s.cardUid,
          startHour: s.startHour,
          endHour: s.endHour,
          delaySec: s.delaySec,
        }));
        await api.pushBulkCardSchedules(bulkData);
        toast.success(`${schedules.length} schedule(s) synced to ESP32${espNtpSynced === false ? ' (NTP pending)' : ''}`);
      } else {
        // Remove all schedules from ESP32
        const allUids = cards.map((c) => c.uid);
        if (allUids.length > 0) {
          const bulkData = allUids.map((uid) => ({ uid, remove: true, startHour: 0, endHour: 0, delaySec: 0 }));
          await api.pushBulkCardSchedules(bulkData);
        }
        toast.success('ESP32 schedules cleared');
      }

      // Verify by reading back
      try {
        const verify = await api.getEspSchedules();
        const espCount = verify.schedules.length;
        const dbCount = schedules.length;
        if (espCount !== dbCount) {
          toast(`ESP32 has ${espCount}/${dbCount} schedules`, { icon: '⚠️', duration: 4000 });
        }
      } catch { /* verification optional */ }
    } catch {
      toast.error('Sync failed — ESP32 may be offline');
    } finally {
      setSyncing(false);
    }
  };

  const renderCardItem = (card: CardType, index: number) => {
    const uid = card.uid;
    const staticDelay = delays[uid] ?? 0;
    const { delay: effectiveDelay, isScheduled, schedule: activeSchedule } = getEffectiveDelay(uid);
    const isSavingThis = savingUid === uid;
    const cardSchedules = getCardSchedules(uid);
    const isScheduleOpen = showScheduleFor === uid;

    return (
      <motion.div
        key={uid}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ delay: index * 0.04 }}
        className="p-3 rounded-xl"
        style={{
          background: 'var(--bg-surface-hover)',
          border: isScheduled ? '1.5px solid var(--primary)' : '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: isScheduled ? 'var(--primary-light)' : 'var(--primary-light)' }}>
            {isScheduled ? <Clock className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} /> : <CreditCard className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {card.nickname || 'Unnamed Card'}
            </p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {formatUid(uid)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums shrink-0"
              style={{
                background: isScheduled
                  ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                  : effectiveDelay > 0 ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--success-light)',
                color: isScheduled ? 'var(--primary)' : effectiveDelay > 0 ? 'var(--warning)' : 'var(--success-text)',
              }}
            >
              {effectiveDelay === 0 ? 'Instant' : `${effectiveDelay}s`}
            </div>
            {isScheduled && activeSchedule && (
              <span className="text-[9px] font-medium" style={{ color: 'var(--primary)' }}>
                {activeSchedule.startHour.toString().padStart(2, '0')}:00-{activeSchedule.endHour.toString().padStart(2, '0')}:00
              </span>
            )}
          </div>
        </div>

        {isScheduled && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 rounded-lg text-[10px]"
            style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--primary)' }}
          >
            <Clock className="w-3 h-3 shrink-0" />
            <span>Schedule active — base delay ({staticDelay === 0 ? 'instant' : `${staticDelay}s`}) resumes at {activeSchedule!.endHour.toString().padStart(2, '0')}:00</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>0s</span>
          <input type="range" min={0} max={30} value={isScheduled ? effectiveDelay : staticDelay}
            onChange={(e) => !isScheduled && handleDelayChange(uid, parseInt(e.target.value))}
            className="flex-1 min-w-0"
            style={{
              accentColor: isScheduled ? 'var(--primary)' : staticDelay > 0 ? 'var(--warning)' : 'var(--primary)',
              opacity: isScheduled ? 0.6 : 1,
            }}
            disabled={isScheduled}
          />
          <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>30s</span>
        </div>
        {isScheduled && (
          <p className="text-[9px] mt-0.5 text-center" style={{ color: 'var(--text-muted)' }}>
            Slider locked during schedule — base delay: {staticDelay === 0 ? 'instant' : `${staticDelay}s`}
          </p>
        )}

        {cardSchedules.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {cardSchedules.map((s, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
              >
                <Clock className="w-2.5 h-2.5" />
                {s.startHour.toString().padStart(2, '0')}:00-{s.endHour.toString().padStart(2, '0')}:00 → {s.delaySec}s
                <button onClick={() => handleRemoveSchedule(uid, s.startHour, s.endHour)} className="ml-0.5 hover:opacity-70">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          <Button onClick={() => handleSave(uid)} isLoading={isSavingThis} variant="primary" size="sm" className="flex-1 text-xs">
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
          <button
            onClick={() => {
              if (!isFullscreen) {
                // In compact view: open fullscreen with this card's schedule open
                setShowScheduleFor(uid);
                setIsFullscreen(true);
              } else {
                setShowScheduleFor(isScheduleOpen ? null : uid);
              }
            }}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              background: isScheduleOpen ? 'var(--primary-light)' : 'var(--bg-surface)',
              color: isScheduleOpen ? 'var(--primary)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            title="Time-based schedule"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>

        <AnimatePresence>
          {isScheduleOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
            >
              <div className="mt-2 p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>Time-based delay schedule</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>From</label>
                    <select value={schedStartHour} onChange={(e) => setSchedStartHour(parseInt(e.target.value))}
                      className="w-full px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>To</label>
                    <select value={schedEndHour} onChange={(e) => setSchedEndHour(parseInt(e.target.value))}
                      className="w-full px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Delay</label>
                    <select value={schedDelaySec} onChange={(e) => setSchedDelaySec(parseInt(e.target.value))}
                      className="w-full px-2 py-1 rounded-md text-xs"
                      style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    >
                      {[1, 2, 3, 5, 7, 10, 15, 20, 30].map((s) => (<option key={s} value={s}>{s}s</option>))}
                    </select>
                  </div>
                </div>
                <Button onClick={() => handleSaveSchedule(uid)} isLoading={savingSchedule} variant="primary" size="sm" className="w-full text-xs">
                  <Clock className="w-3 h-3 mr-1" /> Save Schedule
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderBulkScheduleForm = () => (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
    >
      <div className="p-3 rounded-xl space-y-2.5" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Bulk Schedule — All {cards.length} Cards
          </p>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Apply the same time-based delay to all registered cards. Repeats daily.
        </p>
        {activeScheduleInfo && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)' }}
          >
            <Clock className="w-3 h-3 shrink-0" />
            Active now: {activeScheduleInfo.startHour.toString().padStart(2, '0')}:00-{activeScheduleInfo.endHour.toString().padStart(2, '0')}:00 → {activeScheduleInfo.delaySec}s delay
          </div>
        )}
        {espNtpSynced === false && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
          >
            <WifiOff className="w-3 h-3 shrink-0" />
            ESP32 NTP not synced — schedules won&apos;t activate until time is synced
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>From</label>
            <select value={schedStartHour} onChange={(e) => setSchedStartHour(parseInt(e.target.value))}
              className="w-full px-2 py-1 rounded-md text-xs"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>To</label>
            <select value={schedEndHour} onChange={(e) => setSchedEndHour(parseInt(e.target.value))}
              className="w-full px-2 py-1 rounded-md text-xs"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Delay</label>
            <select value={schedDelaySec} onChange={(e) => setSchedDelaySec(parseInt(e.target.value))}
              className="w-full px-2 py-1 rounded-md text-xs"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              {[1, 2, 3, 5, 7, 10, 15, 20, 30].map((s) => (<option key={s} value={s}>{s}s</option>))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBulkSchedule} isLoading={savingSchedule} variant="primary" size="sm" className="flex-1 text-xs">
            <Users className="w-3 h-3 mr-1" /> Apply to All
          </Button>
          <Button onClick={handleSyncToEsp} isLoading={syncing} variant="secondary" size="sm" className="text-xs"
            title="Re-sync all schedules from database to ESP32"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </Button>
          {schedules.length > 0 && (
            <Button onClick={handleBulkRemoveSchedules} isLoading={savingSchedule} variant="secondary" size="sm" className="text-xs"
              style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
            >
              <X className="w-3 h-3 mr-1" /> Remove All
            </Button>
          )}
          <Button onClick={() => setShowBulkSchedule(false)} variant="secondary" size="sm" className="text-xs">
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderFullscreen = () => (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col my-[5vh] mx-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Card Unlock Delays ({cards.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkSchedule(!showBulkSchedule)}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                background: showBulkSchedule ? 'var(--primary-light)' : 'var(--bg-surface-hover)',
                color: showBulkSchedule ? 'var(--primary)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
              title="Bulk schedule"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showBulkSchedule && <div className="px-4 pt-3">{renderBulkScheduleForm()}</div>}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => renderCardItem(card, index))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
              <Hourglass className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1">
              <CardTitle>Card Unlock Delay</CardTitle>
              <CardDescription>Response time after scan</CardDescription>
            </div>
            {cards.length > VISIBLE_COUNT && (
              <button onClick={() => setIsFullscreen(true)} className="p-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                title="View all cards"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isLoaded ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--bg-surface-hover)' }}>
                <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No cards registered</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Register a card first to set unlock delays</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeScheduleInfo && (
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium"
                  style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--primary)' }}>
                    Schedule active: {activeScheduleInfo.startHour.toString().padStart(2, '0')}:00-{activeScheduleInfo.endHour.toString().padStart(2, '0')}:00 → {activeScheduleInfo.delaySec}s delay for all cards
                  </span>
                </div>
              )}
              {cards.length > 1 && (
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => { setShowBulkSchedule(true); setIsFullscreen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{
                      background: 'var(--bg-surface-hover)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <Users className="w-3 h-3" /> Bulk Schedule
                  </button>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {cards.slice(0, VISIBLE_COUNT).map((card, index) => renderCardItem(card, index))}
              </AnimatePresence>
              {cards.length > VISIBLE_COUNT && (
                <button onClick={() => setIsFullscreen(true)}
                  className="w-full py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
                  style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  <Maximize2 className="w-3 h-3" /> View all {cards.length} cards
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AnimatePresence>{isFullscreen && renderFullscreen()}</AnimatePresence>
    </>
  );
}
