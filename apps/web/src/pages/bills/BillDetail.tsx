import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Truck } from 'lucide-react';
import { formatDate } from '../../core/domain/dates';
import { billDocument } from '../../core/print/documents';
import { getBill } from '../../core/repo/bills';
import { useApp, useData } from '../../app/context';
import { EmptyState } from '../../components/shared/states';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../components/ui/cn';
import { Btn, CaseChip, Facts, Money, PaidBadge, SectionCard, SumLine } from '../../ui/bits';
import { Page } from '../../ui/Page';
import { DeleteButton, HistoryCard, PrintButton } from '../../ui/record';
import { RecordHeader } from '../../ui/RecordHeader';

const th = 'h-[48px] px-4 first:ps-6 last:pe-6 text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line';
const td = 'px-4 first:ps-6 last:pe-6 text-[14px] text-content';

export default function BillDetail() {
  const { id = '' } = useParams();
  const { t } = useApp();
  const navigate = useNavigate();
  const { data: b } = useData((db) => getBill(db, id), [id]);

  if (b === null || b?.deleted_at) {
    return <Page title={t('modules.bills')}><div className="card"><EmptyState title={t('web.notFound')} /></div></Page>;
  }
  if (!b) return <Page title={t('modules.bills')}>{null}</Page>;
  const doc = () => billDocument(b, t);

  return (
    <Page title={b.vendor} subtitle={t('modules.bills')}
      actions={<>
        <PrintButton build={doc} />
        <Btn icon={<Pencil size={16} />} onClick={() => navigate(`/bills/${id}/edit`)}>{t('actions.edit')}</Btn>
      </>}>
      <div className="max-w-[1800px]">
        <RecordHeader
          badges={<>
            <PaidBadge balance={b.balance} />
            {b.case_id && <Badge tone={b.count_in_profit ? 'success' : 'neutral'}>{t(b.count_in_profit ? 'trip.countedInProfit' : 'trip.notCounted')}</Badge>}
          </>}
          meta={<>
            {formatDate(b.bill_date)}
            {b.vehicle && <> · <span dir="ltr" className="font-mono">{b.vehicle}</span></>}
            {b.case_no && <> · <CaseChip caseNo={b.case_no} /></>}
          </>}
          aside={b.case_id ? <Btn icon={<Truck size={16} />} onClick={() => navigate(`/trips/${b.case_id}`)}>{t('bill.linkedCase')}</Btn> : undefined} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
            <SectionCard title={t('web.bills.details')}>
              <Facts columns={3} items={[
                { label: t('fields.date'), value: formatDate(b.bill_date) },
                { label: t('fields.vendor'), value: b.vendor },
                { label: t('fields.vehicle'), value: b.vehicle && <span dir="ltr" className="font-mono">{b.vehicle}</span> },
                { label: t('fields.caseNo'), value: b.case_no && <CaseChip caseNo={b.case_no} /> },
                { label: t('bill.countLabel'), value: b.case_id ? t(b.count_in_profit ? 'trip.countedInProfit' : 'trip.notCounted') : null },
                { label: t('fields.notes'), value: b.notes },
              ]} />
            </SectionCard>

            <SectionCard title={t('bill.lines')} note={String(b.lines.length)} padded={false}>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="noir-thead">
                      <th scope="col" className={cn(th, 'text-start')}>{t('fields.itemName')}</th>
                      <th scope="col" className={cn(th, 'text-end')}>{t('fields.quantity')}</th>
                      <th scope="col" className={cn(th, 'text-start')}>{t('fields.unit')}</th>
                      <th scope="col" className={cn(th, 'text-end')}>{t('fields.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.lines.map((l) => (
                      <tr key={l.id} className="h-[52px] border-b border-line">
                        <td className={cn(td, 'text-start')}>{l.description}</td>
                        <td className={cn(td, 'text-end tabular-nums text-content-muted whitespace-nowrap')}>{l.quantity ?? '–'}</td>
                        <td className={cn(td, 'text-start text-content-muted whitespace-nowrap')}>{l.unit ?? '–'}</td>
                        <td className={cn(td, 'text-end whitespace-nowrap')}><Money value={l.amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="h-[52px] bg-surface-2/70">
                      <td className={cn(td, 'font-semibold')} colSpan={3}>{t('fields.total')}</td>
                      <td className={cn(td, 'text-end font-semibold whitespace-nowrap')}><Money value={b.total} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <HistoryCard recordIds={[id]} record={doc} />
            <div><DeleteButton table="bills" id={id} after={() => navigate('/bills', { replace: true })} /></div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-5">
            <SectionCard title={t('web.bills.summary')}>
              <SumLine label={t('fields.total')} value={b.total} />
              <SumLine label={t('fields.paid')} value={b.paid} sign="-" tone="good" />
              <div className="mt-3 rounded-xl bg-surface-2 border border-line px-4 py-3 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold text-content">{t('fields.balance')}</span>
                <Money value={b.balance} tone={b.balance > 0 ? 'bad' : undefined} className="font-display text-[28px] font-semibold tracking-[-0.02em]" />
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </Page>
  );
}
