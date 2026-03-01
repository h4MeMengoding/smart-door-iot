'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Download,
  Bell,
  BellOff,
  Check,
  X,
  Smartphone,
  Share,
  Plus,
  DoorOpen,
  Lock,
  CreditCard,
  ShieldOff,
  ShieldCheck,
  UserPlus,
  UserMinus,
  WifiOff,
  Wifi,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type NotificationType,
  type NotificationPreferences,
  getNotificationPreferences,
  setNotificationPreferences,
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  isPWAInstalled,
  isIOS,
  isAndroid,
  subscribeToPush,
  isPushSubscribed,
} from '@/lib/notifications';

// ── PWA Install Section ──
export function PWAInstallSection() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [iosDevice, setIosDevice] = useState(false);
  const [androidDevice, setAndroidDevice] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsInstalled(isPWAInstalled());
    setIosDevice(isIOS());
    setAndroidDevice(isAndroid());
    setNotifPermission(getNotificationPermission());

    // Check if global prompt was already captured by AppShell
    const globalPrompt = (window as unknown as Record<string, unknown>).__pwaInstallPrompt as Event | undefined;
    if (globalPrompt) {
      setInstallPrompt(globalPrompt);
    }

    // Listen for new beforeinstallprompt (from AppShell global capture)
    const handler = () => {
      const prompt = (window as unknown as Record<string, unknown>).__pwaInstallPrompt as Event | undefined;
      if (prompt) setInstallPrompt(prompt);
    };
    window.addEventListener('pwa-install-available', handler);

    // Also listen for the raw event in case AppShell hasn't captured it yet
    const rawHandler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as unknown as Record<string, unknown>).__pwaInstallPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', rawHandler);

    // Listen for appinstalled
    const installedHandler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('pwa-install-available', handler);
      window.removeEventListener('beforeinstallprompt', rawHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      const prompt = installPrompt as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
        (window as unknown as Record<string, unknown>).__pwaInstallPrompt = undefined;
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleRequestNotification = async () => {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    // Auto-subscribe to server push when permission granted
    if (result === 'granted') {
      subscribeToPush().catch(() => {});
    }
  };

  // On mount, ensure push subscription is active if permission already granted
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Notification.permission === 'granted') {
      isPushSubscribed().then((subscribed) => {
        if (!subscribed) subscribeToPush().catch(() => {});
      });
    }
  }, []);

  // Already installed — show status
  if (isInstalled) {
    const notifSupported = isNotificationSupported();

    return (
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Smartphone className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Install App
          </CardTitle>
          <CardDescription>PWA installation status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* App installed status */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--success-light)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}
          >
            <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--success-text)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--success-text)' }}>
              App installed
            </span>
          </div>

          {/* Notification permission status */}
          {notifSupported && (
            <>
              {notifPermission === 'granted' ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--success-light)', border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}
                >
                  <Bell className="w-4 h-4 shrink-0" style={{ color: 'var(--success-text)' }} />
                  <span className="text-[13px] font-medium" style={{ color: 'var(--success-text)' }}>
                    Notifications enabled
                  </span>
                </div>
              ) : notifPermission === 'denied' ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--danger-light)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
                >
                  <BellOff className="w-4 h-4 shrink-0" style={{ color: 'var(--danger-text)' }} />
                  <div>
                    <span className="text-[13px] font-medium block" style={{ color: 'var(--danger-text)' }}>
                      Notifications blocked
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Enable in browser/system settings
                    </span>
                  </div>
                </div>
              ) : (
                <Button onClick={handleRequestNotification} variant="secondary" size="sm" className="w-full">
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Enable Notifications
                </Button>
              )}
            </>
          )}

          {/* All OK */}
          {notifPermission === 'granted' && (
            <div className="text-center py-1">
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                ✓ All set! You'll receive door notifications.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Not installed — show install prompt
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          Install App
        </CardTitle>
        <CardDescription>Install as a standalone app for the best experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Android / Desktop Chrome — native install prompt */}
        {installPrompt && (
          <Button onClick={handleInstall} variant="primary" size="sm" className="w-full" disabled={installing}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {installing ? 'Installing...' : 'Install App'}
          </Button>
        )}

        {/* iOS — manual steps */}
        {iosDevice && !installPrompt && (
          <div>
            <button
              onClick={() => setShowIOSGuide((p) => !p)}
              className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors"
              style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" style={{ color: 'var(--info-text)' }} />
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  Install on iOS
                </span>
              </div>
              {showIOSGuide ? (
                <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
            {showIOSGuide && (
              <div className="mt-2 space-y-2 px-1">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface-hover)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5" style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>1</div>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    Tap the <Share className="w-3.5 h-3.5 inline" style={{ color: 'var(--info-text)' }} /> <strong>Share</strong> button in Safari
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface-hover)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5" style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>2</div>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    Scroll down and tap <Plus className="w-3.5 h-3.5 inline" style={{ color: 'var(--text-primary)' }} /> <strong>Add to Home Screen</strong>
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--bg-surface-hover)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5" style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>3</div>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    Tap <strong>Add</strong> to install
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Android — no prompt available yet, guide to Chrome */}
        {androidDevice && !installPrompt && (
          <div className="space-y-2">
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--info-light)', border: '1px solid color-mix(in srgb, var(--info) 25%, transparent)' }}
            >
              <Smartphone className="w-4 h-4 shrink-0" style={{ color: 'var(--info-text)' }} />
              <p className="text-[12px]" style={{ color: 'var(--info-text)' }}>
                Open this page in <strong>Chrome</strong> to enable the install button
              </p>
            </div>
          </div>
        )}

        {/* Desktop — no prompt  */}
        {!iosDevice && !androidDevice && !installPrompt && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--info-light)', border: '1px solid color-mix(in srgb, var(--info) 25%, transparent)' }}
          >
            <Download className="w-4 h-4 shrink-0" style={{ color: 'var(--info-text)' }} />
            <div>
              <p className="text-[12px] font-medium" style={{ color: 'var(--info-text)' }}>
                Install from browser
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Look for the install icon in your browser&apos;s address bar
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Notification Preferences Section ──

const NOTIFICATION_OPTIONS: { key: NotificationType; label: string; description: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
  { key: 'door_open', label: 'Door Opened', description: 'When door is unlocked (RFID/Touch/Web)', icon: DoorOpen },
  { key: 'door_locked', label: 'Door Locked', description: 'When door auto-locks', icon: Lock },
  { key: 'rfid_access', label: 'RFID Access Granted', description: 'Authorized card scanned', icon: CreditCard },
  { key: 'rfid_denied', label: 'RFID Access Denied', description: 'Unauthorized card attempt', icon: ShieldOff },
  { key: 'rfid_disabled', label: 'RFID Toggled', description: 'RFID reader enabled/disabled', icon: ShieldCheck },
  { key: 'card_registered', label: 'Card Registered', description: 'New card added', icon: UserPlus },
  { key: 'card_removed', label: 'Card Removed', description: 'Card deleted', icon: UserMinus },
  { key: 'device_offline', label: 'Device Offline', description: 'ESP32 connection lost', icon: WifiOff },
  { key: 'device_online', label: 'Device Online', description: 'ESP32 reconnected', icon: Wifi },
];

export function NotificationPreferencesSection() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleToggle = useCallback((key: NotificationType) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setNotificationPreferences(updated);
      return updated;
    });
  }, []);

  const handleEnableAll = useCallback(() => {
    const all = Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.key, true])) as unknown as NotificationPreferences;
    setPrefs(all);
    setNotificationPreferences(all);
  }, []);

  const handleDisableAll = useCallback(() => {
    const none = Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.key, false])) as unknown as NotificationPreferences;
    setPrefs(none);
    setNotificationPreferences(none);
  }, []);

  if (permission === 'unsupported') return null;

  if (permission !== 'granted') {
    return (
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Push Notifications
          </CardTitle>
          <CardDescription>Enable notifications first to configure preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'var(--warning-light)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)' }}
          >
            <BellOff className="w-4 h-4 shrink-0" style={{ color: 'var(--warning-text)' }} />
            <p className="text-[12px]" style={{ color: 'var(--warning-text)' }}>
              {permission === 'denied'
                ? 'Notifications are blocked. Please enable them in your browser settings.'
                : 'Enable notifications from the Install App section above to configure preferences.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              Push Notifications
            </CardTitle>
            <CardDescription>{enabledCount}/{NOTIFICATION_OPTIONS.length} enabled</CardDescription>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleEnableAll}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
              style={{ background: 'var(--success-light)', color: 'var(--success-text)' }}
            >
              All On
            </button>
            <button
              onClick={handleDisableAll}
              className="px-2 py-1 rounded-lg text-[10px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              All Off
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {NOTIFICATION_OPTIONS.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleToggle(key)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left"
              style={{
                background: prefs[key] ? 'var(--primary-ghost)' : 'var(--bg-surface-hover)',
                border: prefs[key] ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: prefs[key] ? 'var(--primary)' : 'var(--text-muted)' }} />
                <div>
                  <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
                </div>
              </div>
              <div
                className="w-8 h-[18px] rounded-full flex items-center px-0.5 transition-all shrink-0"
                style={{
                  background: prefs[key] ? 'var(--primary)' : 'var(--border-strong)',
                  justifyContent: prefs[key] ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full transition-all"
                  style={{
                    background: prefs[key] ? 'var(--primary-text)' : 'var(--bg-surface)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
