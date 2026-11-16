import { addDays, monthRange, today, weekRange, type DateRange } from '../core/domain/dates';
import { Segmented } from '../components/shared/Segmented';
import { useApp } from '../app/context';

export type RangeChoice = 'all' | 'week' | 'month' | 'custom';

export function rangeFor(choice: RangeChoice, custom: DateRange): DateRange {
  if (choice === 'week') return weekRange(today());
  if (choice === 'month') return monthRange(today());
  if (choice === 'custom') return custom;
  return { from: null, to: null };
}

const dateBox = 'noir-input h-8 px-2.5 rounded-lg text-[13px] text-content tabular-nums focus:outline-none';

/** Dates for a list: all, this week, this month, or two chosen days. */
export function RangeFilter({ choice, onChoice, custom, onCustom }: {
  choice: RangeChoice; onChoice: (c: RangeChoice) => void; custom: DateRange; onCustom: (r: DateRange) => void;
}) {
  const { t } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented ariaLabel={t('range.label')} value={choice} onChange={(c) => {
        if (c === 'custom' && !custom.from && !custom.to) onCustom({ from: addDays(today(), -30), to: today() });
        onChoice(c);
      }} options={(['all', 'week', 'month', 'custom'] as const).map((value) => ({ value, label: t(`range.${value}`) }))} />
      {choice === 'custom' && (
        <span className="inline-flex items-center gap-1.5">
          <input type="date" aria-label={t('range.from')} className={dateBox} value={custom.from ?? ''} onChange={(e) => onCustom({ ...custom, from: e.target.value || null })} />
          <span className="text-content-subtle">–</span>
          <input type="date" aria-label={t('range.to')} className={dateBox} value={custom.to ?? ''} onChange={(e) => onCustom({ ...custom, to: e.target.value || null })} />
        </span>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className = 'w-60' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      className={`noir-search h-8 px-3.5 rounded-full text-[13px] text-content placeholder:text-content-subtle focus:outline-none ${className}`} />
  );
}
