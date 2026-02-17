'use client';

import { Card } from '@/components/ui/Card';
import { MasonryGrid } from '@/components/dashboard/MasonryGrid';

// Skeleton pulse block
function Shimmer({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: 'var(--bg-elevated)', ...style }}
    />
  );
}

// ── Door Status Skeleton (~260px) ──
export function DoorStatusSkeleton() {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Shimmer className="h-3 w-24 mb-3" />
          <Shimmer className="h-9 w-36 mb-5" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-5 w-12 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-28" />
              <Shimmer className="h-3 w-10" />
            </div>
          </div>
        </div>
        <Shimmer className="w-16 h-16 rounded-2xl ml-4 shrink-0" />
      </div>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <Shimmer className="h-3 w-20 mb-2" />
        <Shimmer className="h-3 w-40" />
      </div>
    </Card>
  );
}

// ── System Info Skeleton (~280px) ──
export function SystemInfoSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-24 mb-1.5" />
            <Shimmer className="h-2.5 w-36" />
          </div>
        </div>
      </div>
      {/* 6 rows */}
      <div className="space-y-3.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shimmer className="w-4 h-4 rounded" />
              <Shimmer className="h-3 w-16" />
            </div>
            {i === 2 || i === 3 ? (
              <div className="flex items-center gap-2 flex-1 ml-4">
                <Shimmer className="h-2 flex-1 rounded-full" />
                <Shimmer className="h-3 w-8" />
              </div>
            ) : (
              <Shimmer className="h-3 w-20" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Door Controls Skeleton (~140px) ──
export function DoorControlsSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-28 mb-1.5" />
            <Shimmer className="h-2.5 w-32" />
          </div>
        </div>
      </div>
      {/* Button */}
      <Shimmer className="h-12 w-full rounded-2xl" />
    </Card>
  );
}

// ── Last Access Skeleton (~260px) ──
export function LastAccessSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-24 mb-1.5" />
            <Shimmer className="h-2.5 w-40" />
          </div>
        </div>
      </div>
      {/* Access info */}
      <div className="flex flex-col items-center py-4">
        <Shimmer className="w-12 h-12 rounded-xl mb-3" />
        <Shimmer className="h-3 w-28 mb-2" />
        <Shimmer className="h-4 w-36 mb-2" />
        <Shimmer className="h-3 w-24" />
      </div>
      <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Shimmer className="h-3 w-32 mx-auto" />
      </div>
    </Card>
  );
}

// ── Auto Lock Skeleton (~260px) ──
export function AutoLockSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-28 mb-1.5" />
            <Shimmer className="h-2.5 w-40" />
          </div>
        </div>
      </div>
      {/* Big number */}
      <div className="flex flex-col items-center mb-4">
        <Shimmer className="h-10 w-16 mb-1" />
        <Shimmer className="h-3 w-8" />
      </div>
      {/* Slider */}
      <Shimmer className="h-6 w-full rounded-full mb-2" />
      {/* Tick labels */}
      <div className="flex justify-between mb-4">
        {[...Array(10)].map((_, i) => (
          <Shimmer key={i} className="h-2 w-3" />
        ))}
      </div>
      {/* Button */}
      <Shimmer className="h-10 w-full rounded-2xl" />
    </Card>
  );
}

// ── Card Delay Skeleton (~450px) ──
export function CardDelaySkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
            <div>
              <Shimmer className="h-3.5 w-32 mb-1.5" />
              <Shimmer className="h-2.5 w-44" />
            </div>
          </div>
          <Shimmer className="w-7 h-7 rounded-lg" />
        </div>
      </div>
      {/* Bulk schedule button */}
      <Shimmer className="h-8 w-28 rounded-lg mb-3" />
      {/* 3 card items */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-4 last:mb-0">
          <div className="flex items-center gap-3 mb-2">
            <Shimmer className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <Shimmer className="h-3.5 w-28" />
                <Shimmer className="h-5 w-14 rounded-full" />
              </div>
              <Shimmer className="h-2.5 w-36" />
            </div>
          </div>
          {/* Slider */}
          <div className="flex items-center gap-2 mb-2">
            <Shimmer className="h-2.5 w-5" />
            <Shimmer className="h-4 flex-1 rounded-full" />
            <Shimmer className="h-2.5 w-8" />
          </div>
          {/* Save + schedule buttons */}
          <div className="flex items-center gap-2">
            <Shimmer className="h-9 flex-1 rounded-xl" />
            <Shimmer className="w-9 h-9 rounded-xl" />
          </div>
        </div>
      ))}
      {/* View all link */}
      <Shimmer className="h-8 w-32 rounded-lg mx-auto mt-2" />
    </Card>
  );
}

// ── Device Tools Skeleton (~200px) ──
export function DeviceToolsSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
          <div>
            <Shimmer className="h-3.5 w-28 mb-1.5" />
            <Shimmer className="h-2.5 w-32" />
          </div>
        </div>
      </div>
      {/* 3x2 Grid of buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        {[...Array(6)].map((_, i) => (
          <Shimmer key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </Card>
  );
}

// ── Cards Section Skeleton (~320px) ──
export function CardsSectionSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
            <div>
              <Shimmer className="h-3.5 w-32 mb-1.5" />
              <Shimmer className="h-2.5 w-20" />
            </div>
          </div>
          <Shimmer className="w-7 h-7 rounded-lg" />
        </div>
      </div>
      {/* Card visual placeholder */}
      <Shimmer className="h-40 w-full rounded-2xl mb-4" />
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mb-3">
        {[...Array(4)].map((_, i) => (
          <Shimmer key={i} className="w-2 h-2 rounded-full" />
        ))}
      </div>
      {/* View all button */}
      <Shimmer className="h-8 w-28 rounded-lg mx-auto" />
    </Card>
  );
}

// ── Logs Section Skeleton (~320px) ──
export function LogsSectionSkeleton() {
  return (
    <Card>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shimmer className="w-8 h-8 rounded-xl shrink-0" />
            <div>
              <Shimmer className="h-3.5 w-28 mb-1.5" />
              <Shimmer className="h-2.5 w-20" />
            </div>
          </div>
          <Shimmer className="w-7 h-7 rounded-lg" />
        </div>
      </div>
      {/* 3 log entries */}
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Shimmer className="w-9 h-9 rounded-xl shrink-0" />
            <div className="flex-1">
              <Shimmer className="h-3.5 w-32 mb-1.5" />
              <Shimmer className="h-2.5 w-24" />
            </div>
            <Shimmer className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* More entries link */}
      <Shimmer className="h-8 w-36 rounded-lg mx-auto mt-3" />
    </Card>
  );
}

// ── Map card ID to skeleton ──
const SKELETON_MAP: Record<string, () => React.JSX.Element> = {
  'door-status': DoorStatusSkeleton,
  'system-info': SystemInfoSkeleton,
  'door-controls': DoorControlsSkeleton,
  'last-access': LastAccessSkeleton,
  'auto-lock': AutoLockSkeleton,
  'card-delay': CardDelaySkeleton,
  'device-tools': DeviceToolsSkeleton,
  'cards': CardsSectionSkeleton,
  'logs': LogsSectionSkeleton,
};

export function DashboardSkeletons({ layout }: { layout: string[] }) {
  return (
    <MasonryGrid>
      {layout.map((id) => {
        const Skeleton = SKELETON_MAP[id];
        if (!Skeleton) return null;
        return <Skeleton key={id} />;
      })}
    </MasonryGrid>
  );
}
