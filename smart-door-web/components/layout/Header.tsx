'use client';

import { useState } from 'react';
import { Settings, Radio, LogOut } from 'lucide-react';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="px-4 md:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--primary)',
                boxShadow: '0 0 16px rgba(191, 254, 1, 0.2)',
              }}
            >
              <Radio className="w-5 h-5" style={{ color: 'var(--primary-text)' }} />
            </div>
          </div>

          {/* Right: Settings + Logout + Profile */}
          <div className="flex items-center gap-2">
            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Settings"
            >
              <Settings className="w-[16px] h-[16px]" />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid color-mix(in srgb, var(--danger) 40%, var(--border))';
                e.currentTarget.style.color = 'var(--danger)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Logout"
            >
              <LogOut className="w-[16px] h-[16px]" />
            </button>

            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs overflow-hidden"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-text)',
              }}
            >
              A
            </div>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
