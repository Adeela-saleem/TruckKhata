import type { ReactNode } from 'react';

/** The top of a record: its key reference large, then badges and a short line of context. */
export function RecordHeader({ title, badges, meta, aside }: { title: ReactNode; badges?: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">{title}{badges}</div>
        {meta && <p className="mt-2 text-[14px] text-content-muted">{meta}</p>}
      </div>
      {aside}
    </div>
  );
}
