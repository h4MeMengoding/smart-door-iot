'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Header } from '@/components/layout/Header';
import { DoorStatusCard } from '@/components/dashboard/DoorStatusCard';
import { LastAccessCard } from '@/components/dashboard/LastAccessCard';
import { DoorControls } from '@/components/dashboard/DoorControls';
import { SystemInfoCard } from '@/components/dashboard/SystemInfoCard';
import { CardsSection } from '@/components/dashboard/CardsSection';
import { LogsSection } from '@/components/dashboard/LogsSection';
import { AddCardSection } from '@/components/dashboard/AddCardSection';
import { OtaUpdateCard } from '@/components/dashboard/OtaUpdateCard';
import { RestartCard } from '@/components/dashboard/RestartCard';
import { DeviceToolsCard } from '@/components/dashboard/DeviceToolsCard';
import { AutoLockCard } from '@/components/dashboard/AutoLockCard';
import { CardDelayCard } from '@/components/dashboard/CardDelayCard';
import { FloatingDoorButton } from '@/components/dashboard/FloatingDoorButton';
import { CardsModal } from '@/components/modals/CardsModal';
import { LogsModal } from '@/components/modals/LogsModal';
import { ArrangeModal } from '@/components/modals/ArrangeModal';
import { DoorStatus, WebSocketMessage } from '@/lib/types';
import { api } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { WifiOff, RefreshCw, GripVertical, LayoutDashboard, Check, RotateCcw, CreditCard as CreditCardIcon, FileText, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const DEFAULT_AUTO_LOCK = 5;

// ── Sortable Card Wrapper (masonry-compatible) ──
interface SortableCardProps {
  id: string;
  index: number;
  isEditing: boolean;
  children: ReactNode;
}

function SortableCard({ id, index, isEditing, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    breakInside: 'avoid' as const,
    marginBottom: '1.25rem',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-2 -right-2 z-20 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-text)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      {isEditing && (
        <div
          className="absolute inset-0 z-10 rounded-3xl pointer-events-none"
          style={{
            border: '2px dashed var(--border-strong)',
          }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function DashboardPage() {
  // Scroll to top on page load/refresh
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [status, setStatus] = useState<DoorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [cardsModalOpen, setCardsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [arrangeModalOpen, setArrangeModalOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevStatusRef = useRef<DoorStatus | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoLockRef = useRef(DEFAULT_AUTO_LOCK);
  const [retryCountdown, setRetryCountdown] = useState(5);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const retryIntervalRef = useRef(5);

  const { layout, saveLayout, resetLayout, isEditing, setIsEditing } = useDashboardLayout();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Start countdown when door unlocks
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(autoLockRef.current);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const detectAccessSource = (lastEvent: string): { accessType: 'RFID' | 'WEB' | 'TOUCH'; label: string } => {
    if (lastEvent?.includes('via API')) return { accessType: 'WEB', label: 'Web Dashboard' };
    if (lastEvent?.includes('Touch sensor')) return { accessType: 'TOUCH', label: 'Touch Sensor' };
    return { accessType: 'RFID', label: '' };
  };

  const sendAccessLog = useCallback(async (cardUid: string, action: string, success: boolean, accessType?: 'RFID' | 'WEB' | 'TOUCH') => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_DEFAULT_API_KEY || '',
        },
        body: JSON.stringify({ cardUid, action, success, accessType }),
      });
    } catch (err) {
      console.error('Failed to save access log:', err);
    }
  }, []);

  // ── Fast card add/remove: immediately update UI via WebSocket, then sync DB in background ──
  const backgroundDbSync = useCallback(async (espCards: string[]) => {
    try {
      dashboardEvents.emit('cards-syncing');
      const res = await fetch('/api/cards/sync-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: espCards }),
      });
      const result = await res.json();
      if (result.success) {
        console.log(`[DB Sync] Done: +${result.added} -${result.removed} = ${result.total} total`);
      }
      dashboardEvents.emit('cards-synced');
      dashboardEvents.emit('cards-changed');
    } catch (err) {
      console.error('[DB Sync] Background sync failed:', err);
      dashboardEvents.emit('cards-synced');
    }
  }, []);

  // ── Card Sync: ESP32 is source of truth, fetch + sync DB ──
  const syncCards = useCallback(async () => {
    try {
      let espCards: { uid: string }[] = [];
      try {
        espCards = await api.getCards();
      } catch {
        console.warn('[Sync] Cannot reach ESP32, skipping sync');
        return;
      }
      // Immediately show ESP cards in UI
      const espUids = espCards.map(c => c.uid);
      dashboardEvents.emit('cards-instant-update', espUids);
      // Background DB sync
      backgroundDbSync(espUids);
    } catch (err) {
      console.error('[Sync] Card sync failed:', err);
    }
  }, [backgroundDbSync]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getDoorStatus();

      // Detect state transitions from polling
      if (prevStatusRef.current) {
        if (prevStatusRef.current.state !== data.state) {
          if (data.state === 'REGISTRATION_MODE') {
            toast('Registration mode activated — tap card to register', { icon: '📝', duration: 4000 });
          } else if (prevStatusRef.current.state === 'REGISTRATION_MODE') {
            toast.success('Exited registration mode');
          }
          dashboardEvents.emit('state-changed');
        }
        // Auto-sync when card changes detected via polling fallback
        if (data.lastEvent !== prevStatusRef.current.lastEvent) {
          if (data.lastEvent?.startsWith('Card added:') || data.lastEvent?.startsWith('Card removed:')) {
            syncCards();
          }
        }
      }

      setStatus(data);
      prevStatusRef.current = data;
      setApiError(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setApiError(true);
      setStatus(null);
      prevStatusRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'door_status' && message.data) {
      const newStatus = message.data as DoorStatus;

      // Track auto-lock duration from ESP32
      if (newStatus.autoLockDuration) {
        autoLockRef.current = newStatus.autoLockDuration;
      }

      if (prevStatusRef.current) {
        if (prevStatusRef.current.doorUnlocked !== newStatus.doorUnlocked) {
          if (newStatus.doorUnlocked) {
            const source = detectAccessSource(newStatus.lastEvent);
            if (source.accessType === 'WEB') {
              toast.success('Door unlocked via web');
              sendAccessLog(source.label, 'unlock', true, 'WEB');
            } else if (source.accessType === 'TOUCH') {
              toast.success('Door unlocked via touch');
              sendAccessLog(source.label, 'unlock', true, 'TOUCH');
            } else {
              toast.success('Door unlocked');
              sendAccessLog(newStatus.lastCard || 'Unknown', 'unlock', true, 'RFID');
            }
            startCountdown();
          } else {
            toast.success('Door locked');
            stopCountdown();
          }
        }

        if (prevStatusRef.current.lastCard !== newStatus.lastCard && newStatus.lastCard) {
          if (newStatus.lastEvent && newStatus.lastEvent.includes('denied')) {
            toast.error(`Access denied: ${newStatus.lastCard}`);
            sendAccessLog(newStatus.lastCard, 'denied', false, 'RFID');
          }
        }
      }

      // Detect state transitions (entering/exiting registration mode, etc.)
      if (prevStatusRef.current && prevStatusRef.current.state !== newStatus.state) {
        if (newStatus.state === 'REGISTRATION_MODE') {
          toast('Registration mode activated — tap card to register', { icon: '📝', duration: 4000 });
        } else if (prevStatusRef.current.state === 'REGISTRATION_MODE') {
          toast.success('Exited registration mode');
        }
        dashboardEvents.emit('state-changed');
      }

      setStatus(newStatus);
      setApiError(false);
      prevStatusRef.current = newStatus;

    } else if (message.type === 'card_added' && message.data) {
      // ── Instant card added ──
      const { uid, allCards } = message.data;
      toast.success(`Card registered: ${uid}`);
      // Instantly update UI with full card list from ESP
      dashboardEvents.emit('cards-instant-update', allCards);
      // Background DB sync
      backgroundDbSync(allCards);

    } else if (message.type === 'card_removed' && message.data) {
      // ── Instant card removed ──
      const { uid, allCards } = message.data;
      toast.success(`Card removed: ${uid}`);
      // Instantly update UI with full card list from ESP
      dashboardEvents.emit('cards-instant-update', allCards);
      // Background DB sync
      backgroundDbSync(allCards);

    } else if (message.type === 'registration_mode' && message.data) {
      // ── Registration mode toggle ──
      const { active } = message.data;
      if (active) {
        toast('Registration mode activated — tap card to register', { icon: '📝', duration: 4000 });
      } else {
        toast.success('Exited registration mode');
      }
      dashboardEvents.emit('state-changed');

    } else if (message.type === 'card_scan' && message.data) {
      const { uid, success } = message.data;
      if (!success) {
        toast.error(`Access denied: ${uid}`);
        sendAccessLog(uid, 'denied', false, 'RFID');
      } else {
        toast.success(`Card ${uid} authorized`);
      }
    }
  }, [sendAccessLog, startCountdown, stopCountdown, backgroundDbSync]);

  const { isConnected, reconnect } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      console.log('WebSocket connected');
      toast.success('Connected to door lock');
      fetchStatus();
      // Sync cards: DB ↔ ESP32
      syncCards();
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
      // Trigger a status fetch to check if ESP32 is truly offline
      fetchStatus();
    },
    autoReconnect: true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Polling fallback when WebSocket is disconnected but ESP32 reachable ──
  // Also poll at a slower rate when connected to catch state changes not broadcast via WS
  useEffect(() => {
    if (apiError) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, isConnected ? 5000 : 2000);
    return () => clearInterval(interval);
  }, [isConnected, apiError, fetchStatus]);

  // ── Auto-retry when ESP32 is offline ──
  useEffect(() => {
    if (!apiError || isConnected || isLoading) {
      setRetryAttempts(0);
      retryIntervalRef.current = 5;
      return;
    }
    setRetryCountdown(retryIntervalRef.current);
    const interval = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          fetchStatus();
          setRetryAttempts(a => a + 1);
          retryIntervalRef.current = Math.min(retryIntervalRef.current + 5, 30);
          return retryIntervalRef.current;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [apiError, isConnected, isLoading, fetchStatus]);

  // ── Manual retry handler ──
  const handleManualRetry = useCallback(() => {
    setRetryAttempts(prev => prev + 1);
    retryIntervalRef.current = 5;
    setRetryCountdown(5);
    fetchStatus();
    reconnect();
  }, [fetchStatus, reconnect]);

  // ── Refresh on tab visibility change ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
        syncCards();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchStatus, syncCards]);

  // ── DnD handlers ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.indexOf(active.id as string);
      const newIndex = layout.indexOf(over.id as string);
      saveLayout(arrayMove(layout, oldIndex, newIndex));
    }
  };

  // ── Derived state ──
  const isEspOffline = !isLoading && (apiError || (!isConnected && status === null));

  // ── Card renderer ──
  const renderCard = (id: string): ReactNode => {
    switch (id) {
      case 'door-status':
        return <DoorStatusCard status={status} isLoading={isLoading} apiError={apiError} countdown={countdown} autoLockDuration={status?.autoLockDuration || autoLockRef.current} />;
      case 'system-info':
        return <SystemInfoCard uptimeRaw={status?.uptime} isConnected={isConnected} />;
      case 'door-controls':
        return <DoorControls onAction={fetchStatus} isLocked={!status?.doorUnlocked} />;
      case 'last-access':
        return <LastAccessCard status={status} />;
      case 'device-tools':
        return <DeviceToolsCard status={status} />;
      case 'cards':
        return <CardsSection onExpand={() => setCardsModalOpen(true)} countdown={countdown} isLocked={!status?.doorUnlocked} />;
      case 'logs':
        return <LogsSection onExpand={() => setLogsModalOpen(true)} />;
      case 'auto-lock':
        return <AutoLockCard currentDuration={status?.autoLockDuration} />;
      case 'card-delay':
        return <CardDelayCard />;
      default:
        return null;
    }
  };

  return (
    <div>
      <Header />

      <div className="px-4 md:px-8 pb-8">
        {/* ── Offline Screen — replaces dashboard when ESP32 is unreachable ── */}
        <AnimatePresence>
          {isEspOffline && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center min-h-[60vh] px-4"
            >
              {/* Animated WiFi icon */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-24 rounded-4xl flex items-center justify-center mb-6"
                style={{ background: 'var(--danger-light)' }}
              >
                <WifiOff className="w-10 h-10" style={{ color: 'var(--danger)' }} />
              </motion.div>

              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Device Offline
              </h2>
              <p className="text-sm text-center max-w-sm mb-8" style={{ color: 'var(--text-muted)' }}>
                Cannot connect to ESP32. The device may be powered off, restarting, or out of WiFi range.
              </p>

              {/* Auto-retry countdown ring */}
              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke="var(--primary)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - retryCountdown / retryIntervalRef.current)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {retryCountdown}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Retrying in {retryCountdown}s
                  </p>
                  {retryAttempts > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Attempt {retryAttempts}
                    </p>
                  )}
                </div>
              </div>

              {/* Manual retry button */}
              <Button
                variant="primary"
                size="lg"
                onClick={handleManualRetry}
                className="rounded-2xl px-8 mb-6"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Now
              </Button>

              {/* DB features — still accessible offline */}
              <div className="flex gap-3 mb-8">
                <Button variant="ghost" size="sm" onClick={() => setCardsModalOpen(true)}>
                  <CreditCardIcon className="w-4 h-4 mr-1.5" />
                  View Cards
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLogsModalOpen(true)}>
                  <FileText className="w-4 h-4 mr-1.5" />
                  View Logs
                </Button>
              </div>

              {/* Troubleshooting tips */}
              <div
                className="p-4 rounded-2xl max-w-md w-full"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>
                  Troubleshooting Tips
                </p>
                <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Check if the ESP32 has power and indicator LEDs are on</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Verify the ESP32 is connected to your WiFi network</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Confirm the device IP address and API key in Settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>Try power cycling the ESP32 device</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Dashboard — visible when ESP32 is online ── */}
        {!isEspOffline && (<>
        {/* Edit Layout Bar */}
        <div className="flex items-center justify-end gap-2 mb-4">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetLayout();
                  toast.success('Layout reset to default');
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setArrangeModalOpen(true)}
              >
                <LayoutList className="w-3.5 h-3.5 mr-1.5" />
                Arrange
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  toast.success('Layout saved');
                }}
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Edit Layout
            </Button>
          )}
        </div>

        {/* Dashboard — Grid Layout */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={layout} strategy={rectSortingStrategy}>
            <div style={{ columnWidth: '320px', columnGap: '1.25rem' }}>
              {layout.map((id, index) => (
                <SortableCard
                  key={id}
                  id={id}
                  index={index}
                  isEditing={isEditing}
                >
                  {renderCard(id)}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </>)}
      </div>

      {/* Floating Door Control — mobile only */}
      {!isEspOffline && (
        <FloatingDoorButton
          isLocked={!status?.doorUnlocked}
          onAction={fetchStatus}
        />
      )}

      {/* Modals */}
      <CardsModal isOpen={cardsModalOpen} onClose={() => setCardsModalOpen(false)} onCardsChanged={() => { dashboardEvents.emit('cards-changed'); syncCards(); }} />
      <LogsModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} />
      <ArrangeModal
        isOpen={arrangeModalOpen}
        onClose={() => setArrangeModalOpen(false)}
        layout={layout}
        onSave={(newLayout) => {
          saveLayout(newLayout);
          toast.success('Layout arranged');
        }}
      />
    </div>
  );
}

