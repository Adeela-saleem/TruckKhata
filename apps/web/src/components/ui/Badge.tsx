import type { ReactNode } from 'react'
import { cn } from './cn'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-content-muted',
  brand: 'bg-brand-soft text-brand-strong',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  violet: 'bg-brand-soft text-brand-strong',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  /** A small dot in the badge's colour before the text, for statuses. */
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[13px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" aria-hidden />}
      {children}
    </span>
  )
}

export function roleBadge(role: string) {
  if (role === 'super_admin') return <Badge tone="brand">Super Admin</Badge>
  if (role === 'admin') return <Badge tone="info">Admin</Badge>
  if (role === 'compliance') return <Badge tone="danger">Compliance</Badge>
  return <Badge tone="warning">End User</Badge>
}

/** Colored chip for a 1–5 severity score (danger ≥4, warning ≥3, else neutral). */
export function severityBadge(severity: number | null | undefined, prefix = 'Sev') {
  const s = Number(severity ?? 0)
  if (!s) return <Badge tone="neutral">—</Badge>
  const tone: Tone = s >= 4 ? 'danger' : s >= 3 ? 'warning' : s >= 2 ? 'neutral' : 'success'
  const label = Number.isInteger(s) ? s : s.toFixed(2)
  return <Badge tone={tone}>{prefix} {label}</Badge>
}
