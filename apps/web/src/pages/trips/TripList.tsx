import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import type { CycleStatus } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { referenceKey } from '../../core/domain/keys';
import { listCycles, type CycleRow } from '../../core/repo/cases';
import { tripSheetReport } from '../../core/repo/reports';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { Btn, CaseChip, Money, StatusBadge } from '../../ui/bits';
import { downloadCsv, listDocument, periodText } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';

type StatusChoice = 'all' | CycleStatus;
const statuses: CycleStatus[] = ['outward_pending', 'return_pending', 'ready', 'complete'];

export default function TripList() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusChoice>('all');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data: rows, loading } = useData(
    (db) => listCycles(db, { search, range, status: status === 'all' ? undefined : status }),
    [search, status, range.from, range.to],
  );
  const totals = useMemo(() => (rows ?? []).reduce(
    (n, c) => ({ freight: n.freight + c.summary.freight, expenses: n.expenses + c.summary.totalExpenses, profit: n.profit + c.summary.profit }),
    { freight: 0, expenses: 0, profit: 0 },
  ), [rows]);
  const key = referenceKey(search);

  const columns: Column<CycleRow>[] = [
    { key: 'case', label: t('fields.caseNo'), render: (c) => <CaseChip caseNo={c.caseNo} highlight={!!key && referenceKey(c.caseNo).includes(key)} /> },
    { key: 'date', label: t('fields.date'), wide: true, render: (c) => <span className="tabular-nums text-content-muted">{formatDate(c.date)}</span> },
    { key: 'vehicle', label: t('fields.vehicle'), render: (c) => <span dir="ltr" className="font-mono text-[14px]">{c.vehicle ?? '–'}</span> },
    { key: 'party', label: t('fields.broker'), wide: true, render: (c) => <span className="block max-w-[180px] truncate">{c.partyName ?? '–'}</span> },
    { key: 'route', label: t('fields.route'), wide: true, render: (c) => <span className="block max-w-[200px] truncate text-content-muted">{[c.from, c.to].filter(Boolean).join(' → ') || '–'}</span> },
    { key: 'status', label: t('fields.status'), render: (c) => <StatusBadge status={c.summary.status} /> },
    { key: 'freight', label: t('fields.freight'), align: 'end', wide: true, render: (c) => <Money value={c.summary.freight} /> },
    { key: 'expenses', label: t('fields.totalExpenses'), align: 'end', wide: true, render: (c) => <Money value={c.summary.totalExpenses} /> },
    { key: 'profit', label: t('fields.profit'), align: 'end', render: (c) => <Money value={c.summary.profit} tone="auto" className="font-semibold" /> },
  ];

  // The list prints and exports as the company's monthly trip sheet (client template).
  const report = async () => {
    const sheet = await tripSheetReport(db, rows ?? [], true);
    return { ...sheet, kind: 'cycles' as const };
  };
  const exportCsv = async () => downloadCsv(await report(), 'trip-details', t);

  const count = t('web.trips.count', { count: rows?.length ?? 0 });
  return (
    <Page title={t('modules.trips')} subtitle={count} fit
      actions={<>
        <PrintButton build={async () => listDocument(await report(), t('modules.trips'), periodText(range, t), t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => void exportCsv()}>{t('web.excel')}</Btn>
      </>}
      bar={<>
        <Segmented ariaLabel={t('fields.status')} value={status} onChange={setStatus}
          options={[{ value: 'all' as StatusChoice, label: t('web.trips.allStatus') }, ...statuses.map((s) => ({ value: s as StatusChoice, label: t(`status.${s}`) }))]} />
        <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <div className="ms-auto"><SearchBox value={search} onChange={setSearch} placeholder={t('web.trips.search')} className="w-72" /></div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={t('web.trips.listTitle')} note={count} columns={columns} rows={rows} loading={loading}
          rowKey={(c) => c.caseId} onOpen={(c) => navigate(`/trips/${c.caseId}`)}
          empty={search.trim() || choice !== 'all' || status !== 'all' ? { title: t('empty.noMatch'), hint: t('empty.noMatchHint') } : { title: t('empty.trips'), hint: t('web.empty.trips') }}
          footer={[t('web.list.total'), '', '', '', '', '', <Money key="f" value={totals.freight} />, <Money key="e" value={totals.expenses} />,
            <Money key="p" value={totals.profit} tone="auto" className="font-semibold" />]} />
      </div>
    </Page>
  );
}
