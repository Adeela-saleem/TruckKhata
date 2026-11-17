import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../components/ui/cn';

const control =
  'noir-input w-full h-11 px-3.5 rounded-[10px] text-[14px] text-content placeholder:text-content-subtle focus:outline-none disabled:opacity-60';

function Shell({ label, required, hint, error, id, children, className }: {
  label: string; required?: boolean; hint?: ReactNode; error?: string; id: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-content-muted">
        {label}{required && <span className="text-rose-500 ms-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
        : hint ? <p className="text-[12px] text-content-subtle">{hint}</p> : null}
    </div>
  );
}

type Base = { label: string; value: string; onChange: (value: string) => void; required?: boolean; hint?: ReactNode; className?: string; disabled?: boolean };

export function Field({ label, value, onChange, required, hint, className, caps, placeholder, type = 'text', inputMode, list, disabled, autoFocus }: Base & {
  /** Case # and V# are written in capitals. */
  caps?: boolean; placeholder?: string; type?: string; inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']; list?: string; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Shell label={label} required={required} hint={hint} id={id} className={className}>
      <input id={id} type={type} value={value} placeholder={placeholder} inputMode={inputMode} list={list} disabled={disabled} autoFocus={autoFocus}
        onChange={(e) => onChange(caps ? e.target.value.toUpperCase() : e.target.value)}
        className={cn(control, caps && 'font-mono tracking-wide')} autoComplete="off" />
    </Shell>
  );
}

/** Rupees typed as plain numbers; the Rs mark sits inside the box. */
export function MoneyField({ label, value, onChange, required, hint, className, disabled }: Base) {
  const id = useId();
  return (
    <Shell label={label} required={required} hint={hint} id={id} className={className}>
      <div className="relative">
        <span className="absolute start-4 top-1/2 -translate-y-1/2 text-[14px] text-content-subtle pointer-events-none">Rs</span>
        <input id={id} value={value} inputMode="decimal" disabled={disabled} onChange={(e) => onChange(e.target.value)}
          className={cn(control, 'ps-11 tabular-nums')} autoComplete="off" placeholder="0" />
      </div>
    </Shell>
  );
}

export function DateField({ label, value, onChange, required, hint, className }: Base) {
  const id = useId();
  return (
    <Shell label={label} required={required} hint={hint} id={id} className={className}>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cn(control, 'tabular-nums')} />
    </Shell>
  );
}

export function TextArea({ label, value, onChange, hint, className }: Base) {
  const id = useId();
  return (
    <Shell label={label} hint={hint} id={id} className={className}>
      <textarea id={id} value={value} rows={3} onChange={(e) => onChange(e.target.value)}
        className={cn(control, 'h-auto py-2.5 resize-y min-h-[88px]')} />
    </Shell>
  );
}

/** A text box that offers names already used, such as brokers and shops. */
export function SuggestField(props: Base & { suggestions: string[] }) {
  const listId = useId();
  return (
    <>
      <Field {...props} list={listId} />
      <datalist id={listId}>{props.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    </>
  );
}

/** One of a few options, as a row of pills. */
export function Choice<V extends string>({ label, value, onChange, options, className }: {
  label: string; value: V; onChange: (value: V) => void; options: { value: V; label: string }[]; className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[13px] font-medium text-content-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-[10px] bg-surface-2 p-1 self-start">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
            className={cn('h-9 px-4 rounded-[8px] text-[14px] font-medium transition-colors',
              o.value === value ? 'bg-ink text-on-ink' : 'text-content-muted hover:text-content')}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A worked-out value: looks like a field, but is not typed in. */
export function AutoValue({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-content-muted">{label}</span>
      <div className={cn('dotted-panel h-11 px-3.5 rounded-xl flex items-center justify-between text-[14px] font-semibold tabular-nums',
        tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : 'text-content')}>
        {value}
      </div>
    </div>
  );
}

/** A titled group of fields in a card, laid out in two columns on a wide screen. */
export function FormSection({ title, note, children, columns = 2 }: { title: string; note?: ReactNode; children: ReactNode; columns?: 1 | 2 | 3 }) {
  const cols = columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : '';
  return (
    <section className="card">
      <div className="card-head flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6 sm:px-7 py-4">
        <h2 className="card-title font-display text-[16px] text-content">{title}</h2>
        {note && <span className="text-[13px] text-content-subtle">{note}</span>}
      </div>
      <div className={cn('grid grid-cols-1 gap-x-5 gap-y-4 px-6 sm:px-7 pt-5 pb-6', cols)}>{children}</div>
    </section>
  );
}
