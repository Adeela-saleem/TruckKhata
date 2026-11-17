import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { sum } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { referenceKey } from '../../core/domain/keys';
import { listBills, type BillView } from '../../core/repo/bills';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { AddButton, Btn, CaseChip, Money, PaidBadge } from '../../ui/bits';
import { col, downloadCsv, listDocument, listReport, periodText } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { FilterBox, RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';

type PaidChoice = 'paid' | 'unpaid' | 'all';

const itemsText = (b: BillView) => b.lines.map((l) => l.description).join(', ');

export default function BillList() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [paid, setPaid] = useState<PaidChoice>('all');
  const [vendor, setVendor] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data: rows, loading } = useData(
    (db) => listBills(db, { search, range, vendor: vendor.trim(), vehicle: vehicle.trim(), caseNo: caseNo.trim(), paid: paid === 'all' ? undefined : paid }),
    [search, paid, vendor, vehicle, caseNo, range.from, range.to],
  );
  const list = rows ?? [];
  const totals = useMemo(() => ({
    total: sum(list.map((b) => b.total)), paid: sum(list.map((b) => b.paid)), balance: sum(list.map((b) => b.balance)),
  }), [list]);
  const key = referenceKey(search);
  const count = t('web.bills.count', { count: list.length });

  const columns: Column<BillView>[] = [
    { key: 'date', label: t('fields.date'), render: (b) => <span className="tabular-nums text-content-muted">{formatDate(b.bill_date)}</span> },
    { key: 'vendor', label: t('fields.vendor'), render: (b) => <span className="block max-w-[220px] truncate font-medium">{b.vendor}</span> },
    { key: 'vehicle', label: t('fields.vehicle'), wide: true, render: (b) => <span dir="ltr" className="font-mono text-[14px]">{b.vehicle ?? '–'}</span> },
    { key: 'case', label: t('fields.caseNo'), render: (b) => <CaseChip caseNo={b.case_no} highlight={!!key && referenceKey(b.case_no).includes(key)} /> },
    { key: 'items', label: t('fields.items'), wide: true, render: (b) => <span className="block max-w-[240px] truncate text-content-muted">{itemsText(b) || '–'}</span> },
    { key: 'total', label: t('fields.total'), align: 'end', render: (b) => <Money value={b.total} /> },
    { key: 'paid', label: t('fields.paid'), align: 'end', wide: true, render: (b) => <Money value={b.paid} tone="good" /> },
    { key: 'balance', label: t('fields.balance'), align: 'end', render: (b) => <Money value={b.balance} tone={b.balance > 0 ? 'bad' : 'muted'} className="font-semibold" /> },
    { key: 'status', label: t('fields.status'), wide: true, render: (b) => <PaidBadge balance={b.balance} /> },
  ];

  const report = () => listReport('bills', [
    col('date', 'fields.date', 'date'), col('vendor', 'fields.vendor'), col('vehicle', 'fields.vehicle'), col('caseNo', 'fields.caseNo'),
    col('items', 'fields.items'), col('total', 'fields.total', 'money'), col('paid', 'fields.paid', 'money'), col('balance', 'fields.balance', 'money'),
    col('status', 'fields.status', 'status'),
  ], list.map((b) => ({
    date: b.bill_date, vendor: b.vendor, vehicle: b.vehicle, caseNo: b.case_no, items: itemsText(b),
    total: b.total, paid: b.paid, balance: b.balance, status: b.balance > 0 ? 'bill.unpaid' : 'bill.paid',
  })), [
    { label: 'fields.total', value: totals.total },
    { label: 'fields.paid', value: totals.paid, tone: 'good' },
    { label: 'fields.balance', value: totals.balance, tone: 'bad' },
  ]);

  return (
    <Page title={t('modules.bills')} subtitle={count} fit
      actions={<>
        <PrintButton build={() => listDocument(report(), t('modules.bills'), periodText(range, t), t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => downloadCsv(report(), 'bill-book', t)}>{t('web.excel')}</Btn>
        <AddButton to="/bills/new" label={t('web.shell.addBill')} />
      </>}
      bar={<>
        <Segmented<PaidChoice> ariaLabel={t('bill.paidStatus')} value={paid} onChange={setPaid}
          options={[{ value: 'paid', label: t('bill.paid') }, { value: 'unpaid', label: t('bill.unpaid') }, { value: 'all', label: t('bill.allStatus') }]} />
        <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <FilterBox value={vendor} onChange={setVendor} placeholder={t('web.reports.vendorBox')} />
          <FilterBox caps value={vehicle} onChange={setVehicle} placeholder={t('web.reports.vehicleBox')} />
          <FilterBox caps value={caseNo} onChange={setCaseNo} placeholder={t('web.reports.caseBox')} />
          <SearchBox value={search} onChange={setSearch} placeholder={t('web.bills.search')} className="w-72" />
        </div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={t('web.bills.listTitle')} note={count} columns={columns} rows={rows} loading={loading}
          rowKey={(b) => b.id} onOpen={(b) => navigate(`/bills/${b.id}`)}
          empty={search.trim() || vendor.trim() || vehicle.trim() || caseNo.trim() || choice !== 'all' || paid !== 'all' ? { title: t('empty.noMatch'), hint: t('empty.noMatchHint') } : { title: t('empty.bills'), hint: t('web.empty.bills') }}
          footer={[t('web.list.total'), '', '', '', '', <Money key="t" value={totals.total} />, <Money key="p" value={totals.paid} tone="good" />,
            <Money key="b" value={totals.balance} tone="bad" />, '']} />
      </div>
    </Page>
  );
}
