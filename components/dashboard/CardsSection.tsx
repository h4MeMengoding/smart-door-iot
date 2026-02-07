'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { CreditCard, Maximize2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card as CardType } from '@/lib/types';
import { formatUid } from '@/lib/utils';
import { dashboardEvents } from '@/lib/dashboardEvents';

interface CardsSectionProps {
  onExpand: () => void;
}

export function CardsSection({ onExpand }: CardsSectionProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/cards');
      if (!response.ok) throw new Error('Failed to fetch cards');
      const data = await response.json();
      setCards(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Fetch cards error:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();

    // Listen for DB-synced cards refresh
    const unsubscribe = dashboardEvents.on('cards-changed', fetchCards);

    // Listen for instant card updates from ESP (before DB sync)
    const unsubInstant = dashboardEvents.on('cards-instant-update', (espUids: string[]) => {
      if (Array.isArray(espUids)) {
        setCards((prev) => {
          // Merge: keep existing cards that are still in ESP, add new ones
          const existingMap = new Map(prev.map((c) => [c.uid.replace(/:/g, '').toUpperCase(), c]));
          const merged: CardType[] = [];
          for (const uid of espUids) {
            const normalized = uid.replace(/:/g, '').toUpperCase();
            const existing = existingMap.get(normalized);
            if (existing) {
              merged.push(existing); // Keep nickname etc.
            } else {
              merged.push({ uid, nickname: undefined, addedAt: new Date().toISOString() });
            }
          }
          return merged;
        });
        setIsLoading(false);
      }
    });

    // Listen for sync status
    const unsubSyncing = dashboardEvents.on('cards-syncing', () => setIsSyncing(true));
    const unsubSynced = dashboardEvents.on('cards-synced', () => setIsSyncing(false));

    return () => {
      unsubscribe();
      unsubInstant();
      unsubSyncing();
      unsubSynced();
    };
  }, []);

  const displayCards = cards.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <CreditCard className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Registered Cards</CardTitle>
                {isSyncing && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'var(--primary-light)' }}>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" style={{ color: 'var(--primary)' }} />
                    <span className="text-[9px] font-medium" style={{ color: 'var(--primary)' }}>syncing</span>
                  </div>
                )}
              </div>
              <CardDescription>{cards.length} of 15 slots used</CardDescription>
            </div>
          </div>
          <button
            onClick={onExpand}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="View all cards"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading cards...</span>
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-8">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No cards registered yet</p>
            <button
              onClick={onExpand}
              className="text-xs mt-2 transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              Click to add cards
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayCards.map((card, index) => (
              <motion.div
                key={card.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
                  <CreditCard className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {card.nickname || 'Unnamed Card'}
                  </p>
                  <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {formatUid(card.uid)}
                  </p>
                </div>
              </motion.div>
            ))}
            {cards.length > 3 && (
              <button
                onClick={onExpand}
                className="w-full text-center py-2 rounded-xl text-xs font-medium transition-colors"
                style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
              >
                +{cards.length - 3} more cards
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
