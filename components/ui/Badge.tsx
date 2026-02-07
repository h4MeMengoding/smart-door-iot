import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'default';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const getStyles = () => {
      switch (variant) {
        case 'success':
          return { background: 'var(--success-light)', color: 'var(--success-text)', borderColor: 'transparent' };
        case 'danger':
          return { background: 'var(--danger-light)', color: 'var(--danger-text)', borderColor: 'transparent' };
        case 'warning':
          return { background: 'var(--warning-light)', color: 'var(--warning-text)', borderColor: 'transparent' };
        case 'info':
          return { background: 'var(--info-light)', color: 'var(--info-text)', borderColor: 'transparent' };
        default:
          return { background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' };
      }
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          className
        )}
        style={getStyles()}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
