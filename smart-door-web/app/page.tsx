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
import { DashboardSkeletons } from '@/components/dashboard/DashboardSkeleton';
import { MasonryGrid } from '@/components/dashboard/MasonryGrid';
import { CardsModal } from '@/components/modals/CardsModal';
import { LogsModal } from '@/components/modals/LogsModal';
import { ArrangeModal } from '@/components/modals/ArrangeModal';
import { DoorStatus, SystemInfo, WebSocketMessage } from '@/lib/types';
import { api } from '@/lib/api';
import { useMqtt as useWebSocket } from '@/hooks/useMqtt';
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
      <div>
        {children}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [status, setStatus] = useState<DoorStatus | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [cardsModalOpen, setCardsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [arrangeModalOpen, setArrangeModalOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevStatusRef = useRef<DoorStatus | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoLockRef = useRef(DEFAULT_AUTO_LOCK);
  const initialFetchDone = useRef(false);

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
        // DB sync completed successfully
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

  // ── Fetch initial status once via MQTT command, then rely on real-time ──
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getDoorStatus();
      setStatus(data);
      prevStatusRef.current = data;
      setApiError(false);
      setIsLoading(false);
      if (data.autoLockDuration) {
        autoLockRef.current = data.autoLockDuration;
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setApiError(true);
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
              // Ensure WEB unlock is logged to DB (ESP32 may not send access_log for API unlocks)
              fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock', success: true, accessType: 'WEB' }),
              }).catch(() => {});
            } else if (source.accessType === 'TOUCH') {
              toast.success('Door unlocked via touch');
              // Ensure TOUCH unlock is logged to DB
              fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock', success: true, accessType: 'TOUCH' }),
              }).catch(() => {});
            } else {
              toast.success('Door unlocked');
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
      } else {
        toast.success(`Card ${uid} authorized`);
      }

    } else if (message.type === 'system_info' && message.data) {
      // ── System info from ESP32 (every 30s, retained) ──
      setSysInfo(message.data as SystemInfo);

    } else if (message.type === 'clone_status' && message.data) {
      // ── Clone status update — relay to DeviceToolsCard via event bus ──
      dashboardEvents.emit('clone-status', message.data);

    } else if (message.type === 'access_log' && message.data) {
      // ── Access log from ESP32 — persist to DB and trigger UI refresh ──
      const logData = message.data as { cardUid?: string; action?: string; success?: boolean; accessType?: string };
      // POST to /api/logs so the log is saved (server-side MQTT may not be alive on Vercel)
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardUid: logData.cardUid || null,
          action: logData.action || 'unlock',
          success: logData.success ?? true,
          accessType: logData.accessType || 'RFID',
        }),
      }).catch(() => { /* silent — server-side MQTT may have already saved it */ });
      // Small delay to let the POST complete before fetching
      setTimeout(() => dashboardEvents.emit('log-added', message.data), 300);
    }
  }, [startCountdown, stopCountdown, backgroundDbSync]);

  const { isConnected, deviceOnline, reconnect } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      // Fetch initial status once, then MQTT provides real-time updates
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        fetchStatus();
        syncCards();
      }
    },
    onDisconnect: () => {
      // MQTT connection lost
    },
  });

  // Fetch initial status on mount (don't wait for MQTT)
  useEffect(() => {
    fetchStatus();
    syncCards();
  }, [fetchStatus, syncCards]);

  // ── Manual retry handler ──
  const handleManualRetry = useCallback(() => {
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
  // Device is offline when MQTT says so, or when we couldn't fetch initial status
  const isEspOffline = !isLoading && (apiError && !deviceOnline);

  // ── Card renderer ──
  const renderCard = (id: string): ReactNode => {
    switch (id) {
      case 'door-status':
        return <DoorStatusCard status={status} isLoading={isLoading} apiError={apiError} countdown={countdown} autoLockDuration={status?.autoLockDuration || autoLockRef.current} />;
      case 'system-info':
        return <SystemInfoCard uptimeRaw={status?.uptime} isConnected={isConnected} sysInfo={sysInfo} />;
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
        return <CardDelayCard status={status} />;
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
                Cannot connect to ESP32 via MQTT. The device may be powered off, restarting, or disconnected from the network.
              </p>

              {/* MQTT auto-reconnects — show simple status */}
              <div className="flex flex-col items-center gap-3 mb-8">
                {isConnected ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--primary-light)' }}>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                      MQTT connected — waiting for device...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--danger-light)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                      MQTT disconnected — reconnecting...
                    </span>
                  </div>
                )}
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
                    <span>Confirm the MQTT broker is reachable and credentials are correct</span>
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

        {/* Dashboard — Masonry / Grid Layout */}
        {isLoading ? (
          <DashboardSkeletons layout={layout} />
        ) : isEditing ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={layout} strategy={rectSortingStrategy}>
              <MasonryGrid>
                {layout.map((id, index) => (
                  <SortableCard
                    key={id}
                    id={id}
                    index={index}
                    isEditing={isEditing}
                  >
                    <div className={id === 'door-controls' || id === 'device-tools' ? 'hidden md:block' : ''}>
                      {renderCard(id)}
                    </div>
                  </SortableCard>
                ))}
              </MasonryGrid>
            </SortableContext>
          </DndContext>
        ) : (
          <MasonryGrid>
            {layout.map((id) => (
              <div key={id} className={id === 'door-controls' || id === 'device-tools' ? 'hidden md:block' : ''}>
                {renderCard(id)}
              </div>
            ))}
          </MasonryGrid>
        )}

        {/* DeviceToolsCard — always mounted on mobile for floating sheet; hidden on desktop (shown in grid above) */}
        <div className="md:hidden">
          <DeviceToolsCard status={status} />
        </div>
        </>)}
      </div>

      {/* Floating Door Control — mobile only */}
      {!isEspOffline && (
        <FloatingDoorButton
          isLocked={!status?.doorUnlocked}
          onAction={fetchStatus}
          status={status}
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

