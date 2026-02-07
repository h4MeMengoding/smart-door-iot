'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CreditCard, Trash2, Pen, Plus, X, Check, WifiOff, RefreshCw } from 'lucide-react';
import { Card as CardType } from '@/lib/types';
import { formatUid } from '@/lib/utils';
import { api } from '@/lib/api';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { RfidCardVisual } from '@/components/ui/RfidCardVisual';

interface CardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardsChanged?: () => void;
}

export function CardsModal({ isOpen, onClose, onCardsChanged }: CardsModalProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCardUid, setNewCardUid] = useState('');
  const [newCardNickname, setNewCardNickname] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const fetchCards = async () => {
    try {
      setApiError(false);
      const response = await fetch('/api/cards');
      if (!response.ok) throw new Error('Failed to fetch cards');
      const data = await response.json();
      setCards(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Fetch cards error:', error);
      setApiError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCards();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubChanged = dashboardEvents.on('cards-changed', () => {
      if (isOpen) fetchCards();
    });

    const unsubInstant = dashboardEvents.on('cards-instant-update', (espUids: string[]) => {
      if (!isOpen || !Array.isArray(espUids)) return;
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
    });

    const unsubSyncing = dashboardEvents.on('cards-syncing', () => setIsSyncing(true));
    const unsubSynced = dashboardEvents.on('cards-synced', () => setIsSyncing(false));

    return () => {
      unsubChanged();
      unsubInstant();
      unsubSyncing();
      unsubSynced();
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingCard) {
          setEditingCard(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, editingCard]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardUid.trim()) return;

    setIsAdding(true);
    try {
      try {
        await api.addCard(newCardUid);
      } catch (err) {
        console.warn('Failed to add to ESP32:', err);
      }

      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: newCardUid, nickname: newCardNickname || undefined }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Card added successfully');
        setNewCardUid('');
        setNewCardNickname('');
        setShowAddForm(false);
        fetchCards();
        onCardsChanged?.();
        dashboardEvents.emit('cards-changed');
      } else {
        toast.error(result.message || 'Failed to add card');
      }
    } catch {
      toast.error('Failed to add card');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCard = async (uid: string) => {
    if (!confirm('Are you sure you want to remove this card?')) return;

    try {
      try {
        await api.removeCard(uid);
      } catch (err) {
        console.warn('Failed to remove from ESP32:', err);
      }

      const response = await fetch(`/api/cards`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Card removed successfully');
        fetchCards();
        onCardsChanged?.();
        dashboardEvents.emit('cards-changed');
      } else {
        toast.error(result.message || 'Failed to remove card');
      }
    } catch {
      toast.error('Failed to remove card');
    }
  };

  const handleSaveNickname = async (uid: string) => {
    try {
      const response = await fetch(`/api/cards`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, nickname: editNickname }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Name updated');
        setEditingCard(null);
        fetchCards();
        onCardsChanged?.();
        dashboardEvents.emit('card-renamed');
      } else {
        toast.error(result.message || 'Failed to update name');
      }
    } catch {
      toast.error('Failed to update name');
    }
  };

  const handleCardTap = (uid: string) => {
    // Toggle active state for mobile
    setActiveCard(prev => prev === uid ? null : uid);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cards-modal"
          className="fixed inset-0 z-50 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto mt-[8vh] mx-4 rounded-3xl"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-3xl"
              style={{
                background: 'var(--bg-base)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--primary-light)' }}
                >
                  <CreditCard className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Registered Cards</h2>
                    {isSyncing && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--primary-light)' }}>
                        <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--primary)' }} />
                        <span className="text-[10px] font-medium" style={{ color: 'var(--primary)' }}>Syncing to DB...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cards.length} of 15 slots used</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* API Error Banner */}
              {apiError && !isLoading && (
                <div
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl"
                  style={{ background: 'var(--danger-light)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
                >
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 shrink-0" style={{ color: 'var(--danger)' }} />
                    <p className="text-xs font-medium" style={{ color: 'var(--danger-text)' }}>Unable to connect to ESP32</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchCards}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

              {/* Add Card Button & Form */}
              {!showAddForm ? (
                <Button onClick={() => setShowAddForm(true)} variant="primary" size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Card
                </Button>
              ) : (
                <Card variant="bordered">
                  <CardContent className="pt-4">
                    <form onSubmit={handleAddCard} className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Add New Card</p>
                        <button
                          onClick={() => setShowAddForm(false)}
                          className="transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newCardUid}
                          onChange={(e) => setNewCardUid(e.target.value)}
                          placeholder="Card UID (e.g. BE:02:28:DB)"
                          className="px-3 py-2 rounded-xl text-[13px] focus:ring-2 focus:outline-none transition-colors"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                          required
                        />
                        <input
                          type="text"
                          value={newCardNickname}
                          onChange={(e) => setNewCardNickname(e.target.value)}
                          placeholder="Nickname (optional)"
                          className="px-3 py-2 rounded-xl text-[13px] focus:ring-2 focus:outline-none transition-colors"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" isLoading={isAdding} variant="primary" size="sm">Add</Button>
                        <Button type="button" onClick={() => setShowAddForm(false)} variant="ghost" size="sm">Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Cards Grid List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'transparent' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading cards...</span>
                  </div>
                </div>
              ) : cards.length === 0 ? (
                <div className="text-center py-10">
                  <div
                    className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'var(--bg-surface-hover)' }}
                  >
                    <CreditCard className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
                  </div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No cards registered yet</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cards.map((card, i) => (
                    <motion.div
                      key={card.uid}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className="flex justify-center"
                    >
                      {/* Card with hover overlay */}
                      {editingCard === card.uid ? (
                        /* Inline edit mode - edit name directly on card */
                        <div className="relative" style={{ width: 260 }}>
                          <RfidCardVisual card={{ ...card, nickname: editNickname || card.nickname }} index={i} size="sm" />
                          {/* Overlay input positioned at card holder name area */}
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-b-2xl flex items-center gap-2 px-3 py-2"
                            style={{
                              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
                            }}
                          >
                            <input
                              type="text"
                              value={editNickname}
                              onChange={(e) => setEditNickname(e.target.value)}
                              placeholder="Card name"
                              className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs focus:outline-none focus:ring-1"
                              style={{
                                background: 'rgba(255,255,255,0.12)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(4px)',
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveNickname(card.uid);
                                if (e.key === 'Escape') setEditingCard(null);
                              }}
                            />
                            <button
                              onClick={() => handleSaveNickname(card.uid)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                              style={{ background: 'rgba(34,197,94,0.3)', color: 'rgba(134,239,172,0.95)', border: '1px solid rgba(34,197,94,0.3)' }}
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCard(null)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }}
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal card with centered icon-only hover actions */
                        <div
                          className="group/card relative cursor-pointer"
                          style={{ width: 260 }}
                          onClick={() => handleCardTap(card.uid)}
                        >
                          <RfidCardVisual card={card} index={i} size="sm" />

                          {/* Hover/tap overlay with centered icon actions */}
                          <div
                            className={`absolute inset-0 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                              activeCard === card.uid ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                            }`}
                            style={{
                              background: 'rgba(0,0,0,0.45)',
                              backdropFilter: 'blur(2px)',
                              pointerEvents: activeCard === card.uid ? 'auto' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.pointerEvents = 'auto';
                            }}
                          >
                            <div
                              className={`flex items-center gap-2 transition-all duration-200 ${
                                activeCard === card.uid
                                  ? 'scale-100 opacity-100'
                                  : 'scale-90 group-hover/card:scale-100 group-hover/card:opacity-100'
                              }`}
                              style={{ pointerEvents: 'auto' }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCard(card.uid);
                                  setEditNickname(card.nickname || '');
                                  setActiveCard(null);
                                }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                                style={{
                                  background: 'rgba(255,255,255,0.15)',
                                  backdropFilter: 'blur(8px)',
                                  color: 'rgba(255,255,255,0.9)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Edit nickname"
                              >
                                <Pen className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCard(card.uid);
                                  setActiveCard(null);
                                }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                                style={{
                                  background: 'rgba(239,68,68,0.2)',
                                  backdropFilter: 'blur(8px)',
                                  color: 'rgba(255,140,140,0.95)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239,68,68,0.4)';
                                  e.currentTarget.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Delete card"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
