import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Star, type LucideIcon } from 'lucide-react'
import { CardTitle } from './FitScreen'
import { formatCompact, sharePct } from '../../utils/format'

// ── Motion helpers ───────────────────────────────────────────────────────────

/** A round step for a chart axis, so ticks land on numbers people read easily. */
export function niceStep(value: number, slots: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  return [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 2.5, 3].map(n => n * magnitude).find(n => n * slots >= value) ?? magnitude
}

/** Rolls a number to its new value, so a scrub reads as the same figure changing. */
export function useRolling(target: number, duration: number) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      setValue(target)
      return
    }
    const start = from.current
    const began = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min((now - began) / duration, 1)
      const next = Math.round(start + (target - start) * (1 - (1 - t) ** 3))
      from.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

// ── KPI strip ────────────────────────────────────────────────────────────────

export function Change({ current, previous, goodWhen = 'up' }: { current: number; previous?: number | null; goodWhen?: 'up' | 'down' }) {
  if (!previous) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) >= 1000) return null
  const rounded = Math.round(pct)
  const Icon = pct > 0 ? ArrowUp : ArrowDown
  const color = rounded === 0 ? 'rgb(var(--text-3))' : (pct > 0) === (goodWhen === 'up') ? 'var(--accent-green)' : 'var(--accent-red)'
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-[14px] lg:text-[15px] font-semibold tabular-nums" style={{ color }} title="Change vs the previous period">
      {rounded !== 0 && <Icon size={15} strokeWidth={2.5} />}{Math.abs(rounded)}%
    </span>
  )
}

export interface Kpi {
  label: string
  icon: LucideIcon
  tone: string
  ink?: string
  value: number
  /** Shown instead of the compact value, for a share, a rating or a date. */
  display?: string
  /** Last week's figure, when the current week has data to compare. */
  previous?: number | null
  note: string
  alarm?: boolean
  goodWhen?: 'up' | 'down'
  onClick?: () => void
}

