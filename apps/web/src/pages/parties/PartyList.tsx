import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { sum } from '../../core/domain/calc';
import { partiesDocument } from '../../core/print/documents';
import { listParties, type PartyTotals } from '../../core/repo/parties';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { AddButton, Btn, Money } from '../../ui/bits';
import { col, downloadCsv, listReport } from '../../ui/exports';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';
import { SearchBox } from '../../ui/range';
import { PrintButton } from '../../ui/record';

type View = 'active' | 'archived';

export default function PartyList() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('active');
  const { data: rows, loading } = useData((db) => listParties(db, { search, archived: view === 'archived' }), [search, view]);
  const list = rows ?? [];
  const totals = useMemo(() => ({
    freight: sum(list.map((p) => p.freight)),
    received: sum(list.map((p) => p.received)),
    outstanding: sum(list.map((p) => p.outstanding)),
  }), [list]);
  const count = t('web.parties.count', { count: list.length });

  const columns: Column<PartyTotals>[] = [
    { key: 'name', label: t('fields.name'), render: (p) => <span className="block max-w-[260px] truncate font-medium">{p.name}</span> },
    { key: 'phone', label: t('fields.phoneShort'), wide: true, render: (p) => <span dir="ltr" className="tabular-nums text-content-muted">{p.phone ?? '–'}</span> },
    { key: 'cases', label: t('party.casesCount'), align: 'end', wide: true, render: (p) => <span className="tabular-nums text-content-muted">{p.caseCount}</span> },
    { key: 'freight', label: t('fields.totalFreight'), align: 'end', render: (p) => <Money value={p.freight} /> },
    { key: 'received', label: t('fields.received'), align: 'end', render: (p) => <Money value={p.received} tone="good" /> },
    { key: 'outstanding', label: t('fields.outstanding'), align: 'end', render: (p) => <Money value={p.outstanding} tone={p.outstanding > 0 ? 'bad' : 'muted'} className="font-semibold" /> },
  ];

  const report = () => listReport('party', [
    col('name', 'fields.name'), col('phone', 'fields.phoneShort'), col('cases', 'party.casesCount'),
    col('freight', 'fields.totalFreight', 'money'), col('received', 'fields.received', 'money'), col('outstanding', 'fields.outstanding', 'money'),
  ], list.map((p) => ({ name: p.name, phone: p.phone, cases: String(p.caseCount), freight: p.freight, received: p.received, outstanding: p.outstanding })), [
    { label: 'fields.totalFreight', value: totals.freight },
    { label: 'fields.received', value: totals.received, tone: 'good' },
    { label: 'fields.outstanding', value: totals.outstanding, tone: 'bad' },
  ]);

  return (
    <Page title={t('modules.parties')} subtitle={count} fit
      actions={<>
        <PrintButton build={() => partiesDocument(list, t)} />
        <Btn icon={<FileSpreadsheet size={16} />} onClick={() => downloadCsv(report(), 'brokers-parties', t)}>{t('web.excel')}</Btn>
        <AddButton to="/parties/new" label={t('web.shell.addParty')} />
      </>}
      bar={<>
        <Segmented<View> ariaLabel={t('modules.parties')} value={view} onChange={setView}
          options={[{ value: 'active', label: t('web.parties.active') }, { value: 'archived', label: t('party.archived') }]} />
        <div className="ms-auto"><SearchBox value={search} onChange={setSearch} placeholder={t('web.parties.search')} className="w-72" /></div>
      </>}>
      <div className="fit:h-full">
        <ListTable title={view === 'archived' ? t('web.parties.archivedTitle') : t('web.parties.listTitle')} note={count}
          columns={columns} rows={rows} loading={loading} rowKey={(p) => p.id} onOpen={(p) => navigate(`/parties/${p.id}`)}
          empty={search.trim() || view === 'archived'
            ? { title: t('empty.noMatch'), hint: view === 'archived' && !search.trim() ? t('web.parties.noArchived') : t('empty.noMatchHint') }
            : { title: t('empty.parties'), hint: t('web.empty.parties') }}
          footer={[t('web.list.total'), '', <span key="c" className="tabular-nums">{sum(list.map((p) => p.caseCount))}</span>,
            <Money key="f" value={totals.freight} />, <Money key="r" value={totals.received} tone="good" />, <Money key="o" value={totals.outstanding} tone="bad" />]} />
      </div>
    </Page>
  );
}
