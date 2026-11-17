import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const FIT_QUERY = '(min-width: 1024px) and (min-height: 620px)'

/** True when the page is laid out to fit one screen; matches the `fit:` Tailwind screen. */
export function useFitScreen() {
  const [fit, setFit] = useState(() => window.matchMedia(FIT_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(FIT_QUERY)
    const onChange = () => setFit(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return fit
}

/** Splits a list into pages of however many rows fit the measured area, so it never needs a scrollbar. */
export function usePages(total: number, rowHeight: number, reserved = 0) {
  const fit = useFitScreen()
  // A callback ref: the area may only mount once its data has arrived.
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)
  const [page, setPage] = useState(0)
  useLayoutEffect(() => {
    if (!area || !fit) return
    const measure = () => setHeight(area.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    return () => ro.disconnect()
  }, [area, fit])
  const size = fit && height ? Math.max(1, Math.floor((height - reserved) / rowHeight)) : total
  const pages = Math.max(1, Math.ceil(total / Math.max(size, 1)))
  const current = Math.min(page, pages - 1)
  const start = current * size
  return { fit, area: setArea, size, start, end: Math.min(start + size, total), current, pages, setPage }
}

export function Pager({ start, end, total, current, pages, onPage }: { start: number; end: number; total: number; current: number; pages: number; onPage: (page: number) => void }) {
  const btn = 'grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-content transition-colors enabled:hover:bg-surface-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
  return (
    <span dir="ltr" className="inline-flex items-center gap-2">
      <span className="text-[14px] tabular-nums text-content-muted">{total ? `${start + 1}–${end} of ${total.toLocaleString()}` : '0'}</span>
      {pages > 1 && (
        <>
          <button type="button" className={btn} aria-label="Previous page" disabled={current === 0} onClick={() => onPage(current - 1)}><ChevronLeft size={16} /></button>
          <button type="button" className={btn} aria-label="Next page" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}><ChevronRight size={16} /></button>
        </>
      )}
    </span>
  )
}

export function CardTitle({ name, scope, note, ruled = true }: { name: string; scope?: string; note?: ReactNode; /** A hairline parting the title from the card's content. */ ruled?: boolean }) {
  return (
    <div className={`shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${ruled ? 'border-b border-line pb-3' : ''}`}>
      <p className="card-title font-display text-[16px] text-content">
        {name}{scope && <span className="font-medium text-content-subtle"> {scope}</span>}
      </p>
      {note && <span className="text-[14px] text-content-muted tabular-nums">{note}</span>}
    </div>
  )
}
