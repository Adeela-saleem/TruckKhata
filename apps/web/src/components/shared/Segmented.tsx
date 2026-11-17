import type { ComponentType } from 'react'

/** Pills for picking one of a few options; the chosen one is a solid ink pill. */
export function Segmented<T extends string | number>({
  value, options, onChange, ariaLabel,
}: {
  value: T
  options: { value: T; label: string; icon?: ComponentType<any> }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex max-w-full overflow-x-auto no-scrollbar gap-1 rounded-[10px] bg-surface p-1 shadow-[0_0_0_1px_rgb(var(--shadow)/0.07),0_2px_6px_-2px_rgb(var(--shadow)/0.1)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
      {options.map(({ value: v, label, icon: Icon }) => {
        const active = v === value
        return (
          <button key={String(v)} type="button" role="radio" aria-checked={active} onClick={() => onChange(v)}
            className={`h-8 px-3.5 shrink-0 inline-flex items-center gap-1.5 rounded-[6px] text-[13px] font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-ink text-on-ink' : 'text-content-muted hover:text-content hover:bg-surface-2'
            }`}>
            {Icon && <Icon size={15} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
