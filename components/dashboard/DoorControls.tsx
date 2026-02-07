'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LockOpen, Lock, Info } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface DoorControlsProps {
  onAction?: () => void;
  isLocked?: boolean;
}

export function DoorControls({ onAction, isLocked = true }: DoorControlsProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      const result = await api.unlockDoor();
      if (result.success) {
        toast.success('Door unlocked successfully');
        onAction?.();
      } else {
        toast.error(result.message || 'Failed to unlock door');
      }
    } catch (error) {
      toast.error('Failed to communicate with device');
      console.error('Unlock error:', error);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = async () => {
    setIsLocking(true);
    try {
      const result = await api.lockDoor();
      if (result.success) {
        toast.success('Door locked successfully');
        onAction?.();
      } else {
        toast.error(result.message || 'Failed to lock door');
      }
    } catch (error) {
      toast.error('Failed to communicate with device');
      console.error('Lock error:', error);
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Door Controls</CardTitle>
        <CardDescription>
          Control the door lock remotely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleUnlock}
          isLoading={isUnlocking}
          disabled={isLocking || !isLocked}
          variant="primary"
          size="lg"
          className="w-full rounded-2xl"
        >
          <LockOpen className="w-4 h-4 mr-2" />
          Open Door
        </Button>

        <Button
          onClick={handleLock}
          isLoading={isLocking}
          disabled={isUnlocking || isLocked}
          variant="secondary"
          size="lg"
          className="w-full rounded-2xl"
        >
          <Lock className="w-4 h-4 mr-2" />
          Lock Door
        </Button>

        <div
          className="flex items-start gap-2.5 p-3.5 rounded-2xl"
          style={{ background: 'var(--bg-surface-hover)' }}
        >
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Door will auto-lock after 6 seconds when unlocked
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
