'use client';

import { useState, useEffect, useRef } from 'react';
import { LockOpen, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { logSystemEvent } from '@/lib/systemEvents';
import toast from 'react-hot-toast';

interface FloatingDoorButtonProps {
  isLocked: boolean;
  onAction?: () => void;
}

export function FloatingDoorButton({ isLocked, onAction }: FloatingDoorButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;

          // Show when scrolling up (delta < -5) or near top
          // Hide when scrolling down (delta > 5)
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

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const result = isLocked ? await api.unlockDoor() : await api.lockDoor();
      if (result.success) {
        toast.success(isLocked ? 'Door unlocked' : 'Door locked');
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

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className="md:hidden fixed z-50 flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all duration-300 active:scale-95 disabled:opacity-60"
      style={{
        bottom: '1.5rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : 'calc(100% + 2rem)'})`,
        background: isLocked ? 'var(--primary)' : 'var(--bg-surface)',
        color: isLocked ? 'var(--primary-text)' : 'var(--text-primary)',
        border: isLocked ? 'none' : '1px solid var(--border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
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
  );
}
