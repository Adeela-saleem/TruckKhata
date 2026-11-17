import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import type { InsuranceStatus } from '../../core/domain/calc';
import { formatDate } from '../../core/domain/dates';
import { listInsurance, type InsuranceView } from '../../core/repo/insurance';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { AddButton, Btn, InsuranceBadge } from '../../ui/bits';
import { col, downloadCsv, listDocument, listReport, periodText } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';
import { DaysLeft, daysText } from './days';

type Tab = 'all' | InsuranceStatus | 'archived';

export default function InsuranceList() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  // Dates filter on the expiry date, as in the app.
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data: rows, loading } = useData(
    (db) => listInsurance(db, { search, range, archived: tab === 'archived', status: tab === 'all' || tab === 'archived' ? undefined : tab }),
    [search, tab, range.from, range.to],
  );

  const columns: Column<InsuranceView>[] = [
    { key: 'vehicle', label: t('fields.vehicle'), render: (i) => <span dir="ltr" className="font-mono text-[14px] font-semibold">{i.vehicle}</span> },
    { key: 'type', label: t('fields.insuranceType'), wide: true, render: (i) => <span className="block max-w-[200px] truncate">{i.category ?? '–'}</span> },
    { key: 'policy', label: t('fields.policyNo'), wide: true, render: (i) => <span dir="ltr" className="font-mono text-[13px] text-content-muted">{i.policy_no ?? '–'}</span> },
    { key: 'start', label: t('fields.startDate'), wide: true, render: (i) => <span className="tabular-nums text-content-muted">{formatDate(i.start_date) || '–'}</span> },
    { key: 'expiry', label: t('fields.expiry'), wide: true, render: (i) => <span className="tabular-nums">{formatDate(i.expiry_date)}</span> },
    { key: 'days', label: t('web.insurance.daysLeft'), align: 'end', render: (i) => <DaysLeft expiry={i.expiry_date} status={i.status} /> },
    { key: 'status', label: t('fields.status'), render: (i) => <InsuranceBadge status={i.status} /> },
  ];

  const report = () => listReport('insurance', [
    col('vehicle', 'fields.vehicle'), col('type', 'fields.insuranceType'), col('policy', 'fields.policyNo'), col('start', 'fields.startDate', 'date'),
    col('expiry', 'fields.expiry', 'date'), col('days', 'web.insurance.daysLeft'), col('status', 'fields.status', 'status'),
  ], (rows ?? []).map((i) => ({
    vehicle: i.vehicle, type: i.category, policy: i.policy_no, start: i.start_date, expiry: i.expiry_date,
    days: daysText(i.expiry_date, t), status: `insurance.${i.status}`,
  })));

  const tabLabel = tab === 'all' ? t('modules.insurance') : tab === 'archived' ? t('party.archived') : t(`insurance.${tab}`);
  const count = t('web.insurance.count', { count: rows?.length ?? 0 });
  return (
    <Page title={t('modules.insurance')} subtitle={count} fit
      actions={<>
        <PrintButton build={() => listDocument(report(), t('modules.insurance'), choice === 'all' ? tabLabel : `${tabLabel}  |  ${periodText(range, t)}`, t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => downloadCsv(report(), 'truck-insurance', t)}>{t('web.excel')}</Btn>
        <AddButton to="/insurance/new" label={t('web.shell.addInsurance')} />
      </>}
      bar={<>
        <Segmented<Tab> ariaLabel={t('fields.status')} value={tab} onChange={setTab}
          options={[
            { value: 'all', label: t('web.insurance.all') }, { value: 'active', label: t('insurance.active') },
            { value: 'expiring', label: t('insurance.expiring') }, { value: 'expired', label: t('insurance.expired') },
            { value: 'archived', label: t('party.archived') },
          ]} />
        <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <div className="ms-auto"><SearchBox value={search} onChange={setSearch} placeholder={t('web.insurance.search')} /></div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={t('web.insurance.listTitle')} note={count} columns={columns} rows={rows} loading={loading}
          rowKey={(i) => i.id} onOpen={(i) => navigate(`/insurance/${i.id}`)}
          empty={search.trim() || tab !== 'all' || choice !== 'all' ? { title: t('empty.noMatch'), hint: t('empty.noMatchHint') } : { title: t('empty.insurance'), hint: t('web.empty.insurance') }} />
      </div>
    </Page>
  );
}
