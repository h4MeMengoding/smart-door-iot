'use client';

import { useState, useEffect, useRef } from 'react';
import { LockOpen, Lock, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { logSystemEvent } from '@/lib/systemEvents';
import { dashboardEvents } from '@/lib/dashboardEvents';
import { DoorStatus } from '@/lib/types';
import toast from 'react-hot-toast';

interface FloatingDoorButtonProps {
  isLocked: boolean;
  onAction?: () => void;
  status?: DoorStatus | null;
}

export function FloatingDoorButton({ isLocked, onAction, status }: FloatingDoorButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const rfidDisabled = status?.rfidDisabled ?? false;

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;
          if (delta > 5 && currentScrollY > 80) {
            setVisible(false);
          } else if (delta < -5 || currentScrollY < 80) {
            setVisible(true);
          }
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync toolsOpen state with DeviceToolsCard
  useEffect(() => {
    const unsub = dashboardEvents.on('device-tools-closed', () => setToolsOpen(false));
    return () => unsub();
  }, []);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const result = isLocked ? await api.unlockDoor() : await api.lockDoor();
      if (result.success) {
        // Toast will be shown by WebSocket door_status handler when state actually changes
        logSystemEvent(isLocked ? 'door_unlocked' : 'door_locked', `Door ${isLocked ? 'unlocked' : 'locked'} via mobile button`);
        onAction?.();
      } else {
        toast.error(result.message || 'Action failed');
      }
    } catch {
      toast.error('Failed to communicate with device');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolsClick = () => {
    const next = !toolsOpen;
    setToolsOpen(next);
    dashboardEvents.emit('device-tools-open', next);
  };

  return (
    <div
      className="md:hidden fixed z-50 flex items-center gap-2.5"
      style={{
        bottom: '1.5rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : 'calc(100% + 2rem)'})`,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Tools button */}
      <button
        onClick={handleToolsClick}
        className="relative flex items-center justify-center w-11.5 h-11.5 rounded-full transition-all duration-200 active:scale-95"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-text)',
          border: 'none',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          opacity: toolsOpen ? 0.8 : 1,
        }}
      >
        <Wrench className="w-4 h-4" />
        {rfidDisabled && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: 'var(--danger)' }}
          />
        )}
      </button>

      {/* Door button */}
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className="flex items-center gap-2 px-5 rounded-full font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-60"
        style={{
          background: isLocked ? 'var(--primary)' : 'var(--bg-surface)',
          color: isLocked ? 'var(--primary-text)' : 'var(--text-primary)',
          border: isLocked ? 'none' : '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          height: '46px',
        }}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isLocked ? (
          <LockOpen className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
        {isLocked ? 'Open Door' : 'Lock Door'}
      </button>
    </div>
  );
}
