'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Download,
  Bell,
  BellOff,
  Check,
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
import toast from 'react-hot-toast';

// ── PWA Install Section ──
export function PWAInstallSection() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [iosDevice, setIosDevice] = useState(false);
  const [androidDevice, setAndroidDevice] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [pushStatus, setPushStatus] = useState<'unknown' | 'subscribed' | 'not-subscribed' | 'subscribing'>('unknown');

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
      setPushStatus('subscribing');
      const ok = await subscribeToPush();
      setPushStatus(ok ? 'subscribed' : 'not-subscribed');
      if (ok) {
        toast.success('Push notifications enabled');
      } else {
        toast.error('Failed to register push subscription');
      }
    }
  };

  const handleManualSubscribe = async () => {
    setPushStatus('subscribing');
    const ok = await subscribeToPush();
    setPushStatus(ok ? 'subscribed' : 'not-subscribed');
    if (ok) {
      toast.success('Push registered successfully');
    } else {
      toast.error('Push registration failed — check console');
    }
  };

  // On mount, check push subscription status
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      isPushSubscribed().then((subscribed) => {
        setPushStatus(subscribed ? 'subscribed' : 'not-subscribed');
        if (!subscribed) {
          // Auto-try subscribing
          subscribeToPush().then((ok) => {
            setPushStatus(ok ? 'subscribed' : 'not-subscribed');
          });
        }
      });
    }
  }, []);

  // Already installed — hide install card entirely, notifications handled separately
  if (isInstalled) {
    const notifSupported = isNotificationSupported();

    // If notifications are fully set up, hide this card completely
    if (!notifSupported || (notifPermission === 'granted' && pushStatus === 'subscribed')) {
      return null;
    }

    // Show only notification setup if still needed
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-3 py-3" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-light)' }}
            >
              <Bell className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Push notification setup</p>
            </div>
          </div>

          {notifSupported && (
            <div className="space-y-2">
              {notifPermission === 'granted' ? (
                <>
                  {pushStatus === 'subscribed' && (
                    <div
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]"
                      style={{ background: 'var(--success-light)' }}
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success-text)' }} />
                      <span style={{ color: 'var(--success-text)' }}>Push notifications active</span>
                    </div>
                  )}
                  {pushStatus === 'not-subscribed' && (
                    <>
                      <div
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]"
                        style={{ background: 'var(--warning-light)' }}
                      >
                        <BellOff className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warning-text)' }} />
                        <span style={{ color: 'var(--warning-text)' }}>Push not registered on server</span>
                      </div>
                      <Button onClick={handleManualSubscribe} variant="secondary" size="sm" className="w-full text-[11px]">
                        <Bell className="w-3 h-3 mr-1" />
                        Register Push
                      </Button>
                    </>
                  )}
                  {pushStatus === 'subscribing' && (
                    <p className="text-center text-[11px] py-1" style={{ color: 'var(--text-muted)' }}>Registering...</p>
                  )}
                  {pushStatus === 'unknown' && (
                    <p className="text-center text-[11px] py-1" style={{ color: 'var(--text-muted)' }}>Checking...</p>
                  )}
                </>
              ) : notifPermission === 'denied' ? (
                <div
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]"
                  style={{ background: 'var(--danger-light)' }}
                >
                  <BellOff className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--danger-text)' }} />
                  <span style={{ color: 'var(--danger-text)' }}>Blocked — enable in browser settings</span>
                </div>
              ) : (
                <Button onClick={handleRequestNotification} variant="secondary" size="sm" className="w-full text-[11px]">
                  <Bell className="w-3 h-3 mr-1" />
                  Enable Notifications
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not installed — show install section
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-3 py-3" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3 mb-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-light)' }}
          >
            <Download className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Install App</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Standalone app for best experience</p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Android / Desktop Chrome — native install */}
          {installPrompt && (
            <Button onClick={handleInstall} variant="primary" size="sm" className="w-full text-[11px]" disabled={installing}>
              <Download className="w-3 h-3 mr-1" />
              {installing ? 'Installing...' : 'Install App'}
            </Button>
          )}

          {/* iOS manual steps */}
          {iosDevice && !installPrompt && (
            <div>
              <button
                onClick={() => setShowIOSGuide((p) => !p)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[12px]"
                style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5" style={{ color: 'var(--info-text)' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Install on iOS</span>
                </div>
                {showIOSGuide
                  ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                }
              </button>
              {showIOSGuide && (
                <div className="mt-1.5 space-y-1 px-0.5">
                  {[
                    { step: '1', text: <>Tap <Share className="w-3 h-3 inline" style={{ color: 'var(--info-text)' }} /> <strong>Share</strong> in Safari</> },
                    { step: '2', text: <>Tap <Plus className="w-3 h-3 inline" style={{ color: 'var(--text-primary)' }} /> <strong>Add to Home Screen</strong></> },
                    { step: '3', text: <>Tap <strong>Add</strong></> },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: 'var(--bg-surface-hover)' }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold mt-0.5" style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}>{s.step}</div>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Android — no prompt yet */}
          {androidDevice && !installPrompt && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'var(--info-light)' }}>
              <Smartphone className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--info-text)' }} />
              <span style={{ color: 'var(--info-text)' }}>Open in <strong>Chrome</strong> to install</span>
            </div>
          )}

          {/* Desktop — no prompt */}
          {!iosDevice && !androidDevice && !installPrompt && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'var(--info-light)' }}>
              <Download className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--info-text)' }} />
              <span style={{ color: 'var(--info-text)' }}>Look for the install icon in your browser address bar</span>
            </div>
          )}
        </div>
      </div>
    </div>
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
    const timer = setTimeout(() => setPermission(getNotificationPermission()), 0);
    return () => clearTimeout(timer);
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
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-3 py-3" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-light)' }}
            >
              <Bell className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Push Preferences</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enable notifications first</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'var(--warning-light)' }}>
            <BellOff className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warning-text)' }} />
            <span style={{ color: 'var(--warning-text)' }}>
              {permission === 'denied'
                ? 'Blocked — enable in browser settings'
                : 'Enable from Install App section above'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Header row */}
      <div
        className="px-3 py-2.5 flex items-center gap-3"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--primary-light)' }}
        >
          <Bell className="w-4 h-4" style={{ color: 'var(--primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Push Preferences</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{enabledCount}/{NOTIFICATION_OPTIONS.length} enabled</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleEnableAll}
            className="px-2 py-1 rounded-md text-[10px] font-medium"
            style={{ background: 'var(--success-light)', color: 'var(--success-text)' }}
          >
            All
          </button>
          <button
            onClick={handleDisableAll}
            className="px-2 py-1 rounded-md text-[10px] font-medium"
            style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            None
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Toggle list */}
      <div style={{ background: 'var(--bg-surface)' }}>
        {NOTIFICATION_OPTIONS.map(({ key, label, icon: Icon }, idx) => (
          <div key={key}>
            {idx > 0 && <div className="mx-3" style={{ height: 1, background: 'var(--border)' }} />}
            <button
              onClick={() => handleToggle(key)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
            >
              <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: prefs[key] ? 'var(--primary)' : 'var(--text-muted)' }} />
              <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
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
          </div>
        ))}
      </div>
    </div>
  );
}
