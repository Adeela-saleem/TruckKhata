import type { InsuranceStatus } from '../../core/domain/calc';
import { daysBetween, today } from '../../core/domain/dates';
import { cn } from '../../components/ui/cn';
import { useApp } from '../../app/context';

export const daysLeft = (expiry: string) => daysBetween(today(), expiry);

export const statusText = (status: InsuranceStatus) => cn(
  status === 'expired' && 'text-rose-600 dark:text-rose-400',
  status === 'expiring' && 'text-amber-700 dark:text-amber-400',
);

/** Days to the last date: a count while it runs, then how long ago it ran out. */
export function daysText(expiry: string, t: (k: string, v?: Record<string, string | number>) => string, long = false) {
  const left = daysLeft(expiry);
  if (left === 0) return long ? t('web.insurance.expiresToday') : t('web.insurance.today');
  if (left < 0) return t(long ? 'web.insurance.expiredAgo' : 'web.insurance.ago', { count: -left });
  return long ? t('web.insurance.expiresIn', { count: left }) : String(left);
}

export function DaysLeft({ expiry, status }: { expiry: string; status: InsuranceStatus }) {
  const { t } = useApp();
  return <span className={cn('tabular-nums font-medium', statusText(status))}>{daysText(expiry, t)}</span>;
}

/** A year-long bar that empties as the last date comes closer. */
export function DaysBar({ expiry, status }: { expiry: string; status: InsuranceStatus }) {
  const share = Math.max(0, Math.min(1, daysLeft(expiry) / 365));
  return (
    <div className="h-1.5 rounded-full bg-surface-2 border border-line overflow-hidden">
      <div className={cn('h-full rounded-full', status === 'expired' ? 'bg-rose-500' : status === 'expiring' ? 'bg-amber-500' : 'bg-emerald-500')}
        style={{ width: `${share * 100}%` }} />
    </div>
  );
}
