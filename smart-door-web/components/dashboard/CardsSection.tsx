'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { CreditCard, Maximize2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card as CardType } from '@/lib/types';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { RfidCardVisual } from '@/components/ui/RfidCardVisual';

interface CardsSectionProps {
  onExpand: () => void;
  countdown?: number | null;
  isLocked?: boolean;
}

const SLIDE_INTERVAL = 3000;

export function CardsSection({ onExpand, countdown, isLocked = true }: CardsSectionProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const unsubscribe = dashboardEvents.on('cards-changed', fetchCards);

    const unsubInstant = dashboardEvents.on('cards-instant-update', (espUids: string[]) => {
      if (Array.isArray(espUids)) {
        setCards((prev) => {
          const existingMap = new Map(prev.map((c) => [c.uid.replace(/:/g, '').toUpperCase(), c]));
          const merged: CardType[] = [];
          for (const uid of espUids) {
            const normalized = uid.replace(/:/g, '').toUpperCase();
            const existing = existingMap.get(normalized);
            if (existing) {
              merged.push(existing);
            } else {
              merged.push({ uid, nickname: undefined, addedAt: new Date().toISOString() });
            }
          }
          return merged;
        });
        setIsLoading(false);
      }
    });

    const unsubSyncing = dashboardEvents.on('cards-syncing', () => setIsSyncing(true));
    const unsubSynced = dashboardEvents.on('cards-synced', () => setIsSyncing(false));

    return () => {
      unsubscribe();
      unsubInstant();
      unsubSyncing();
      unsubSynced();
    };
  }, []);

  const goToSlide = useCallback((index: number) => {
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, []);

  const goNext = useCallback(() => {
    if (cards.length <= 1) return;
    goToSlide((currentIndex + 1) % cards.length);
  }, [cards.length, currentIndex, goToSlide]);

  const goPrev = useCallback(() => {
    if (cards.length <= 1) return;
    goToSlide((currentIndex - 1 + cards.length) % cards.length);
  }, [cards.length, currentIndex, goToSlide]);

  // Auto-slide timer
  useEffect(() => {
    if (cards.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(goNext, SLIDE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cards.length, isPaused, goNext]);

  // Reset index if cards change
  useEffect(() => {
    if (currentIndex >= cards.length) {
      setCurrentIndex(0);
    }
  }, [cards.length, currentIndex]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <CreditCard className="w-4 h-4" style={{ color: 'var(--primary)' }} />
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
              <CardDescription>
                {!isLocked && countdown !== null && countdown !== undefined && countdown > 0
                  ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Auto-lock in {countdown}s</span>
                  : `${cards.length} of 15 slots used`
                }
              </CardDescription>
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
              e.currentTarget.style.border = '1px solid var(--border-strong)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = '1px solid var(--border)';
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
          <div className="flex flex-col items-center gap-3">
            {/* Carousel container */}
            <div
              className="w-full relative group"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Slide viewport */}
              <div className="w-full overflow-hidden rounded-xl">
                <div
                  className="flex"
                  style={{
                    transform: `translateX(-${currentIndex * 100}%)`,
                    transition: isTransitioning ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  }}
                >
                  {cards.map((card, i) => (
                    <div
                      key={card.uid}
                      className="w-full shrink-0 flex justify-center px-2"
                    >
                      <div style={{ width: 240 }}>
                        <RfidCardVisual card={card} index={i} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Dot indicators */}
            {cards.length > 1 && (
              <div className="flex items-center gap-1.5">
                {cards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className="transition-all duration-300 rounded-full"
                    style={{
                      width: currentIndex === i ? 16 : 5,
                      height: 5,
                      background: currentIndex === i ? 'var(--primary)' : 'var(--border-strong)',
                      opacity: currentIndex === i ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
            )}

            {/* View all button with nav arrows */}
            <div className="flex items-center gap-2">
              {cards.length > 1 && (
                <button
                  onClick={goPrev}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={onExpand}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--primary)' }}
              >
                View all {cards.length} cards
              </button>
              {cards.length > 1 && (
                <button
                  onClick={goNext}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
