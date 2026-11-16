import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { sum } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { listAllReceipts, type ReceiptWithAda } from '../../core/repo/ada';
import { useApp, useData } from '../../app/context';
import { Btn, CaseChip, DirectionBadge, Money } from '../../ui/bits';
import { col, downloadCsv, listDocument, listReport, periodText } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';

export default function ReceiptList() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data: rows, loading } = useData(
    (db) => listAllReceipts(db, { search, range }),
    [search, range.from, range.to],
  );
  const term = search.trim();
  const totalAmount = useMemo(() => sum(rows?.map((r) => r.amount) ?? []), [rows]);

  const columns: Column<ReceiptWithAda>[] = [
    { key: 'case', label: t('fields.caseNo'), render: (r) => <CaseChip caseNo={r.case_no} highlight={!!term && r.case_no.toUpperCase().includes(term.toUpperCase())} /> },
    { key: 'dir', label: t('fields.direction'), render: (r) => <DirectionBadge direction={r.direction} /> },
    { key: 'entry_date', label: t('web.receipts.entryDate'), render: (r) => <span className="tabular-nums text-content-muted">{formatDate(r.entry_date)}</span> },
    { key: 'party', label: t('fields.broker'), render: (r) => <span className="block max-w-[200px] truncate">{r.party_name ?? '–'}</span> },
    { key: 'receipt_date', label: t('web.receipts.receiptDate'), render: (r) => <span className="tabular-nums text-content-muted">{formatDate(r.receipt_date)}</span> },
    { key: 'amount', label: t('fields.received'), align: 'end', render: (r) => <Money value={r.amount} tone="good" /> },
    { key: 'note', label: t('web.receipts.note'), wide: true, render: (r) => <span className="block max-w-[220px] truncate text-content-muted">{r.note ?? '–'}</span> },
  ];

  const report = () => listReport('ada', [
    col('caseNo', 'fields.caseNo'), col('direction', 'fields.direction', 'status'), col('entryDate', 'web.receipts.entryDate', 'date'),
    col('party', 'fields.broker'), col('receiptDate', 'web.receipts.receiptDate', 'date'), col('amount', 'fields.received', 'money'), col('note', 'web.receipts.note'),
  ], (rows ?? []).map((r) => ({
    caseNo: r.case_no, direction: `direction.${r.direction}`, entryDate: r.entry_date,
    party: r.party_name, receiptDate: r.receipt_date, amount: r.amount, note: r.note,
  })), [
    { label: 'fields.received', value: totalAmount, tone: 'good' },
  ]);

  return (
    <Page title={t('web.receipts.title')} subtitle={t('web.list.entries', { count: rows?.length ?? 0 })} fit
      actions={<>
        <PrintButton build={() => listDocument(report(), t('web.receipts.title'), periodText(range, t), t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => downloadCsv(report(), 'receipts', t)}>{t('web.excel')}</Btn>
      </>}
      bar={<>
        <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <div className="ms-auto"><SearchBox value={search} onChange={setSearch} placeholder={t('web.receipts.search')} className="w-72" /></div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={t('web.receipts.title')} note={t('web.list.entries', { count: rows?.length ?? 0 })} columns={columns} rows={rows} loading={loading}
          rowKey={(r) => r.id} onOpen={(r) => navigate(`/ada/${r.ada_id}`)}
          empty={term || choice !== 'all' ? { title: t('empty.noMatch'), hint: t('empty.noMatchHint') } : { title: t('empty.receipts'), hint: t('web.empty.receipts') }}
          footer={[t('web.list.total'), '', '', '', '', <Money key="total" value={totalAmount} tone="good" />, '']} />
      </div>
    </Page>
  );
}
