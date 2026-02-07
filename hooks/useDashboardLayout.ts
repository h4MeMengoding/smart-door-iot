'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dashboard_layout';

const DEFAULT_LAYOUT = [
  'door-status',
  'system-info',
  'door-controls',
  'last-access',
  'auto-lock',
  'card-delay',
  'add-card',
  'cards',
  'logs',
  'ota-update',
  'restart',
];

export function useDashboardLayout() {
  const [layout, setLayout] = useState<string[]>(DEFAULT_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);

  // Load saved layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        // Merge: keep saved order, append any new cards not in saved layout
        const newCards = DEFAULT_LAYOUT.filter((id) => !parsed.includes(id));
        // Remove cards that no longer exist
        const validSaved = parsed.filter((id) => DEFAULT_LAYOUT.includes(id));
        setLayout([...validSaved, ...newCards]);
      }
    } catch {
      // Use default layout
    }
  }, []);

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
