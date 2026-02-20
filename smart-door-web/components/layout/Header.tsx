'use client';

import { useState } from 'react';
import { Settings, Radio } from 'lucide-react';
import { SettingsModal } from '@/components/settings/SettingsModal';

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

          {/* Right: Settings only */}
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
