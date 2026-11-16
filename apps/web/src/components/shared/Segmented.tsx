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
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(var(--shadow)/0.04)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
      {options.map(({ value: v, label, icon: Icon }) => {
        const active = v === value
        return (
          <button key={String(v)} type="button" role="radio" aria-checked={active} onClick={() => onChange(v)}
            className={`h-9 px-4 inline-flex items-center gap-1.5 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${
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
