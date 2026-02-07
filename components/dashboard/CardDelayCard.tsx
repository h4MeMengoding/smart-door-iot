'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Hourglass, Save, CreditCard, Trash2 } from 'lucide-react';
import { Card as CardType, CardDelayConfig } from '@/lib/types';
import { api } from '@/lib/api';
import { API_KEY } from '@/lib/config';
import { formatUid } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export function CardDelayCard() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

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
      // 1. Save to database
      const dbRes = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ cardDelay: { cardUid: uid, delaySec } }),
      });

      if (!dbRes.ok) throw new Error('Failed to save');

      // 2. Push to ESP32
      try {
        await api.pushCardDelay(uid, delaySec);
        toast.success(`${delaySec === 0 ? 'Instant unlock' : `${delaySec}s delay`} saved`);
      } catch {
        toast.success('Saved to database', { icon: '⚠️' });
        toast('ESP32 push failed — will apply on next sync', {
          icon: '📡',
          duration: 4000,
        });
      }
    } catch {
      toast.error('Failed to save card delay');
    } finally {
      setSavingUid(null);
    }
  };

  const handleRemoveDelay = async (uid: string) => {
    handleDelayChange(uid, 0);
    setSavingUid(uid);
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ cardDelay: { cardUid: uid, delaySec: 0 } }),
      });
      try {
        await api.pushCardDelay(uid, 0);
      } catch {
        // ESP32 offline
      }
      toast.success('Delay removed');
    } catch {
      toast.error('Failed to remove delay');
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <Hourglass className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          </div>
          Card Unlock Delay
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isLoaded ? (
          <div className="flex items-center justify-center py-6">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-6">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
              No cards registered
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Register a card first to set unlock delays
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Set delay before door unlocks per card (0 = instant)
            </p>

            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => {
                const uid = card.uid;
                const delay = delays[uid] ?? 0;
                const isSavingThis = savingUid === uid;

                return (
                  <motion.div
                    key={uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.04 }}
                    className="p-3 rounded-xl"
                    style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {card.nickname || 'Unnamed Card'}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {formatUid(uid)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <div
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums"
                          style={{
                            background: delay > 0
                              ? 'color-mix(in srgb, var(--warning) 15%, transparent)'
                              : 'var(--success-light)',
                            color: delay > 0 ? 'var(--warning)' : 'var(--success-text)',
                          }}
                        >
                          {delay === 0 ? 'Instant' : `${delay}s`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={delay}
                        onChange={(e) => handleDelayChange(uid, parseInt(e.target.value))}
                        className="flex-1"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <Button
                        onClick={() => handleSave(uid)}
                        isLoading={isSavingThis}
                        variant="primary"
                        size="sm"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      {delay > 0 && (
                        <Button
                          onClick={() => handleRemoveDelay(uid)}
                          variant="ghost"
                          size="sm"
                          disabled={isSavingThis}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          <Trash2 className="w-3 h-3" style={{ color: 'var(--danger)' }} />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <p className="text-[10px] text-center pt-1" style={{ color: 'var(--text-muted)' }}>
              3-tier: Hardcoded 0s → NVS backup → Live config
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
