'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dashboard_layout';

const DEFAULT_LAYOUT = [
  'door-status',
  'system-info',
  'door-controls',
  'last-access',
  'auto-lock',
  'card-delay',
  'device-tools',
  'cards',
  'logs',
];

function getInitialLayout(): string[] {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_LAYOUT;
    const parsed: string[] = JSON.parse(saved);
    const newCards = DEFAULT_LAYOUT.filter((id) => !parsed.includes(id));
    const validSaved = parsed.filter((id) => DEFAULT_LAYOUT.includes(id));
    return [...validSaved, ...newCards];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<string[]>(getInitialLayout);
  const [isEditing, setIsEditing] = useState(false);

  const saveLayout = useCallback((newLayout: string[]) => {
    setLayout(newLayout);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    layout,
    saveLayout,
    resetLayout,
    isEditing,
    setIsEditing,
    defaultLayout: DEFAULT_LAYOUT,
  };
}
