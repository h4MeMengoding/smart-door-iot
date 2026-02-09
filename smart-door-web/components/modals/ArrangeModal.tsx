'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
  LayoutList,
  Zap,
  Lock,
  Info,
  Gamepad2,
  Clock,
  Timer,
  CreditCard,
  FileText,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const CARD_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  'door-status': { label: 'Door Status', icon: <Lock className="w-3.5 h-3.5" /> },
  'system-info': { label: 'System Info', icon: <Info className="w-3.5 h-3.5" /> },
  'door-controls': { label: 'Door Controls', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  'last-access': { label: 'Last Access', icon: <Clock className="w-3.5 h-3.5" /> },
  'auto-lock': { label: 'Auto Lock', icon: <Timer className="w-3.5 h-3.5" /> },
  'card-delay': { label: 'Card Delay', icon: <Zap className="w-3.5 h-3.5" /> },
  'device-tools': { label: 'Device Tools', icon: <Wrench className="w-3.5 h-3.5" /> },
  'cards': { label: 'Registered Cards', icon: <CreditCard className="w-3.5 h-3.5" /> },
  'logs': { label: 'Access Logs', icon: <FileText className="w-3.5 h-3.5" /> },
};

interface ArrangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: string[];
  onSave: (newLayout: string[]) => void;
}

export function ArrangeModal({ isOpen, onClose, layout, onSave }: ArrangeModalProps) {
  const [items, setItems] = useState<string[]>(layout);

  // Reset items when modal opens
  const handleOpen = useCallback(() => {
    setItems(layout);
  }, [layout]);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setItems(next);
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setItems(next);
  };

  const handleSave = () => {
    onSave(items);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="arrange-modal"
          className="fixed inset-0 z-50 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onAnimationComplete={() => {
            if (isOpen) handleOpen();
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[80vh] overflow-y-auto mt-[10vh] mx-4 rounded-3xl"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 rounded-t-3xl"
              style={{
                background: 'var(--bg-base)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--primary-light)' }}
                >
                  <LayoutList className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Arrange Layout</h2>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Top item = top-left position</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 space-y-1.5">
              {items.map((id, index) => {
                const meta = CARD_LABELS[id] || { label: id, icon: <GripVertical className="w-3.5 h-3.5" /> };
                return (
                  <motion.div
                    key={id}
                    layout
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl group"
                    style={{
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Position number */}
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {index + 1}
                    </span>

                    {/* Icon */}
                    <span style={{ color: 'var(--text-muted)' }}>{meta.icon}</span>

                    {/* Label */}
                    <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>

                    {/* Move buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150"
                        style={{
                          color: index === 0 ? 'var(--border-strong)' : 'var(--text-muted)',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (index > 0) {
                            e.currentTarget.style.background = 'var(--primary-light)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = index === 0 ? 'var(--border-strong)' : 'var(--text-muted)';
                        }}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === items.length - 1}
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150"
                        style={{
                          color: index === items.length - 1 ? 'var(--border-strong)' : 'var(--text-muted)',
                          cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          if (index < items.length - 1) {
                            e.currentTarget.style.background = 'var(--primary-light)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = index === items.length - 1 ? 'var(--border-strong)' : 'var(--text-muted)';
                        }}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3 rounded-b-3xl"
              style={{
                background: 'var(--bg-base)',
                borderTop: '1px solid var(--border)',
              }}
            >
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSave}>Apply</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
