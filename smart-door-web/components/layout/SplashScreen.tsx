'use client';

import { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { isPWAInstalled } from '@/lib/notifications';

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash screen when running as installed PWA
    if (!isPWAInstalled()) return;

    // Check if splash was already shown this session
    const shown = sessionStorage.getItem('splash-shown');
    if (shown) return;

    setVisible(true);
    sessionStorage.setItem('splash-shown', '1');

    // Start fade out after 1.2s
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    // Fully remove after 1.6s
    const removeTimer = setTimeout(() => setVisible(false), 1600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-400"
      style={{
        background: 'var(--bg-base, #09090B)',
        opacity: fadeOut ? 0 : 1,
      }}
    >
      {/* Logo */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: 'var(--primary, #BFFE01)',
          boxShadow: '0 0 40px rgba(191, 254, 1, 0.3)',
          animation: 'splashPulse 1.5s ease-in-out infinite',
        }}
      >
        <Radio className="w-9 h-9" style={{ color: 'var(--primary-text, #09090B)' }} />
      </div>

      {/* Title */}
      <h1
        className="text-xl font-bold mb-1"
        style={{ color: 'var(--text-primary, #FAFAFA)' }}
      >
        Smart Door Lock
      </h1>
      <p
        className="text-xs"
        style={{ color: 'var(--text-muted, #71717A)' }}
      >
        IoT Control Panel
      </p>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
