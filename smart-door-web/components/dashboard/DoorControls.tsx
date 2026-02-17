'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LockOpen, Lock, DoorClosedLocked } from 'lucide-react';
import { api } from '@/lib/api';
import { logSystemEvent } from '@/lib/systemEvents';
import toast from 'react-hot-toast';

interface DoorControlsProps {
  onAction?: () => void;
  isLocked?: boolean;
}

export function DoorControls({ onAction, isLocked = true }: DoorControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const result = isLocked ? await api.unlockDoor() : await api.lockDoor();
      if (result.success) {
        toast.success(isLocked ? 'Door unlocked successfully' : 'Door locked successfully');
        logSystemEvent(isLocked ? 'door_unlocked' : 'door_locked', `Door ${isLocked ? 'unlocked' : 'locked'} via dashboard`);
        onAction?.();
      } else {
        toast.error(result.message || `Failed to ${isLocked ? 'unlock' : 'lock'} door`);
      }
    } catch (error) {
      toast.error('Failed to communicate with device');
      console.error('Door toggle error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-light)' }}
          >
            <DoorClosedLocked className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <CardTitle>Door Controls</CardTitle>
            <CardDescription>Remote lock control</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleToggle}
          isLoading={isLoading}
          variant={isLocked ? 'primary' : 'secondary'}
          size="lg"
          className="w-full rounded-2xl"
        >
          {isLocked ? (
            <>
              <LockOpen className="w-4 h-4 mr-2" />
              Open Door
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Lock Door
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
