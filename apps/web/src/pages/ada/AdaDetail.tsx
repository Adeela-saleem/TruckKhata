import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Truck } from 'lucide-react';
import { formatDate } from '../../core/domain/dates';
import { formatPKR } from '../../core/domain/money';
import { adaDocument } from '../../core/print/documents';
import { getAda, listReceipts, type Receipt } from '../../core/repo/ada';
import { useApp, useData } from '../../app/context';
import { EmptyState } from '../../components/shared/states';
import { Btn, DirectionBadge, Facts, Money, SectionCard, SumLine } from '../../ui/bits';
import { Page } from '../../ui/Page';
import { DeleteButton, HistoryCard, PrintButton } from '../../ui/record';
import { RecordHeader } from '../../ui/RecordHeader';
import { ReceiptModal } from './ReceiptModal';

export default function AdaDetail() {
  const { id = '' } = useParams();
  const { t } = useApp();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<Receipt | null | 'new'>(null);
  const { data } = useData(async (db) => {
    const entry = await getAda(db, id);
    const receipts = entry ? await listReceipts(db, id) : [];
    const hasTrip = entry ? (await db.get('SELECT 1 FROM trip_legs WHERE case_id = ? AND deleted_at IS NULL', [entry.case_id])) !== null : false;
    return { entry, receipts, hasTrip };
  }, [id]);
  const a = data?.entry;

  if (data && (!a || a.deleted_at)) {
    return <Page title={t('modules.ada')}><div className="card"><EmptyState title={t('web.notFound')} /></div></Page>;
  }
  if (!a || !data) return <Page title={t('modules.ada')}>{null}</Page>;
  const doc = () => adaDocument(a, data.receipts, t);

  return (
    <Page title={a.case_no} subtitle={t('modules.ada')}
      actions={<>
        <PrintButton build={doc} />
        <Btn icon={<Pencil size={16} />} onClick={() => navigate(`/ada/${id}/edit`)}>{t('actions.edit')}</Btn>
      </>}>
      <div className="max-w-[1800px]">
        <RecordHeader
          badges={<DirectionBadge direction={a.direction} />}
          meta={<>{formatDate(a.entry_date)}{a.party_name && <> · {a.party_name}</>}{(a.from_place || a.to_place) && <> · {[a.from_place, a.to_place].filter(Boolean).join(' → ')}</>}</>}
          aside={
            <Btn icon={<Truck size={16} />} onClick={() => (data.hasTrip ? navigate(`/trips/${a.case_id}`) : navigate(`/trips/new?caseNo=${encodeURIComponent(a.case_no)}`))}>
              {data.hasTrip ? t('web.ada.openCase') : t('ada.addTrip')}
            </Btn>
          } />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 flex flex-col gap-5">
            <SectionCard title={t('form.trip')}>
              <Facts columns={3} items={[
                { label: t('fields.broker'), value: a.party_name },
                { label: t('fields.vehicle'), value: a.vehicle && <span dir="ltr" className="font-mono">{a.vehicle}</span> },
                { label: t('fields.weight'), value: a.weight },
                { label: t('fields.from'), value: a.from_place },
                { label: t('fields.to'), value: a.to_place },
                { label: t('fields.empty'), value: a.empty },
                { label: t('fields.market'), value: a.market },
                { label: t('fields.emptyMt'), value: a.empty_mt },
                { label: t('fields.dihari'), value: a.dihari },
              ]} />
            </SectionCard>

            <SectionCard title={t('ada.receipts')} note={String(data.receipts.length)} padded={false}
              action={<Btn icon={<Plus size={16} />} onClick={() => setReceipt('new')}>{t('ada.addReceipt')}</Btn>}>
              {data.receipts.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{t('empty.ledger')}</p>
                : (
                  <ul className="divide-y divide-line">
                    {data.receipts.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => setReceipt(r)} className="noir-row w-full flex items-center gap-4 px-6 h-[56px] text-start">
                          <span className="w-28 tabular-nums text-[14px] text-content">{formatDate(r.receipt_date)}</span>
                          <span className="flex-1 min-w-0 truncate text-[14px] text-content-muted">{r.note}</span>
                          <Money value={r.amount} sign="+" tone="good" className="text-[14px] font-semibold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </SectionCard>

            <HistoryCard recordIds={[id, ...data.receipts.map((r) => r.id)]} record={doc} />
            <div><DeleteButton table="ada_entries" id={id} after={() => navigate('/ada', { replace: true })} /></div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-5">
            <SectionCard title={t('fields.freight')}>
              <SumLine label={t('fields.freightRate')} value={a.freight_rate} />
              <SumLine label={t('fields.commission')} value={a.commission} sign="-" />
              <SumLine label={t('fields.net')} value={a.net} total />
              {a.mt_amount > 0 && <SumLine label={`${t('fields.mt')} (${t(`adjust.${a.mt_mode}`)})`} value={a.mt_amount} sign={a.mt_mode === 'deduct' ? '-' : '+'} />}
              {a.dihari_total > 0 && (
                <SumLine label={`${t('fields.dihariTotal')}${a.dihari_days === null ? '' : `: ${a.dihari_days} × ${formatPKR(a.dihari_rate)}`}`}
                  value={a.dihari_total} sign={a.dihari_mode === 'deduct' ? '-' : '+'} />
              )}
              <SumLine label={t('fields.due')} value={a.due} total />
              <SumLine label={t('fields.received')} value={a.received} sign="-" tone="good" />
              <div className="mt-3 rounded-xl bg-surface-2 border border-line px-4 py-3 flex items-baseline justify-between">
                <span className="text-[14px] font-semibold text-content">{t('fields.balance')}</span>
                <Money value={a.balance} tone={a.balance > 0 ? 'bad' : undefined} className="font-display text-[28px] font-semibold tracking-[-0.02em]" />
              </div>
            </SectionCard>
            {a.party_id && (
              <Link to={`/parties/${a.party_id}`} className="card card-hover px-6 py-4 flex items-center justify-between">
                <span className="text-[14px] text-content-muted">{t('party.statement')}</span>
                <span className="text-[14px] font-medium text-content">{a.party_name}</span>
              </Link>
            )}
          </aside>
        </div>
      </div>
      <ReceiptModal adaId={id} receipt={receipt} onClose={() => setReceipt(null)} />
    </Page>
  );
}
