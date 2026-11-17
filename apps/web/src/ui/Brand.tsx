import { useData } from '../app/context';
import { getSetting } from '../core/repo/settings';

/** The truck mark: one glyph in the brand green, no gradient. */
export function Mark({ size = 36 }: { size?: number }) {
  return <img src="/favicon.svg" width={size} height={size} alt="" className="rounded-[10px] shrink-0" />;
}

/** Product name plus the company it belongs to, read from Settings. */
export function Wordmark() {
  const { data: company } = useData((db) => getSetting(db, 'company_name'));
  return (
    <span className="flex items-center gap-3 min-w-0">
      <Mark />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="font-display text-[16px] font-semibold text-content">Truck Khata</span>
        {company && <span className="text-[12px] text-content-subtle truncate">{company}</span>}
      </span>
    </span>
  );
}
