import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import type { Direction } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { adaTotals, listAda, type AdaView } from '../../core/repo/ada';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { AddButton, Btn, CaseChip, DirectionBadge, Money } from '../../ui/bits';
import { col, downloadCsv, listDocument, listReport, periodText } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { FilterBox, RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';

export default function AdaList() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<Direction | 'all'>('all');
  const [vehicle, setVehicle] = useState('');
  const [route, setRoute] = useState('');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data: rows, loading } = useData(
    (db) => listAda(db, { search, range, vehicle: vehicle.trim(), route: route.trim(), direction: direction === 'all' ? undefined : direction }),
    [search, direction, vehicle, route, range.from, range.to],
  );
  const totals = useMemo(() => adaTotals(rows ?? []), [rows]);
  const term = search.trim();

  const columns: Column<AdaView>[] = [
    { key: 'case', label: t('fields.caseNo'), render: (a) => <CaseChip caseNo={a.case_no} highlight={!!term && a.case_no.toUpperCase().includes(term.toUpperCase())} /> },
    { key: 'dir', label: t('fields.direction'), render: (a) => <DirectionBadge direction={a.direction} /> },
    { key: 'date', label: t('fields.date'), render: (a) => <span className="tabular-nums text-content-muted">{formatDate(a.entry_date)}</span> },
    { key: 'vehicle', label: t('fields.vehicle'), render: (a) => <span dir="ltr" className="font-mono text-[14px]">{a.vehicle ?? '–'}</span> },
    { key: 'party', label: t('fields.broker'), render: (a) => <span className="block max-w-[200px] truncate">{a.party_name ?? '–'}</span> },
    { key: 'route', label: t('fields.route'), wide: true, render: (a) => <span className="block max-w-[220px] truncate text-content-muted">{[a.from_place, a.to_place].filter(Boolean).join(' → ') || '–'}</span> },
    { key: 'freight', label: t('fields.freightRate'), align: 'end', wide: true, render: (a) => <Money value={a.freight_rate} /> },
    { key: 'due', label: t('fields.due'), align: 'end', render: (a) => <Money value={a.due} /> },
    { key: 'received', label: t('fields.received'), align: 'end', render: (a) => <Money value={a.received} tone="good" /> },
    { key: 'balance', label: t('fields.balance'), align: 'end', render: (a) => <Money value={a.balance} tone={a.balance > 0 ? 'bad' : 'muted'} className="font-semibold" /> },
  ];

  const report = () => listReport('ada', [
    col('caseNo', 'fields.caseNo'), col('direction', 'fields.direction', 'status'), col('date', 'fields.date', 'date'), col('vehicle', 'fields.vehicle'),
    col('party', 'fields.broker'), col('route', 'fields.route'), col('freight', 'fields.freightRate', 'money'), col('commission', 'fields.commission', 'money'),
    col('mt', 'fields.mt', 'money'), col('dihari', 'fields.dihariTotal', 'money'), col('due', 'fields.due', 'money'), col('received', 'fields.received', 'money'), col('balance', 'fields.balance', 'money'),
  ], (rows ?? []).map((a) => ({
    caseNo: a.case_no, direction: `direction.${a.direction}`, date: a.entry_date, vehicle: a.vehicle, party: a.party_name,
    route: [a.from_place, a.to_place].filter(Boolean).join(' - '), freight: a.freight_rate, commission: a.commission,
    mt: a.mt_mode === 'deduct' ? -a.mt_amount : a.mt_amount, dihari: a.dihari_mode === 'deduct' ? -a.dihari_total : a.dihari_total,
    due: a.due, received: a.received, balance: a.balance,
  })), [
    { label: 'fields.due', value: totals.due },
    { label: 'fields.received', value: totals.received, tone: 'good' },
    { label: 'fields.balance', value: totals.balance, tone: 'bad' },
  ]);

  return (
    <Page title={t('modules.ada')} subtitle={t('web.list.entries', { count: rows?.length ?? 0 })} fit
      actions={<>
        <PrintButton build={() => listDocument(report(), t('modules.ada'), periodText(range, t), t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => downloadCsv(report(), 'ada-register', t)}>{t('web.excel')}</Btn>
        <AddButton to="/ada/new" label={t('web.shell.addAda')} />
      </>}
      bar={<>
        <Segmented ariaLabel={t('fields.direction')} value={direction} onChange={setDirection}
          options={[{ value: 'all', label: t('web.ada.allDirections') }, { value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
        <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <FilterBox caps value={vehicle} onChange={setVehicle} placeholder={t('web.reports.vehicleBox')} />
          <FilterBox value={route} onChange={setRoute} placeholder={t('web.reports.routeBox')} />
          <SearchBox value={search} onChange={setSearch} placeholder={t('web.ada.search')} className="w-72" />
        </div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={t('web.ada.listTitle')} note={t('web.list.entries', { count: rows?.length ?? 0 })} columns={columns} rows={rows} loading={loading}
          rowKey={(a) => a.id} onOpen={(a) => navigate(`/ada/${a.id}`)}
          empty={term || vehicle.trim() || route.trim() || choice !== 'all' || direction !== 'all' ? { title: t('empty.noMatch'), hint: t('empty.noMatchHint') } : { title: t('empty.ada'), hint: t('web.empty.ada') }}
          footer={[t('web.list.total'), '', '', '', '', '', <Money key="f" value={totals.freight} />, <Money key="d" value={totals.due} />, <Money key="r" value={totals.received} tone="good" />, <Money key="b" value={totals.balance} tone="bad" />]} />
      </div>
    </Page>
  );
}
