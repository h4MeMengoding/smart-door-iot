import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return timestamp;
  }
}

export function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return formatTimestamp(timestamp);
  } catch {
    return timestamp;
  }
}

export function formatUid(uid: string): string {
  // Format UID to be more readable (e.g., BE:02:28:DB or BE0228DB)
  if (!uid) return '-';
  // Non-hex UIDs (like "Web Dashboard", "Touch Sensor") — return as-is
  if (!/^[A-Fa-f0-9:]+$/.test(uid)) return uid;
  if (uid.includes(':')) return uid.toUpperCase();
  return uid.match(/.{1,2}/g)?.join(':').toUpperCase() || uid;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseUptime(uptime: string): string {
  // Convert uptime string like "12345s" to readable format
  const seconds = parseInt(uptime.replace('s', ''));
  if (isNaN(seconds)) return uptime;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
// Master Card UIDs (hardcoded in ESP32, cannot be deleted from dashboard)
export const MASTER_CARD_UIDS = ['BE0228DB', 'CAFEBABE'];

export function isMasterCardUid(uid: string): boolean {
  const normalized = uid.replace(/:/g, '').toUpperCase();
  return MASTER_CARD_UIDS.includes(normalized);
}