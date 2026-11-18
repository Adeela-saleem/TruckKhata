import { useData } from '../app/context';
import { getSetting } from '../core/repo/settings';

/**
 * The Truck Khata mark: two ledger rows leaning forward, the second ending in a stop.
 * A page of the khata and a load on its way, in one shape. Lime on ink, everywhere.
 */
export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Truck Khata" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#111214" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" />
      <g fill="#C1F11D" stroke="#C1F11D" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M11 9.25h13.5l-3 5.25H8z" />
        <path d="M11 17.5h7l-3 5.25H8z" />
      </g>
      <circle cx="22.75" cy="20.1" r="2.9" fill="#C1F11D" />
    </svg>
  );
}

/** Product name plus the company it belongs to, read from Settings. */
export function Wordmark() {
  const { data: company } = useData((db) => getSetting(db, 'company_name'));
  return (
    <span className="flex items-center gap-3 min-w-0">
      <Mark />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-content">Truck Khata</span>
        {company && <span className="text-[12px] text-content-subtle truncate">{company}</span>}
      </span>
    </span>
  );
}
