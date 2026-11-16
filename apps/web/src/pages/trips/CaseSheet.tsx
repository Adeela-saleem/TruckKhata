import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, FileSpreadsheet, LockOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Direction } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { formatPKR } from '../../core/domain/money';
import { caseSheetCsv } from '../../core/print/csv';
import { caseDocument } from '../../core/print/documents';
import type { AdaView } from '../../core/repo/ada';
import { getCaseView, markCaseComplete, ratePerUnit, reopenCase, sheetHeader, sheetTotals, type Expense, type Leg } from '../../core/repo/cases';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction } from '../../app/hooks';
import { EmptyState } from '../../components/shared/states';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../components/ui/cn';
import { downloadText } from '../../platform/files';
import { Btn, CaseChip, DirectionBadge, Money, Note, SectionCard, StatusBadge } from '../../ui/bits';
import { Page } from '../../ui/Page';
import { HistoryCard, PrintButton, useDelete } from '../../ui/record';
import { RecordHeader } from '../../ui/RecordHeader';
import { ExpenseModal } from './ExpenseModal';

const th = 'h-11 px-4 first:ps-6 last:pe-6 text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line';
const td = 'px-4 first:ps-6 last:pe-6 text-[14.5px] text-content whitespace-nowrap';

export default function CaseSheet() {
  const { caseId = '' } = useParams();
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const remove = useDelete();
  const [expense, setExpense] = useState<Expense | null | 'new'>(null);
  const { data, loading } = useData(async (d) => ({ view: await getCaseView(d, caseId) }), [caseId]);
  const v = data?.view;

  if (!loading && !v) return <Page title={t('trip.sheet')}><div className="card"><EmptyState title={t('web.notFound')} /></div></Page>;
  if (!v) return <Page title={t('trip.sheet')}>{null}</Page>;

  const s = v.summary;
  const caseNo = v.caseRow.case_no;
  const h = sheetHeader(v);
  const st = sheetTotals(v);
  const counted = v.bills.filter((b) => b.count_in_profit);
  const notCounted = v.bills.filter((b) => !b.count_in_profit);
  const doc = () => caseDocument(v, t);

  const complete = () => run(async () => {
    if (!(await confirm(t('trip.completeTitle'), t('trip.completeMessage', { profit: formatPKR(s.profit) }), t('trip.markComplete')))) return;
    await markCaseComplete(db, caseId);
    toast.success(t('status.complete'));
  });
  const reopen = () => run(async () => {
    if (!(await confirm(t('trip.reopenTitle'), t('trip.reopenMessage'), t('trip.reopen')))) return;
    await reopenCase(db, caseId);
    toast.success(t('web.saved'));
  });
  const excel = () => downloadText(`trip-sheet-${caseNo}.csv`, caseSheetCsv(v, t), 'text/csv;charset=utf-8');

  return (
    <Page title={caseNo} subtitle={t('trip.sheet')}
      actions={<>
        <PrintButton build={doc} label={t('web.printPdf')} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={excel}>{t('web.trips.excel')}</Btn>
      </>}>
      <div className="max-w-[1800px]">
        <RecordHeader
          title={<CaseChip caseNo={caseNo} className="h-9 px-3 text-[20px]" />}
          badges={<StatusBadge status={s.status} />}
          meta={<>
            {h.vehicle && <span dir="ltr" className="font-mono text-content">{h.vehicle}</span>}
            {(h.from || h.to) && <>{h.vehicle && ' · '}{[h.from, h.to].filter(Boolean).join(' → ')}</>}
            {h.broker && <>{(h.vehicle || h.from || h.to) && ' · '}{h.broker}</>}
          </>}
          aside={s.confirmed
            ? <Btn icon={<LockOpen size={16} />} disabled={busy} onClick={reopen}>{t('trip.reopen')}</Btn>
            : s.status === 'ready' ? <Btn tone="primary" icon={<CheckCircle2 size={16} />} busy={busy} onClick={complete}>{t('trip.markComplete')}</Btn> : undefined} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
            {s.freightMismatch && (
              <Note tone="warn">{t('trip.mismatch', { trip: formatPKR(v.caseRow.cycle_freight), ada: formatPKR(v.ada.reduce((n, a) => n + a.freight_rate, 0)) })}</Note>
            )}
            {!s.confirmed && s.status !== 'ready' && <Note>{t('trip.needBoth')}</Note>}
            {s.status === 'ready' && <Note>{t('web.trips.completeHint')}</Note>}

            <SectionCard title={t('trip.adaFiles')} note={String(v.ada.length)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdaFiles direction="outward" entries={v.adaOutward} caseNo={caseNo} />
                <AdaFiles direction="return" entries={v.adaReturn} caseNo={caseNo} />
              </div>
            </SectionCard>

            <SectionCard title={t('trip.expenses')} note={String(v.expenses.length + counted.length)} padded={false}
              action={<Btn icon={<Plus size={16} />} onClick={() => setExpense('new')}>{t('trip.addExpense')}</Btn>}>
              {v.expenses.length === 0 && counted.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{t('trip.noExpenses')}</p>
                : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="noir-thead">
                          <th scope="col" className={cn(th, 'text-start')}>{t('fields.category')}</th>
                          <th scope="col" className={cn(th, 'text-start')}>{t('fields.station')}</th>
                          <th scope="col" className={cn(th, 'text-start')}>{t('fields.slipNo')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.litres')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.amount')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.rate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.expenses.map((e) => {
                          const rate = ratePerUnit(e.amount, e.quantity);
                          return (
                            <tr key={e.id} tabIndex={0} onClick={() => setExpense(e)} onKeyDown={(k) => { if (k.key === 'Enter') setExpense(e); }}
                              className="noir-row h-[52px] border-b border-line cursor-pointer">
                              <td className={cn(td, 'font-medium')}>
                                <span className="inline-flex items-baseline gap-2">
                                  <span>{e.category}</span>
                                  <span className="text-[12.5px] font-normal text-content-subtle tabular-nums">{formatDate(e.expense_date)}</span>
                                </span>
                              </td>
                              <td className={cn(td, 'text-content-muted')}><span className="block max-w-[200px] truncate">{e.vendor ?? '–'}</span></td>
                              <td className={cn(td, 'font-mono text-[13.5px] text-content-muted')} dir="ltr">{e.slip_no ?? '–'}</td>
                              <td className={cn(td, 'text-end tabular-nums text-content-muted')}>{e.quantity ?? '–'}</td>
                              <td className={cn(td, 'text-end')}><Money value={e.amount} className="font-medium" /></td>
                              <td className={cn(td, 'text-end')}>{rate === null ? <span className="text-content-subtle">–</span> : <Money value={rate} tone="muted" />}</td>
                            </tr>
                          );
                        })}
                        {counted.map((b) => (
                          <tr key={b.id} tabIndex={0} onClick={() => navigate(`/bills/${b.id}`)} onKeyDown={(k) => { if (k.key === 'Enter') navigate(`/bills/${b.id}`); }}
                            className="noir-row h-[52px] border-b border-line cursor-pointer">
                            <td className={cn(td, 'font-medium')}><span className="inline-flex items-center gap-2">{t('modules.bills')}<Badge tone="success">{t('trip.countedInProfit')}</Badge></span></td>
                            <td className={cn(td, 'text-content-muted')}><span className="block max-w-[200px] truncate">{b.vendor}</span></td>
                            <td className={td} /><td className={td} />
                            <td className={cn(td, 'text-end')}><Money value={b.total} className="font-medium" /></td>
                            <td className={td} />
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="h-[52px] bg-surface-2/70 border-t border-line-strong">
                          <td colSpan={4} className={cn(td, 'font-semibold')}>{t('web.trips.totalExpenses')}</td>
                          <td className={cn(td, 'text-end')}><Money value={st.expenses} className="font-semibold" /></td>
                          <td className={td} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
            </SectionCard>

            <SectionCard title={t('web.trips.legs')} note={String(v.legs.length)} padded={false}
              action={<div className="flex flex-wrap gap-2">
                {!v.outward && <Btn icon={<Plus size={16} />} onClick={() => navigate(`/trips/new?caseNo=${encodeURIComponent(caseNo)}&direction=outward`)}>{t('trip.addOutward')}</Btn>}
                {!v.returnLeg && <Btn icon={<Plus size={16} />} onClick={() => navigate(`/trips/new?caseNo=${encodeURIComponent(caseNo)}&direction=return`)}>{t('trip.addReturn')}</Btn>}
              </div>}>
              {v.legs.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{t('web.trips.noLegs')}</p>
                : (
                  <ul className="divide-y divide-line">
                    {v.legs.map((l) => <LegRow key={l.id} leg={l} onEdit={() => navigate(`/trips/leg/${l.id}/edit`)} onDelete={() => remove('trip_legs', l.id)} />)}
                  </ul>
                )}
            </SectionCard>

            {notCounted.length > 0 && (
              <SectionCard title={t('trip.linkedBills')} note={String(notCounted.length)} padded={false}>
                <ul className="divide-y divide-line">
                  {notCounted.map((b) => (
                    <li key={b.id}>
                      <Link to={`/bills/${b.id}`} className="noir-row flex items-center gap-4 px-6 h-[56px]">
                        <span className="flex-1 min-w-0 truncate text-[14.5px] font-medium text-content">{b.vendor}</span>
                        <Badge>{t('trip.notCounted')}</Badge>
                        <Money value={b.total} className="text-[14.5px]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {v.adjustments.length > 0 && (
              <SectionCard title={t('trip.manualEntries')} note={String(v.adjustments.length)} padded={false}>
                <ul className="divide-y divide-line">
                  {v.adjustments.map((j) => (
                    <li key={j.id}>
                      <Link to={`/parties/${j.party_id}`} className="noir-row flex items-center gap-4 px-6 h-[56px]">
                        <span className="flex-1 min-w-0 truncate text-[14.5px] text-content">{j.party_name} <span className="text-content-subtle">({t(`ledger.${j.kind}`)})</span></span>
                        <Money value={j.amount} className="text-[14.5px]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <HistoryCard recordIds={[caseId, ...v.legs.map((l) => l.id), ...v.expenses.map((e) => e.id)]} record={doc} />
          </div>

          <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-5">
            <SheetTotals st={st} confirmed={s.confirmed} hasAda={v.ada.length > 0} />
          </aside>
        </div>
      </div>
      <ExpenseModal caseId={caseId} expense={expense} onClose={() => setExpense(null)} />
    </Page>
  );
}

/** The bottom of the paper sheet: both directions together, then profit and what the broker still owes. */
function SheetTotals({ st, confirmed, hasAda }: { st: ReturnType<typeof sheetTotals>; confirmed: boolean; hasAda: boolean }) {
  const { t } = useApp();
  const line = (label: string, value: number, opts: { sign?: string; strong?: boolean } = {}) => (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', opts.strong && 'border-t border-white/25 mt-1 pt-2.5')}>
      <span className={cn('text-[14px]', opts.strong ? 'font-semibold text-white' : 'text-white/80')}>{label}</span>
      <span dir="ltr" className={cn('tabular-nums whitespace-nowrap text-white', opts.strong ? 'text-[16px] font-semibold' : 'text-[14.5px]')}>
        {opts.sign ? `${opts.sign} ` : ''}{formatPKR(value)}
      </span>
    </div>
  );
  return (
    <section className="noir-hero relative overflow-hidden rounded-[28px] p-6 text-white">
      <p className="font-display text-[17px] font-semibold tracking-tight">{t('trip.summary')}</p>
      <div className="mt-4">
        {line(t('trip.outwardFreight'), st.outwardFreight)}
        {line(t('trip.returnFreight'), st.returnFreight)}
        {line(t('trip.cycleFreight'), st.freight, { strong: true })}
        {line(t('web.trips.totalExpenses'), st.expenses, { sign: '-' })}
      </div>
      <div className="mt-4 rounded-2xl bg-white/[0.12] border border-white/15 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold">{t('trip.net')}</span>
          <span className="inline-flex items-center h-6 px-2 rounded-md bg-white/20 text-[12.5px] font-medium">
            {t(confirmed ? 'trip.confirmed' : 'trip.provisional')}
          </span>
        </div>
        <span dir="ltr" className={cn('mt-2 block font-display text-[38px] leading-none font-semibold tracking-[-0.03em] tabular-nums', st.profit < 0 && 'text-rose-100')}>
          {formatPKR(st.profit)}
        </span>
        {!confirmed && <p className="mt-2 text-[12.5px] text-white/75">{t('trip.notConfirmed')}</p>}
      </div>
      {hasAda && (
        <div className="mt-4">
          {line(t('trip.received'), st.received)}
          {line(t('trip.balance'), st.balance, { strong: true })}
        </div>
      )}
    </section>
  );
}

/** One side of the case in Ada Register: its entries with due, received and balance, or a way to add it. */
function AdaFiles({ direction, entries, caseNo }: { direction: Direction; entries: AdaView[]; caseNo: string }) {
  const { t } = useApp();
  const title = t(direction === 'outward' ? 'trip.market' : 'trip.returnLoad');
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14.5px] font-semibold text-content">{title}</span>
          <DirectionBadge direction={direction} />
        </div>
        <p className="text-[13.5px] text-content-subtle">{t('trip.notAdded')}</p>
        <Link to={`/ada/new?caseNo=${encodeURIComponent(caseNo)}&direction=${direction}`}
          className="self-start inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-line bg-surface hover:bg-surface-2 text-[13.5px] font-medium text-content">
          <Plus size={16} />{t(direction === 'outward' ? 'trip.addOutwardAda' : 'trip.addReturnAda')}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {entries.map((a) => (
        <Link key={a.id} to={`/ada/${a.id}`} className="card-hover rounded-2xl border border-line bg-surface-2/50 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14.5px] font-semibold text-content">{title}</span>
            <DirectionBadge direction={direction} />
          </div>
          <p className="text-[13px] text-content-muted truncate">
            <span className="tabular-nums">{formatDate(a.entry_date)}</span>
            {(a.from_place || a.to_place) && <> · {[a.from_place, a.to_place].filter(Boolean).join(' → ')}</>}
            {a.weight && <> · {a.weight}</>}
          </p>
          <dl className="grid grid-cols-3 gap-2">
            {([['fields.due', a.due, undefined], ['fields.received', a.received, 'good'], ['fields.balance', a.balance, a.balance > 0 ? 'bad' : 'muted']] as const).map(([label, value, tone]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[12px] text-content-subtle truncate">{t(label)}</dt>
                <dd className="mt-0.5 text-[14px] font-semibold"><Money value={value} tone={tone} /></dd>
              </div>
            ))}
          </dl>
        </Link>
      ))}
    </div>
  );
}

function LegRow({ leg, onEdit, onDelete }: { leg: Leg; onEdit: () => void; onDelete: () => void }) {
  const { t } = useApp();
  const details = [leg.weight, leg.item_details].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5">
      <span className="w-24 shrink-0"><DirectionBadge direction={leg.direction} /></span>
      <div className="flex-1 min-w-[180px]">
        <p className="text-[14.5px] text-content">
          <span className="tabular-nums">{formatDate(leg.trip_date)}</span>
          {leg.vehicle && <> · <span dir="ltr" className="font-mono">{leg.vehicle}</span></>}
          {(leg.from_place || leg.to_place) && <> · {[leg.from_place, leg.to_place].filter(Boolean).join(' → ')}</>}
        </p>
        {(details || leg.party_name) && <p className="mt-0.5 text-[13px] text-content-subtle truncate">{[leg.party_name, details].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="flex gap-1">
        <Btn tone="quiet" icon={<Pencil size={16} />} onClick={onEdit}>{t('actions.edit')}</Btn>
        <Btn tone="quiet" icon={<Trash2 size={16} className="text-rose-600 dark:text-rose-400" />} onClick={onDelete}>{t('web.trips.deleteLeg')}</Btn>
      </div>
    </li>
  );
}
