import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { CycleStatus, Direction, InsuranceStatus } from '../../core/domain/calc';
import { sum } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import type { ReportColumn, ReportResult, ReportRow } from '../../core/repo/reports';
import { useApp } from '../../app/context';
import { cn } from '../../components/ui/cn';
import { Skeleton } from '../../components/shared/Skeleton';
import { CaseChip, DirectionBadge, InsuranceBadge, Money, StatusBadge } from '../../ui/bits';

/** Reports whose money columns add up to something meaningful in a totals row. */
const summed = new Set(['vehicle', 'cycles', 'confirmed', 'provisional', 'ada', 'bills']);

function Cell({ col, row, highlight }: { col: ReportColumn; row: ReportRow; highlight?: string }) {
  const { t } = useApp();
  const value = row[col.key];
  if (col.key === 'caseNo') {
    const text = value === null || value === undefined ? null : String(value);
    return <CaseChip caseNo={text} highlight={!!highlight && !!text && text.toUpperCase().includes(highlight.toUpperCase())} />;
  }
  if (col.type === 'money') {
    const n = Number(value ?? 0);
    const tone = col.key === 'profit' ? 'auto' : col.key === 'balance' ? (n > 0 ? 'bad' : 'muted') : col.key === 'received' || col.key === 'paid' ? 'good' : undefined;
    return <Money value={n} tone={tone} className={col.key === 'profit' || col.key === 'balance' ? 'font-semibold' : undefined} />;
  }
  if (col.type === 'date') return <span className="tabular-nums text-content-muted">{formatDate(value as string) || '–'}</span>;
  if (col.type === 'status') {
    const key = String(value ?? '');
    if (key.startsWith('status.')) return <StatusBadge status={key.slice(7) as CycleStatus} />;
    if (key.startsWith('insurance.')) return <InsuranceBadge status={key.slice(10) as InsuranceStatus} />;
    if (key.startsWith('direction.')) return <DirectionBadge direction={key.slice(10) as Direction} />;
    return <span className="text-content-muted">{t(key)}</span>;
  }
  if (value === null || value === undefined || value === '') return <span className="text-content-subtle">–</span>;
  if (col.key === 'vehicle') return <span dir="ltr" className="font-mono text-[14px]">{String(value)}</span>;
  const long = col.key === 'items' || col.key === 'note' || col.key === 'route' || col.key === 'party' || col.key === 'broker';
  return <span dir="auto" className={cn(long && 'block max-w-[240px] truncate')} title={long ? String(value) : undefined}>{String(value)}</span>;
}

/**
 * A report as a table. Reports have many columns, so the table scrolls inside its card
 * (both ways on a desktop, sideways on a phone) and the page itself never does.
 */
export function ReportTable({ title, note, report, highlight, empty, actions }: {
  title: string; note?: ReactNode; report: ReportResult | undefined; highlight?: string;
  empty: { title: string; hint?: string }; actions?: ReactNode;
}) {
  const { t } = useApp();
  const rows = report?.rows ?? [];
  const align = (c: ReportColumn) => (c.type === 'money' ? 'text-end' : 'text-start');
  const footer = report && summed.has(report.kind) && rows.length > 0;
  const firstMoney = report?.columns.findIndex((c) => c.type === 'money') ?? -1;

  return (
    <section className="card flex flex-col h-full min-h-[360px] fit:min-h-0 overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 py-4 card-head">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="card-title font-display text-[16px] text-content">{title}</h2>
          {note && <span className="text-[13px] text-content-subtle tabular-nums">{note}</span>}
        </div>
        {actions}
      </div>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin">
        {!report ? (
          <div className="p-6 flex flex-col gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-surface-2 border border-line text-content-subtle"><Inbox size={22} /></span>
            <div>
              <p className="text-[14px] font-medium text-content">{empty.title}</p>
              {empty.hint && <p className="text-[13px] text-content-subtle mt-1 max-w-sm">{empty.hint}</p>}
            </div>
          </div>
        ) : (
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-[1]">
              <tr className="noir-thead">
                {report.columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('h-[48px] px-4 first:ps-6 last:pe-6 bg-surface text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line', align(c))}>
                    {t(c.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="noir-row h-[52px]">
                  {report.columns.map((c) => (
                    <td key={c.key} className={cn('px-4 first:ps-6 last:pe-6 text-[14px] text-content whitespace-nowrap border-b border-line', align(c))}>
                      <Cell col={c} row={row} highlight={highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot className="sticky bottom-0 z-[1]">
                <tr className="h-[52px]">
                  {report.columns.map((c, i) => (
                    <td key={c.key} className={cn('px-4 first:ps-6 last:pe-6 bg-surface-2 text-[14px] font-semibold text-content whitespace-nowrap border-t border-line-strong', align(c))}>
                      {c.type === 'money'
                        ? <Money value={sum(rows.map((r) => Number(r[c.key] ?? 0)))} tone={c.key === 'profit' ? 'auto' : undefined} />
                        : i === 0 && firstMoney !== 0 ? t('web.list.total') : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </section>
  );
}
