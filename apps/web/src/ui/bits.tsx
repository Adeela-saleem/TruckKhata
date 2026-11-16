import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import type { CycleStatus, Direction, InsuranceStatus } from '../core/domain/calc';
import { formatPKR } from '../core/domain/money';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { useApp } from '../app/context';

/**
 * The Case # as a stamped slip number: the one detail that ties every record together,
 * so it always looks the same and always reads bold.
 */
export function CaseChip({ caseNo, highlight, className }: { caseNo: string | null | undefined; highlight?: boolean; className?: string }) {
  if (!caseNo) return <span className="text-content-subtle">–</span>;
  return (
    <span dir="ltr" className={cn('case-chip inline-flex items-center h-7 px-2.5 rounded-lg font-mono text-[13.5px] font-semibold tracking-wide whitespace-nowrap',
      highlight ? 'case-chip--hit' : '', className)}>
      {caseNo}
    </span>
  );
}

export function Money({ value, tone, sign, className }: { value: number | null | undefined; tone?: 'good' | 'bad' | 'auto' | 'muted'; sign?: '+' | '-'; className?: string }) {
  const v = value ?? 0;
  const resolved = tone === 'auto' ? (v < 0 ? 'bad' : undefined) : tone;
  return (
    <span dir="ltr" className={cn('tabular-nums whitespace-nowrap',
      resolved === 'good' && 'text-good',
      resolved === 'bad' && 'text-bad',
      resolved === 'muted' && 'text-content-subtle', className)}>
      {sign ? `${sign} ` : ''}{formatPKR(v)}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  const { t } = useApp();
  const Icon = direction === 'outward' ? ArrowUpRight : ArrowDownLeft;
  return (
    <Badge tone={direction === 'outward' ? 'info' : 'violet'}>
      <Icon size={13} strokeWidth={2.2} />{t(`direction.${direction}`)}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CycleStatus }) {
  const { t } = useApp();
  const tone = status === 'complete' ? 'success' : status === 'ready' ? 'info' : 'warning';
  return <Badge tone={tone} dot>{t(`status.${status}`)}</Badge>;
}

export function InsuranceBadge({ status }: { status: InsuranceStatus }) {
  const { t } = useApp();
  return <Badge tone={status === 'active' ? 'success' : status === 'expiring' ? 'warning' : 'danger'} dot>{t(`insurance.${status}`)}</Badge>;
}

export function PaidBadge({ balance }: { balance: number }) {
  const { t } = useApp();
  return <Badge tone={balance > 0 ? 'warning' : 'success'} dot>{t(balance > 0 ? 'bill.unpaid' : 'bill.paid')}</Badge>;
}

/** A label and its value, for the facts at the top of a record. */
export function Facts({ items, columns = 3 }: { items: { label: string; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const shown = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '');
  const cols = columns === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4', cols)}>
      {shown.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[13px] text-content-subtle">{i.label}</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-content break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One line of a worked-out total, like a line on a printed receipt. */
export function SumLine({ label, value, sign, total, tone }: { label: string; value: number; sign?: '+' | '-'; total?: boolean; tone?: 'good' | 'bad' }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', total ? 'border-t border-line-strong mt-1 pt-3' : '')}>
      <span className={cn('text-[14px]', total ? 'font-semibold text-content' : 'text-content-muted')}>{label}</span>
      <Money value={value} sign={sign} tone={tone} className={cn(total ? 'text-[17px] font-semibold text-content' : 'text-[14.5px] text-content')} />
    </div>
  );
}

export function SectionCard({ title, note, action, children, padded = true, className }: {
  title: string; note?: ReactNode; action?: ReactNode; children: ReactNode; padded?: boolean; className?: string;
}) {
  return (
    <section className={cn('card', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 sm:px-7 pt-5', padded ? 'pb-1' : 'pb-4 border-b border-line')}>
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="card-title font-display text-[18px] text-content">{title}</h2>
          {note && <span className="text-[13px] text-content-subtle tabular-nums">{note}</span>}
        </div>
        {action}
      </div>
      <div className={padded ? 'px-6 sm:px-7 pt-4 pb-6' : ''}>{children}</div>
    </section>
  );
}

/** Buttons used across pages, in the house style. */
export function Btn({ children, onClick, tone = 'plain', type = 'button', disabled, icon, className, title, busy }: {
  children?: ReactNode; onClick?: () => void; tone?: 'primary' | 'plain' | 'quiet' | 'danger'; type?: 'button' | 'submit';
  disabled?: boolean; icon?: ReactNode; className?: string; title?: string;
  /** Shows a spinner in place of the icon while the action runs. */
  busy?: boolean;
}) {
  const tones = {
    primary: 'noir-cta text-white',
    plain: 'bg-surface text-content shadow-[0_1px_2px_rgb(var(--shadow)/0.05)] ring-1 ring-line hover:bg-surface-2',
    quiet: 'text-content-muted hover:text-content hover:bg-surface-2',
    danger: 'bg-surface text-bad ring-1 ring-line hover:bg-bad/5',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} title={title} aria-label={!children ? title : undefined} aria-busy={busy || undefined}
      className={cn('btn-press inline-flex items-center justify-center gap-2 h-11 rounded-full text-[14.5px] font-medium disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        children ? 'px-5' : 'w-11', tones[tone], className)}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : icon}{children}
    </button>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={cn('rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed',
      tone === 'warn'
        ? 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
        : 'bg-brand-soft text-content')}>
      {children}
    </div>
  );
}
