import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Inbox } from 'lucide-react';
import { Pager, usePages } from '../components/shared/FitScreen';
import { cn } from '../components/ui/cn';
import { Skeleton } from '../components/shared/Skeleton';

export type Column<R> = {
  key: string;
  label: string;
  render: (row: R) => ReactNode;
  align?: 'start' | 'end';
  /** Hidden on narrow screens, so a list never scrolls sideways on a phone. */
  wide?: boolean;
  className?: string;
};

/** Row height plus its hairline; paging divides the card by this. */
const ROW = 57;
const PHONE_PAGE = 25;

/**
 * A list as a table that fills its card. On a desktop it pages to the rows that fit,
 * so the page never scrolls; on a phone it shows 25 at a time.
 */
export function ListTable<R>({ title, note, actions, columns, rows, rowKey, onOpen, empty, footer, loading }: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  columns: Column<R>[];
  rows: R[] | undefined;
  rowKey: (row: R) => string;
  onOpen?: (row: R) => void;
  empty: { title: string; hint?: string };
  /** Totals row, kept below the paged rows. */
  footer?: ReactNode[];
  loading?: boolean;
}) {
  const list = rows ?? [];
  const { fit, area, start, end, current, pages, setPage } = usePages(list.length, ROW, footer ? ROW * 2 : ROW);
  const [phonePage, setPhonePage] = useState(0);
  useEffect(() => { setPage(0); setPhonePage(0); }, [list.length, setPage]);
  const phonePages = Math.max(1, Math.ceil(list.length / PHONE_PAGE));
  const from = fit ? start : phonePage * PHONE_PAGE;
  const to = fit ? end : Math.min(from + PHONE_PAGE, list.length);
  const shown = list.slice(from, to);
  const align = (c: Column<R>) => (c.align === 'end' ? 'text-end' : 'text-start');
  const hide = (c: Column<R>) => (c.wide ? 'hidden lg:table-cell' : '');

  return (
    <section className="card flex flex-col h-full min-h-[420px] fit:min-h-0">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 sm:px-7 pt-5 pb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="card-title font-display text-[18px] text-content">{title}</h2>
          {note && <span className="text-[13px] text-content-subtle tabular-nums">{note}</span>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {list.length > 0 && (
            <Pager start={from} end={to} total={list.length} current={fit ? current : phonePage} pages={fit ? pages : phonePages}
              onPage={fit ? setPage : setPhonePage} />
          )}
        </div>
      </div>
      <div ref={area} className="flex-1 min-h-0 overflow-x-auto scroll-thin fit:overflow-hidden">
        {loading && !rows ? (
          <div className="p-6 flex flex-col gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : list.length === 0 ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <span className="grid place-items-center w-12 h-12 rounded-2xl bg-surface-2 border border-line text-content-subtle"><Inbox size={22} /></span>
            <div>
              <p className="text-[15px] font-medium text-content">{empty.title}</p>
              {empty.hint && <p className="text-[13px] text-content-subtle mt-1 max-w-sm">{empty.hint}</p>}
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="noir-thead">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('h-[56px] px-4 first:ps-6 sm:first:ps-7 last:pe-6 sm:last:pe-7 text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line', align(c), hide(c))}>
                    {c.label}
                  </th>
                ))}
                {onOpen && <th aria-hidden className="w-10 border-b border-line" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={rowKey(row)} onClick={onOpen ? () => onOpen(row) : undefined}
                  onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(row); } : undefined}
                  tabIndex={onOpen ? 0 : undefined}
                  className={cn('noir-row h-[56px] border-b border-line last:border-b-0', onOpen && 'is-link cursor-pointer')}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 first:ps-6 sm:first:ps-7 last:pe-6 sm:last:pe-7 text-[14.5px] text-content whitespace-nowrap', align(c), hide(c), c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                  {onOpen && <td aria-hidden className="pe-4 text-content-subtle"><span className="row-go inline-flex"><ChevronRight size={17} /></span></td>}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                <tr className="h-[56px] bg-surface-2 border-t border-line">
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('px-4 first:ps-6 sm:first:ps-7 last:pe-6 sm:last:pe-7 text-[14.5px] font-semibold text-content whitespace-nowrap', align(c), hide(c))}>{footer[i]}</td>
                  ))}
                  {onOpen && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </section>
  );
}
