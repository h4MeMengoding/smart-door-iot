'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from 'react-hot-toast';
import { SplashScreen } from './SplashScreen';

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
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // SW registration failed — non-critical
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <SplashScreen />
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
    </ThemeProvider>
  );
}
