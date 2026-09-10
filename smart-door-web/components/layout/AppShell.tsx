'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-start justify-center relative overflow-x-hidden">
      {/* Animated background glows */}
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="glow glow-3" />
      
      {/* Centered app container */}
      <div
        className="w-full max-w-[1200px] min-h-screen mx-auto relative z-10"
        style={{ padding: '0 clamp(0.5rem, 2vw, 2rem)' }}
      >
        {/* Main content area */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Register service worker for PWA + Push Notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Check for SW updates periodically (every 60s)
          setInterval(() => registration.update(), 60_000);

          // When a new SW is waiting, auto-activate it
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New SW ready — tell it to activate immediately
                  newWorker.postMessage('skipWaiting');
                }
              });
            }
          });

          // Auto-subscribe / refresh push subscription on every app load.
          // iOS APNs can silently rotate endpoints — always re-sync keys to server.
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'PushManager' in window) {
            import('@/lib/notifications').then(({ subscribeToPush }) => {
              subscribeToPush().then((ok) => {
                console.log('[Push] Subscription sync result:', ok);
              });
            });
          }
        })
        .catch(() => {
          // SW registration failed — non-critical
        });

      // Reload page when new SW takes over (seamless update)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Capture beforeinstallprompt globally so it's available when Settings opens later
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as Record<string, unknown>).__pwaInstallPrompt = e;
      // Dispatch custom event so any mounted component can react
      window.dispatchEvent(new CustomEvent('pwa-install-available'));
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  return (
    <>
      <LayoutContent>{children}</LayoutContent>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            fontSize: '13px',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-lg)',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}
