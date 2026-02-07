'use client';

import { useState, useEffect, useCallback } from 'react';
import { DoorStatus, Card as CardType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CreditCard, Clock, Globe, Fingerprint } from 'lucide-react';
import { formatUid } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';

interface LastAccessCardProps {
  status: DoorStatus | null;
}

type AccessSource = 'RFID' | 'WEB' | 'TOUCH' | 'UNKNOWN';

function detectAccessSource(lastEvent: string | undefined): AccessSource {
  if (!lastEvent) return 'UNKNOWN';
  if (lastEvent.includes('via API')) return 'WEB';
  if (lastEvent.includes('Touch sensor') || lastEvent.includes('touch')) return 'TOUCH';
  if (lastEvent.includes('card') || lastEvent.includes('Card') || lastEvent.includes('Valid')) return 'RFID';
  return 'UNKNOWN';
}

export function LastAccessCard({ status }: LastAccessCardProps) {
  const [cardsMap, setCardsMap] = useState<Record<string, string>>({});

  const fetchCardNames = useCallback(async () => {
    try {
      const response = await fetch('/api/cards');
      if (!response.ok) return;
      const cards: CardType[] = await response.json();
      const map: Record<string, string> = {};
      cards.forEach((card) => {
        if (card.nickname) {
          map[card.uid.toUpperCase()] = card.nickname;
          map[card.uid.replace(/:/g, '').toUpperCase()] = card.nickname;
        }
      });
      setCardsMap(map);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchCardNames();
  }, [fetchCardNames]);

  useEffect(() => {
    const u1 = dashboardEvents.on('cards-changed', fetchCardNames);
    const u2 = dashboardEvents.on('card-renamed', fetchCardNames);
    return () => { u1(); u2(); };
  }, [fetchCardNames]);

  const getCardDisplayName = (uid: string): { name: string | null; uid: string } => {
    if (!uid) return { name: null, uid: '-' };
    const normalizedUid = uid.replace(/:/g, '').toUpperCase();
    const upperUid = uid.toUpperCase();
    const nickname = cardsMap[upperUid] || cardsMap[normalizedUid];
    return { name: nickname || null, uid: formatUid(uid) };
  };

  const source = detectAccessSource(status?.lastEvent);
  const cardInfo = (source === 'RFID' && status?.lastCard) ? getCardDisplayName(status.lastCard) : null;

  // Refetch card names whenever status changes (so name is always up-to-date)
  useEffect(() => {
    if (status?.lastCard) {
      fetchCardNames();
    }
  }, [status?.lastCard, status?.lastEvent, fetchCardNames]);

  const hasAccess = status?.lastEvent && status.lastEvent !== 'System ready';

  // Source-specific icon
  const SourceIcon = source === 'WEB' ? Globe : source === 'TOUCH' ? Fingerprint : CreditCard;
  const sourceColor = source === 'WEB' ? 'var(--primary)' : source === 'TOUCH' ? 'var(--warning)' : 'var(--secondary)';
  const sourceBg = source === 'WEB' ? 'var(--primary-light)' : source === 'TOUCH' ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--secondary-light)';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: sourceBg }}
          >
            <SourceIcon className="w-3.5 h-3.5" style={{ color: sourceColor }} />
          </div>
          Last Access
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasAccess ? (
          <div className="space-y-3.5">
            <div>
              {source === 'WEB' ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Access Source</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Web Dashboard
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Remote unlock via browser
                  </p>
                </>
              ) : source === 'TOUCH' ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Access Source</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Touch Sensor
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Physical touch exit
                  </p>
                </>
              ) : cardInfo ? (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Card Name</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {cardInfo.name || cardInfo.uid}
                  </p>
                  {cardInfo.name && (
                    <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                      {cardInfo.uid}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Event</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {status?.lastEvent}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3.5 h-3.5" />
              <span>Just now</span>
            </div>
            {status?.lastEvent && (
              <div className="pt-3.5" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Action</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>{status.lastEvent}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No recent access</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
