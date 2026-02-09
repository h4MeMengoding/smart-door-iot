'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { FileText, Loader2, Maximize2, Fingerprint, Globe, CreditCard, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useServerLogs } from '@/hooks/useServerLogs';
import { formatTimestamp, formatUid } from '@/lib/utils';
import { AccessLog } from '@/lib/types';

interface LogsSectionProps {
  onExpand: () => void;
}

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

function getActionBadge(action: string, success: boolean) {
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
}

export function LogsSection({ onExpand }: LogsSectionProps) {
  const { logs, loading, error } = useServerLogs();

  const displayLogs = logs.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-light)' }}
            >
              <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <CardTitle>Access History</CardTitle>
              <CardDescription>{logs.length} total entries</CardDescription>
            </div>
          </div>
          <button
            onClick={onExpand}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
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
            title="View all logs"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
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
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <FileText className="w-5 h-5" style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No access logs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
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
              </motion.div>
            ))}
            {logs.length > 3 && (
              <button
                onClick={onExpand}
                className="w-full text-center py-2 rounded-xl text-xs font-medium transition-colors"
                style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
              >
                +{logs.length - 3} more entries
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
