'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, Download, Trash2, XCircle, Loader2, X, Fingerprint, Globe, CreditCard, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerLogs } from '@/hooks/useServerLogs';
import { formatTimestamp, formatUid } from '@/lib/utils';
import { AccessLog } from '@/lib/types';
import toast from 'react-hot-toast';

function getLogIcon(log: AccessLog) {
  const color = log.success ? 'var(--success)' : 'var(--danger)';
  const bg = log.success ? 'var(--success-light)' : 'var(--danger-light)';
  let Icon = CreditCard;
  if (log.accessType === 'TOUCH') Icon = Fingerprint;
  else if (log.accessType === 'WEB') Icon = Globe;
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: bg, color }}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogsModal({ isOpen, onClose }: LogsModalProps) {
  const { logs, loading, error, refreshLogs } = useServerLogs();
  const [filter, setFilter] = useState<'all' | 'unlock' | 'denied'>('all');
  const LOGS_PER_PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(LOGS_PER_PAGE);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(LOGS_PER_PAGE);
  }, [filter]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.action === filter);

  const handleExportJson = () => {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported as JSON');
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Card UID', 'Nickname', 'Action', 'Success'];
    const rows = logs.map(log => [
      log.timestamp,
      log.cardUid || '',
      log.cardNickname || '',
      log.action,
      log.success.toString()
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported as CSV');
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) return;

    try {
      const response = await fetch('/api/logs/clear', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear logs');

      refreshLogs();
      toast.success('All logs cleared');
    } catch {
      toast.error('Failed to clear logs');
    }
  };

  const getActionBadge = (action: string, success: boolean) => {
    if (action === 'registered') {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ background: 'var(--info-light)', color: 'var(--info-text)' }}
        >
          Registered
        </span>
      );
    }
    return null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="logs-modal"
          className="fixed inset-0 z-50 flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
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
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto mt-[8vh] mx-4 rounded-3xl"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-3xl"
          style={{
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Access History</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{logs.length} total entries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
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

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5">
              <Button
                variant={filter === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({logs.length})
              </Button>
              <Button
                variant={filter === 'unlock' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('unlock')}
              >
                Unlocked ({logs.filter(l => l.action === 'unlock').length})
              </Button>
              <Button
                variant={filter === 'denied' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter('denied')}
              >
                Denied ({logs.filter(l => l.action === 'denied').length})
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={handleExportJson} disabled={logs.length === 0}>
                <Download className="w-3 h-3 mr-1" />
                JSON
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={logs.length === 0}>
                <Download className="w-3 h-3 mr-1" />
                CSV
              </Button>
              <Button variant="danger" size="sm" onClick={handleClearLogs} disabled={logs.length === 0}>
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Logs List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--danger)' }} />
              <p className="text-xs mb-3" style={{ color: 'var(--danger-text)' }}>Error: {error}</p>
              <Button onClick={refreshLogs} size="sm">Retry</Button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-10">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'var(--bg-surface-hover)' }}
              >
                <FileText className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {filter === 'all' ? 'No access logs yet' : `No ${filter} events`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredLogs.slice(0, visibleCount).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                    style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border)' }}
                  >
                    {getLogIcon(log)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {log.accessType === 'WEB'
                            ? 'Web'
                            : log.accessType === 'TOUCH'
                              ? 'Touch'
                              : log.cardNickname || formatUid(log.cardUid || '')}
                        </span>
                        {getActionBadge(log.action, log.success)}
                      </div>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {visibleCount < filteredLogs.length && (
                <button
                  onClick={() => setVisibleCount(prev => prev + LOGS_PER_PAGE)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors"
                  style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  View More ({filteredLogs.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