/** The tab's figures in one card, split by thin lines, as on the Overview. A figure with a list behind it opens that list. */
/** A row of key figures in one card: a pastel icon tile, the label, the figure and a plain note. */
export function KpiStrip({ kpis, columns }: { kpis: Kpi[]; columns: 4 | 6 | 8 }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className={`grid grid-cols-2 gap-x-5 gap-y-6 lg:gap-x-0 lg:gap-y-0 lg:divide-x lg:divide-line rtl:lg:divide-x-reverse ${columns === 8 ? 'lg:grid-cols-8' : columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-6'}`}>
        {kpis.map(({ label, icon: Icon, tone, value, display, previous, note, alarm, goodWhen, onClick }) => {
          const body = (
            <>
              <span className="flex items-center gap-2.5">
                <span className="kpi-icon w-9 h-9 rounded-full grid place-items-center" style={{ backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
                  <Icon size={18} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 text-[14.5px] leading-tight text-content-muted">{label}</span>
              </span>
              <span className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <span dir="ltr" className={`font-display text-[22px] sm:text-[28px] lg:text-[32px] leading-none font-medium tracking-[-0.03em] tabular-nums ${alarm ? 'text-bad' : 'text-content'}`} title={display ?? value.toLocaleString()}>
                  {display ?? formatCompact(value)}
                </span>
                <Change current={value} previous={previous} goodWhen={goodWhen} />
              </span>
              <span className="mt-2 block text-[13.5px] leading-snug tabular-nums text-content-subtle">{note}</span>
            </>
          )
          const cls = 'block min-w-0 w-full text-start lg:px-6 lg:first:ps-1 lg:last:pe-1'
          return onClick ? (
            <button key={label} type="button" onClick={onClick} title={label}
              className={`${cls} rounded-2xl transition-colors hover:bg-content/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}>
              {body}
            </button>
          ) : (
            <div key={label} className={cls}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}

// ── Treemap ──────────────────────────────────────────────────────────────────


export interface TreeItem { id: string; label: string; value: number; severity: number; critical: number }

/** Average severity decides a tile's colour; its area is its post count. */
const HEAT = [
  { from: 3.5, label: 'Severe, 3.5+', fill: 'var(--c-panic, #f43f5e)', ink: '#ffffff' },
  { from: 2.75, label: 'High, 2.75+', fill: 'var(--c-negative, #f97316)', ink: '#1a1a1a' },
  { from: 2, label: 'Medium, 2+', fill: 'var(--accent-yellow, #f5b800)', ink: '#1a1a1a' },
  { from: 0, label: 'Low, under 2', fill: 'var(--accent-slate, #64748b)', ink: '#ffffff' },
]
const heatOf = (severity: number) => HEAT.find(h => severity >= h.from) ?? HEAT[HEAT.length - 1]

type Rect = { x: number; y: number; w: number; h: number }

const MIN_TILE_AREA = 12000

/** Squarified layout: rows of tiles kept as close to square as the data allows. */
function squarify<T extends { value: number }>(items: T[], box: Rect): (T & Rect)[] {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1
  const scale = (box.w * box.h) / total
  const out: (T & Rect)[] = []
  let { x, y, w, h } = box
  let rest = [...items]
  const worst = (row: T[], side: number) => {
    const area = row.reduce((sum, i) => sum + i.value * scale, 0)
    return Math.max(...row.map(i => {
      const a = i.value * scale
      return Math.max((side * side * a) / (area * area), (area * area) / (side * side * a))
    }))
  }
  while (rest.length) {
    const side = Math.min(w, h)
    const row: T[] = [rest[0]]
    let i = 1
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row.push(rest[i++])
    const area = row.reduce((sum, r) => sum + r.value * scale, 0)
    const thick = area / side
    let offset = 0
    for (const r of row) {
      const len = (r.value * scale) / thick
      out.push(w >= h ? { ...r, x, y: y + offset, w: thick, h: len } : { ...r, x: x + offset, y, w: len, h: thick })
      offset += len
    }
    if (w >= h) { x += thick; w -= thick } else { y += thick; h -= thick }
    rest = rest.slice(row.length)
  }
  return out
}

/** Where the pressure is: size is how much is said, colour is how bad it is. A tile opens its posts. */
export function CategoryTreemap({ items, restCount, restValue, onSelect, onRest, scope, minHeight = 'min-h-[420px] fit:min-h-0', unit = 'posts', caption }: {
  items: TreeItem[]
  restCount: number
  restValue: number
  onSelect: (id: string) => void
  onRest?: () => void
  scope?: string
  minHeight?: string
  unit?: string
  caption?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tiles = useMemo(() => {
    if (!size.w || !size.h) return []
    // A tile too small to carry its name folds into the rest, so every tile that shows is labelled.
    const grand = items.reduce((sum, i) => sum + i.value, restValue) || 1
    const minValue = (MIN_TILE_AREA / (size.w * size.h)) * grand
    const sorted = [...items].sort((a, b) => b.value - a.value)
    const keep = Math.max(1, sorted.filter(i => i.value >= minValue).length)
    const folded = sorted.slice(keep)
    const count = restCount + folded.length
    const value = restValue + folded.reduce((sum, i) => sum + i.value, 0)
    const all = [...sorted.slice(0, keep), ...(value > 0 ? [{ id: '__rest', label: `${count} smaller categories`, value, severity: 0, critical: 0 }] : [])]
    return squarify(all.sort((a, b) => b.value - a.value), { x: 0, y: 0, w: size.w, h: size.h })
  }, [items, restCount, restValue, size])

  return (
    <div className="card h-full flex flex-col p-6">
      <CardTitle name="Where the Pressure Is" scope={scope}
        note={<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {HEAT.map(h => (
            <span key={h.label} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: h.fill }} />{h.label}</span>
          ))}
        </span>} />
      <p className="mt-1 text-[14px] text-content-muted">{caption ?? `Size is the number of ${unit}. Colour is the average severity.`}</p>
      <div ref={box} className={`relative mt-3 flex-1 ${minHeight}`}>
        {tiles.map(t => {
          const rest = t.id === '__rest'
          const heat = heatOf(t.severity)
          const roomy = t.w > 96 && t.h > 64
          const clickable = rest ? !!onRest : true
          return (
            <button key={t.id} type="button" disabled={!clickable} onClick={() => (rest ? onRest?.() : onSelect(t.id))}
              title={rest ? t.label : `${t.label}: ${t.value.toLocaleString()} ${unit}, average severity ${t.severity.toFixed(1)}${t.critical ? `, ${t.critical.toLocaleString()} critical` : ''}`}
              style={{ left: t.x, top: t.y, width: Math.max(t.w - 3, 1), height: Math.max(t.h - 3, 1), background: rest ? 'rgb(var(--surface-2))' : heat.fill, color: rest ? 'rgb(var(--text-2))' : heat.ink }}
              className="absolute flex flex-col justify-start overflow-hidden rounded-[10px] p-3 text-left transition-opacity duration-150 enabled:hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1">
              {roomy && (
                <>
                  <span className="block text-[14px] xl:text-[15px] font-semibold leading-tight break-words">{t.label}</span>
                  <span className="mt-1 block font-display text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{formatCompact(t.value)}</span>
                  {!rest && t.h > 112 && t.w > 132 && <span className="mt-1.5 block text-[13px] leading-tight opacity-85 tabular-nums">Avg severity {t.severity.toFixed(1)}</span>}
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Mix: one share bar, one ranked list ──────────────────────────────────────

// ── Shares and rankings ──────────────────────────────────────────────────────

export function ShareBar({ parts, unit = 'posts' }: { parts: { name: string; value: number; color: string }[]; unit?: string }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  return (
    <div>
      <div className="flex h-4 w-full gap-[3px]" role="img" aria-label={parts.map(p => `${p.name} ${sharePct(p.value, total)}`).join(', ')}>
        {parts.filter(p => p.value > 0).map(p => (
          <span key={p.name} className="h-full rounded-[4px] first:rounded-l-lg last:rounded-r-lg" style={{ flexGrow: p.value, flexBasis: 0, minWidth: 6, background: p.color }} title={`${p.name}: ${p.value.toLocaleString()}`} />
        ))}
      </div>
      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
        {parts.map(p => (
          <div key={p.name} className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] text-content-muted"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />{p.name}</p>
            <p className="mt-1 font-display text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums text-content">{sharePct(p.value, total)}</p>
            <p className="mt-1 text-[13.5px] tabular-nums text-content-muted">{p.value.toLocaleString()} {p.value === 1 ? unit.replace(/s$/, '') : unit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface RankRow { id: string; label: string; sub?: string; value: number; onClick?: () => void; href?: string }

/** A ranked list with thin bars, in one colour. */
export function RankedBars({ rows, tone = 'var(--accent-green, #10b981)', unit, empty = 'No data yet', compact = false }: { rows: RankRow[]; tone?: string; unit?: string; empty?: string; /** Tighter rows, for a short card. */ compact?: boolean }) {
  const top = Math.max(...rows.map(r => r.value), 1)
  if (!rows.length) return empty ? <div className="h-40 flex items-center justify-center text-content-subtle text-sm">{empty}</div> : null
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-0.5 fit:h-full fit:[grid-auto-rows:minmax(0,1fr)]">
      {rows.map(r => {
        const body = (
          <>
            <span className="flex w-full items-baseline gap-3">
              <span className={`min-w-0 flex-1 truncate text-[14px] xl:text-[15px] text-content ${compact ? 'leading-tight' : 'leading-snug'}`}>
                {r.label}{r.sub && <span className="text-content-subtle"> {r.sub}</span>}
              </span>
              <span className="text-[14px] xl:text-[15px] font-semibold tabular-nums text-content" title={unit ? `${r.value.toLocaleString()} ${unit}` : r.value.toLocaleString()}>{formatCompact(r.value)}</span>
            </span>
            <span className={`${compact ? 'mt-1' : 'mt-1.5'} block h-1 w-full shrink-0 rounded-full bg-content/[0.07] overflow-hidden`}>
              <span className="block h-full rounded-full" style={{ width: `${Math.max((r.value / top) * 100, 2)}%`, background: tone }} />
            </span>
          </>
        )
        const cls = `-mx-2 flex w-[calc(100%+1rem)] flex-col justify-center rounded-lg px-2 text-left ${compact ? '' : 'py-1'}`
        if (r.onClick) return <button key={r.id} type="button" onClick={r.onClick} className={`${cls} transition-colors hover:bg-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40`}>{body}</button>
        if (r.href) return <a key={r.id} href={r.href} target="_blank" rel="noreferrer" className={`${cls} transition-colors hover:bg-content/[0.04]`}>{body}</a>
        return <div key={r.id} className={cls}>{body}</div>
      })}
    </div>
  )
}

// ── Small marks ──────────────────────────────────────────────────────────────

/** Five stars filled up to a rating, partly for a fraction. */
export function Stars({ rating, size = 14, empty = 'rgb(var(--text-1) / 0.16)', fill = 'var(--accent-yellow, #f5b800)' }: { rating: number; size?: number; empty?: string; fill?: string }) {
  return (
    <span className="relative inline-flex shrink-0" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`} style={{ height: size }}>
      <span className="flex gap-0.5" style={{ color: empty }}>
        {[0, 1, 2, 3, 4].map(i => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
      </span>
      <span className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden" style={{ color: fill, width: `${(Math.min(Math.max(rating, 0), 5) / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map(i => <Star key={i} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
      </span>
    </span>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-[13px]">
      {items.map(i => <span key={i.label} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: i.color }} />{i.label}</span>)}
    </span>
  )
}

/** Recharts tooltip: <Tooltip content={<ChartTip names={{ total: 'Orders' }} />} /> */
export function ChartTip({ active, payload, label, names, format }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string; names: Record<string, string>; format?: Record<string, (v: number) => string> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2.5 shadow-lg min-w-[150px]">
      <p className="text-[12px] text-content-subtle mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-content-muted"><span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{names[p.dataKey] ?? p.dataKey}</span>
          <span className="font-semibold tabular-nums text-content">{format?.[p.dataKey] ? format[p.dataKey](p.value) : p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}
