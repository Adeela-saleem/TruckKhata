import type { ReactNode } from 'react';

/** Under the page title: the record's badges and a short line of context. The page title already names the record. */
export function RecordHeader({ title, badges, meta, aside }: { title?: ReactNode; badges?: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 -mt-2 mb-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">{title}{badges}</div>
        {meta && <p className="mt-1.5 text-[14px] text-content-muted">{meta}</p>}
      </div>
      {aside}
    </div>
  );
}
