'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CreditCard, Plus, X, Loader2 } from 'lucide-react';
import { DoorStatus } from '@/lib/types';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface AddCardSectionProps {
  status: DoorStatus | null;
}

export function AddCardSection({ status }: AddCardSectionProps) {
  const [isToggling, setIsToggling] = useState(false);

  const isRegistrationMode = status?.state === 'REGISTRATION_MODE';

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      const result = await api.toggleRegistrationMode();
      if (result.success) {
        toast.success(result.message || (isRegistrationMode ? 'Exited registration mode' : 'Entered registration mode'));
      } else {
        toast.error(result.message || 'Failed to toggle registration mode');
      }
    } catch {
      toast.error('Failed to communicate with device');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card
      style={isRegistrationMode ? {
        border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))',
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, color-mix(in srgb, var(--warning) 8%, var(--bg-surface)) 100%)',
      } : undefined}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: isRegistrationMode ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : 'var(--primary-light)',
            }}
          >
            <Plus
              className={`w-4 h-4 ${isRegistrationMode ? 'animate-pulse' : ''}`}
              style={{ color: isRegistrationMode ? 'var(--warning)' : 'var(--primary)' }}
            />
          </div>
          <div>
            <CardTitle>Add Card</CardTitle>
            <CardDescription>
              {isRegistrationMode ? 'Tap card on reader now' : 'Register new RFID cards'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isRegistrationMode ? (
          <>
            <div
              className="flex items-center gap-3 p-3.5 rounded-2xl"
              style={{
                background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
              }}
            >
              <div className="relative">
                <CreditCard className="w-5 h-5 animate-pulse" style={{ color: 'var(--warning)' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--warning)' }}>
                  Registration Mode Active
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Tap any unregistered card to add it
                </p>
              </div>
            </div>
            <Button
              onClick={handleToggle}
              isLoading={isToggling}
              variant="secondary"
              size="lg"
              className="w-full rounded-2xl"
            >
              <X className="w-4 h-4 mr-2" />
              Exit Registration Mode
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Enter registration mode to add or remove RFID cards. Same as tapping the master card on the reader.
            </p>
            <Button
              onClick={handleToggle}
              isLoading={isToggling}
              variant="primary"
              size="lg"
              className="w-full rounded-2xl"
              disabled={!status || status.doorUnlocked}
            >
              {isToggling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Enter Registration Mode
            </Button>
            {status?.doorUnlocked && (
              <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                Lock the door first to enter registration mode
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
