'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CreditCard, FileText, Settings, Radio, X } from 'lucide-react';
import { useSidebar } from '@/hooks/useSidebar';
import { useEffect } from 'react';

const menuItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Cards', href: '/cards', icon: CreditCard },
  { name: 'Logs', href: '/logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOnly?: boolean;
}

export function Sidebar({ mobileOnly }: SidebarProps) {
  const pathname = usePathname();
  const { isMobileOpen, setMobileOpen } = useSidebar();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [setMobileOpen]);

  const navContent = (
    <div className="flex flex-col items-center h-full py-8 px-2">
      {/* Logo */}
      <div className="mb-10">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--primary)',
            boxShadow: '0 0 20px rgba(191, 254, 1, 0.25)',
          }}
        >
          <Radio className="w-5 h-5" style={{ color: 'var(--primary-text)' }} />
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-200 group"
              style={{
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? 'var(--primary-text)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 0 16px rgba(191, 254, 1, 0.2)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.5 : 2} />
              <span
                className="text-[10px] font-semibold leading-none tracking-wide"
                style={{ opacity: isActive ? 1 : 0.8 }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  // Mobile-only rendering (overlay drawer)
  if (mobileOnly) {
    if (!isMobileOpen) return null;
    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 drawer-backdrop"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className="absolute left-0 top-0 h-full flex flex-col drawer-panel"
          style={{
            width: '5.5rem',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3 right-0 left-0 mx-auto w-7 h-7 flex items-center justify-center rounded-lg transition-colors z-10"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X className="w-4 h-4" />
          </button>
          {navContent}
        </aside>
      </div>
    );
  }

  // Desktop rendering (static, inside flex container)
  return (
    <aside
      className="sticky top-0 h-screen flex-shrink-0"
      style={{ width: '5.5rem' }}
    >
      {navContent}
    </aside>
  );
}
