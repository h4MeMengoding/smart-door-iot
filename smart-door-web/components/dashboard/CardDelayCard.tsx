'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Hourglass, Save, CreditCard, Maximize2, X, Clock, RefreshCw, WifiOff, ChevronLeft, ChevronRight, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card as CardType, CardDelayConfig, CardDelayScheduleConfig, DoorStatus } from '@/lib/types';
import { api } from '@/lib/api';
import { formatUid } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { logSystemEvent } from '@/lib/systemEvents';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const VISIBLE_COUNT = 1;
const MAX_SCHEDULES = 5;

interface CardDelayCardProps {
  status?: DoorStatus | null;
}

export function CardDelayCard({ status }: CardDelayCardProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [schedules, setSchedules] = useState<CardDelayScheduleConfig[]>([]);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScheduleFor, setShowScheduleFor] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Schedule form state
  const [schedStartHour, setSchedStartHour] = useState(22);
  const [schedEndHour, setSchedEndHour] = useState(8);
  const [schedDelaySec, setSchedDelaySec] = useState(2);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [espNtpSynced, setEspNtpSynced] = useState<boolean | null>(null);

  const currentHour = status?.currentHour ?? new Date().getHours();
  const ntpSynced = status?.ntpSynced ?? null;

  useEffect(() => {
    if (ntpSynced !== null) setEspNtpSynced(ntpSynced);
  }, [ntpSynced]);

  const isScheduleActive = useCallback((startHour: number, endHour: number) => {
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    }
    return currentHour >= startHour || currentHour < endHour;
  }, [currentHour]);

  const getEffectiveDelay = useCallback((uid: string): { delay: number; isScheduled: boolean; schedule?: CardDelayScheduleConfig } => {
    if (enabled[uid] === false) return { delay: 0, isScheduled: false };
    const cardSchedules = schedules.filter((s) => s.cardUid === uid);
    for (const sched of cardSchedules) {
      if (isScheduleActive(sched.startHour, sched.endHour)) {
        return { delay: sched.delaySec, isScheduled: true, schedule: sched };
      }
    }
    return { delay: delays[uid] ?? 0, isScheduled: false };
  }, [schedules, delays, enabled, isScheduleActive]);

  const activeScheduleCount = useMemo(() => {
    return schedules.filter((s) => isScheduleActive(s.startHour, s.endHour)).length;
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
        const enabledMap: Record<string, boolean> = {};
        (configData.cardDelays || []).forEach((d: CardDelayConfig) => {
          delayMap[d.cardUid] = d.delaySec;
          enabledMap[d.cardUid] = d.enabled;
        });
        setDelays(delayMap);
        setEnabled(enabledMap);
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

  useEffect(() => {
    if (cards.length > 0 && currentCardIndex >= cards.length) {
      setCurrentCardIndex(Math.max(0, cards.length - 1));
    }
  }, [cards.length, currentCardIndex]);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardDelay: { cardUid: uid, delaySec } }),
      });
      if (!dbRes.ok) throw new Error('Failed to save');

      try {
        await api.pushCardDelay(uid, delaySec);
        toast.success(`${delaySec === 0 ? 'Instant unlock' : `${delaySec}s delay`} saved`);
        logSystemEvent('card_delay_changed', `Card ${uid} delay set to ${delaySec}s`);
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

  const handleToggleEnabled = async (uid: string) => {
    const newEnabled = !(enabled[uid] ?? true);
    setEnabled((prev) => ({ ...prev, [uid]: newEnabled }));
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableDelay: { cardUid: uid, enabled: newEnabled } }),
      });
      try {
        await api.setCardDelayEnabled(uid, newEnabled);
      } catch { /* ESP32 offline */ }
      toast.success(newEnabled ? 'Delay enabled' : 'Delay disabled');
      logSystemEvent('card_delay_toggle', `Card ${uid} delay ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      setEnabled((prev) => ({ ...prev, [uid]: !newEnabled }));
      toast.error('Failed to toggle delay');
    }
  };

  const handleBulkToggle = async (newEnabled: boolean) => {
    const allUids = cards.map((c) => c.uid);
    const prevEnabled = { ...enabled };
    const newEnabledMap: Record<string, boolean> = {};
    allUids.forEach((uid) => { newEnabledMap[uid] = newEnabled; });
    setEnabled(newEnabledMap);
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkEnableDelay: { cardUids: allUids, enabled: newEnabled } }),
      });
      try {
        await api.bulkSetCardDelayEnabled(allUids.map((uid) => ({ uid, enabled: newEnabled })));
      } catch { /* ESP32 offline */ }
      toast.success(`All delays ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      setEnabled(prevEnabled);
      toast.error('Failed to toggle delays');
    }
  };

  const getCardSchedules = (uid: string) => schedules.filter((s) => s.cardUid === uid);

  const getNextFreeSlot = (uid: string): number | null => {
    const used = new Set(getCardSchedules(uid).map((s) => s.slot ?? 0));
    for (let i = 0; i < MAX_SCHEDULES; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  };

  const handleAddSchedule = async (uid: string) => {
    const slot = getNextFreeSlot(uid);
    if (slot === null) {
      toast.error(`Max ${MAX_SCHEDULES} schedules per card`);
      return;
    }

    setSavingSchedule(true);
    try {
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardSchedule: { cardUid: uid, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec },
        }),
      });
      if (!dbRes.ok) throw new Error('Failed to save schedule');
      const updatedConfig = await dbRes.json();
      setSchedules(updatedConfig.cardSchedules || []);

      try {
        await api.pushCardSchedule(uid, slot, schedStartHour, schedEndHour, schedDelaySec);
        toast.success(`Schedule: ${schedStartHour.toString().padStart(2, '0')}:00-${schedEndHour.toString().padStart(2, '0')}:00 → ${schedDelaySec}s`);
        logSystemEvent('card_schedule_changed', `Card ${uid} schedule[${slot}]: ${schedStartHour}:00-${schedEndHour}:00 → ${schedDelaySec}s`);
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

  const handleRemoveSchedule = async (uid: string, startHour: number, endHour: number, slot?: number) => {
    try {
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeSchedule: { cardUid: uid, startHour, endHour } }),
      });
      if (dbRes.ok) {
        const updatedConfig = await dbRes.json();
        setSchedules(updatedConfig.cardSchedules || []);
      }
      try { await api.removeCardSchedule(uid, slot ?? 0); } catch { /* ESP32 offline */ }
      toast.success('Schedule removed');
      logSystemEvent('card_schedule_removed', `Card ${uid} schedule removed`);
    } catch {
      toast.error('Failed to remove schedule');
    }
  };

  const handleBulkAddSchedule = async () => {
    setSavingSchedule(true);
    try {
      const allUids = cards.map((c) => c.uid);
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bulkSchedule: { cardUids: allUids, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec },
        }),
      });
      if (!dbRes.ok) throw new Error('Failed to save bulk schedule');
      const updatedConfig = await dbRes.json();
      setSchedules(updatedConfig.cardSchedules || []);

      try {
        const bulkData = allUids.map((uid) => {
          const slot = getNextFreeSlot(uid) ?? 0;
          return { uid, slot, startHour: schedStartHour, endHour: schedEndHour, delaySec: schedDelaySec };
        });
        await api.pushBulkCardSchedules(bulkData);
        toast.success(`Schedule applied to ${allUids.length} cards`);
      } catch {
        toast.success('Saved to DB', { icon: '⚠️' });
        toast('ESP32 push failed', { icon: '📡', duration: 4000 });
      }
    } catch {
      toast.error('Failed to apply bulk schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!confirm('Clear all card delays, schedules, and enabled states?')) return;
    setClearing(true);
    try {
      const allUids = cards.map((c) => c.uid);
      // Clear DB: delays + schedules for each card
      for (const uid of allUids) {
        await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardDelay: { cardUid: uid, delaySec: 0 },
            removeSchedule: { cardUid: uid, all: true },
            enableDelay: { cardUid: uid, enabled: true },
          }),
        });
      }
      // Reset local state
      const newDelays: Record<string, number> = {};
      const newEnabled: Record<string, boolean> = {};
      allUids.forEach((uid) => { newDelays[uid] = 0; newEnabled[uid] = true; });
      setDelays(newDelays);
      setEnabled(newEnabled);
      setSchedules([]);

      // Clear ESP32
      try {
        for (const uid of allUids) {
          await api.pushCardDelay(uid, 0);
          await api.removeAllCardSchedules(uid);
        }
        await api.bulkSetCardDelayEnabled(allUids.map((uid) => ({ uid, enabled: true })));
        toast.success('All delays cleared');
      } catch {
        toast.success('DB cleared', { icon: '⚠️' });
        toast('ESP32 push failed — sync later', { icon: '📡', duration: 4000 });
      }
      logSystemEvent('card_delay_clear_all', `All card delays cleared for ${allUids.length} cards`);
    } catch {
      toast.error('Failed to clear delays');
    } finally {
      setClearing(false);
    }
  };

  const handleSyncToEsp = async () => {
    setSyncing(true);
    try {
      try {
        const espData = await api.getEspSchedules();
        setEspNtpSynced(espData.ntpSynced);
        if (!espData.ntpSynced) {
          toast('ESP32 NTP belum sync — schedule aktif setelah waktu tersinkron', { icon: '⏳', duration: 4000 });
        }
      } catch {
        toast.error('Cannot reach ESP32');
        setSyncing(false);
        return;
      }

      // Push enabled states
      const enabledCards = cards.map((c) => ({ uid: c.uid, enabled: enabled[c.uid] ?? true }));
      try { await api.bulkSetCardDelayEnabled(enabledCards); } catch { /* best effort */ }

      // Push all schedules
      if (schedules.length > 0) {
        // Assign slots per card
        const slotMap: Record<string, number> = {};
        const bulkData = schedules.map((s) => {
          const slot = slotMap[s.cardUid] ?? 0;
          slotMap[s.cardUid] = slot + 1;
          return { uid: s.cardUid, slot, startHour: s.startHour, endHour: s.endHour, delaySec: s.delaySec };
        });
        await api.pushBulkCardSchedules(bulkData);
        toast.success(`${schedules.length} schedule(s) synced to ESP32`);
      } else {
        const allUids = cards.map((c) => c.uid);
        if (allUids.length > 0) {
          for (const uid of allUids) {
            try { await api.removeAllCardSchedules(uid); } catch { /* best effort */ }
          }
        }
        toast.success('ESP32 schedules cleared');
      }
    } catch {
      toast.error('Sync failed — ESP32 may be offline');
    } finally {
      setSyncing(false);
    }
  };

  // ── Schedule Form (reusable) ──
  const renderScheduleForm = (onSave: () => void, label: string) => (
    <div className="space-y-2">
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
      <Button onClick={onSave} isLoading={savingSchedule} variant="primary" size="sm" className="w-full text-xs">
        <Plus className="w-3 h-3 mr-1" /> {label}
      </Button>
    </div>
  );

  // ── Schedule List ──
  const renderScheduleList = (uid: string) => {
    const cardScheds = getCardSchedules(uid);
    if (cardScheds.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {cardScheds.map((s, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] group"
            style={{
              background: isScheduleActive(s.startHour, s.endHour)
                ? 'color-mix(in srgb, var(--primary) 25%, transparent)'
                : 'color-mix(in srgb, var(--primary) 12%, transparent)',
              color: 'var(--primary)',
              fontWeight: isScheduleActive(s.startHour, s.endHour) ? 600 : 400,
            }}
          >
            <Clock className="w-2.5 h-2.5" />
            {s.startHour.toString().padStart(2, '0')}:00-{s.endHour.toString().padStart(2, '0')}:00 → {s.delaySec}s
            <button onClick={() => handleRemoveSchedule(uid, s.startHour, s.endHour, s.slot)}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
              title="Remove schedule"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // ── Per-Card Render ──
  const renderCardItem = (card: CardType, index: number) => {
    const uid = card.uid;
    const staticDelay = delays[uid] ?? 0;
    const isEnabled = enabled[uid] ?? true;
    const { delay: effectiveDelay, isScheduled } = getEffectiveDelay(uid);
    const isSavingThis = savingUid === uid;
    const cardScheds = getCardSchedules(uid);
    const isScheduleOpen = showScheduleFor === uid;
    const canAddSchedule = cardScheds.length < MAX_SCHEDULES;

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
          border: isEnabled ? '1px solid var(--border)' : '1px dashed var(--border)',
          opacity: isEnabled ? 1 : 0.6,
        }}
      >
        {/* Card header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--primary-light)' }}>
            <CreditCard className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {card.nickname || 'Unnamed Card'}
            </p>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {formatUid(uid)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums shrink-0"
              style={{
                background: !isEnabled
                  ? 'var(--bg-surface)'
                  : isScheduled ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                  : effectiveDelay > 0 ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--success-light)',
                color: !isEnabled
                  ? 'var(--text-muted)'
                  : isScheduled ? 'var(--primary)' : effectiveDelay > 0 ? 'var(--warning)' : 'var(--success-text)',
              }}
            >
              {!isEnabled ? 'Off' : effectiveDelay === 0 ? 'Instant' : `${effectiveDelay}s`}
            </div>
            <button onClick={() => handleToggleEnabled(uid)} className="p-0.5 transition-colors" title={isEnabled ? 'Disable delay' : 'Enable delay'}>
              {isEnabled
                ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              }
            </button>
          </div>
        </div>

        {isEnabled && (
          <>
            {/* Static delay slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>0s</span>
              <input type="range" min={0} max={30} value={staticDelay}
                onChange={(e) => handleDelayChange(uid, parseInt(e.target.value))}
                className="flex-1 min-w-0"
                style={{ accentColor: staticDelay > 0 ? 'var(--warning)' : 'var(--primary)' }}
              />
              <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>30s</span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button onClick={() => handleSave(uid)} isLoading={isSavingThis} variant="primary" size="sm" className="flex-1 text-xs">
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
              {canAddSchedule && (
                <button
                  onClick={() => {
                    if (!isFullscreen) { setShowScheduleFor(uid); setIsFullscreen(true); }
                    else { setShowScheduleFor(isScheduleOpen ? null : uid); }
                  }}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{
                    background: isScheduleOpen ? 'var(--primary-light)' : 'var(--bg-surface)',
                    color: isScheduleOpen ? 'var(--primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                  title="Add time-based schedule"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Existing schedules */}
            {cardScheds.length > 0 && (
              <div className="mt-2">
                {renderScheduleList(uid)}
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Base delay: {staticDelay === 0 ? 'instant' : `${staticDelay}s`} (outside schedules)
                </p>
              </div>
            )}

            {/* Schedule form */}
            <AnimatePresence>
              {isScheduleOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
                >
                  <div className="mt-2 p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Add schedule ({cardScheds.length}/{MAX_SCHEDULES})
                    </p>
                    {renderScheduleForm(() => handleAddSchedule(uid), 'Add Schedule')}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    );
  };

  // ── Fullscreen Modal ──
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
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Card Unlock Delays
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleBulkToggle(true)}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Enable all"
            >
              <ToggleRight className="w-3 h-3 inline mr-0.5" style={{ color: 'var(--primary)' }} /> All On
            </button>
            <button onClick={() => handleBulkToggle(false)}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Disable all"
            >
              <ToggleLeft className="w-3 h-3 inline mr-0.5" /> All Off
            </button>
            <button onClick={handleSyncToEsp}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              title="Sync all to ESP32"
            >
              <RefreshCw className={`w-3 h-3 inline mr-0.5 ${syncing ? 'animate-spin' : ''}`} /> Sync
            </button>
            <button onClick={handleClearAll} disabled={clearing}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--error)', border: '1px solid var(--border)' }}
              title="Clear all delays and schedules"
            >
              <Trash2 className={`w-3 h-3 inline mr-0.5 ${clearing ? 'animate-pulse' : ''}`} /> Clear All
            </button>
            <button onClick={() => setIsFullscreen(false)} className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk schedule form */}
        <div className="px-4 pt-3">
          <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Bulk Schedule — All {cards.length} Cards
            </p>
            {espNtpSynced === false && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium"
                style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
              >
                <WifiOff className="w-3 h-3 shrink-0" />
                ESP32 NTP not synced — schedules won&apos;t activate until time is synced
              </div>
            )}
            {renderScheduleForm(handleBulkAddSchedule, `Add to All ${cards.length} Cards`)}
          </div>
        </div>

        {/* Card list */}
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

  // ── Compact Card View ──
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
            {cards.length > 1 && (
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
              {activeScheduleCount > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium"
                  style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--primary)' }}>
                    {activeScheduleCount} schedule{activeScheduleCount > 1 ? 's' : ''} active now
                  </span>
                </div>
              )}
              {cards.length > 1 && (
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentCardIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentCardIndex === 0}
                      className="p-1 rounded-lg transition-colors disabled:opacity-30"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {currentCardIndex + 1} / {cards.length}
                    </span>
                    <button
                      onClick={() => setCurrentCardIndex((prev) => Math.min(cards.length - 1, prev + 1))}
                      disabled={currentCardIndex >= cards.length - 1}
                      className="p-1 rounded-lg transition-colors disabled:opacity-30"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {cards.slice(currentCardIndex, currentCardIndex + VISIBLE_COUNT).map((card, index) => renderCardItem(card, currentCardIndex + index))}
              </AnimatePresence>
              {cards.length > 1 && (
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
