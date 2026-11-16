import { router } from 'expo-router';
import { useState } from 'react';
import type { Direction } from '../../domain/calc';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { reportToDocument } from '../../print/html';
import { adaTotals, listAda } from '../../repo/ada';
import { buildReport } from '../../repo/reports';
import { useApp, useData } from '../../ui/context';
import { Chips, Empty, Fab, Field, SearchBar, SummaryCard } from '../../ui/controls';
import { ChipRow, DirectionPill, MetaChip, MoneyStrip, PayProgress, RouteLine, RowCard, RowHead } from '../../ui/rows';
import { FilterPanel, ListScreen, RangePicker, rangeFor, type RangeChoice } from '../../ui/screen';
import { usePrint } from '../../ui/shared';

export default function AdaList() {
  const { db, t } = useApp();
  const print = usePrint();
  const [search, setSearch] = useState('');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [vehicle, setVehicle] = useState('');
  const [route, setRoute] = useState('');
  const [direction, setDirection] = useState<'all' | Direction>('all');
  const range = rangeFor(choice, custom);
  const dir = direction === 'all' ? undefined : direction;
  const { data } = useData((d) => listAda(d, { search, range, vehicle, route, direction: dir }), [search, range.from, range.to, vehicle, route, dir]);
  const rows = data ?? [];
  const totals = adaTotals(rows);
  const active = [choice !== 'all', vehicle, route, dir].filter(Boolean).length;
  const filtering = search !== '' || active > 0;

  return (
    <ListScreen
      title={t('modules.ada')}
      actions={[{
        icon: 'printer-outline', label: t('actions.print'),
        onPress: () => print(async () => reportToDocument(await buildReport(db, 'ada', { range, vehicle, route, direction: dir }), t('modules.ada'), '', t)),
      }]}
      data={rows}
      keyExtractor={(a) => a.id}
      renderItem={({ item: a }) => (
        <RowCard
          onPress={() => router.push(`/ada/${a.id}`)}
          footer={<>
            <PayProgress due={a.due} received={a.received} />
            <MoneyStrip items={[
              { label: t('fields.due'), value: a.due },
              { label: t('fields.received'), value: a.received, tone: 'good' },
              { label: t('fields.balance'), value: a.balance, tone: a.balance > 0 ? 'bad' : undefined },
            ]} />
          </>}
        >
          <RowHead title={a.case_no} sub={formatDate(a.entry_date)} end={<DirectionPill direction={a.direction} label={t(`direction.${a.direction}`)} />} />
          <RouteLine from={a.from_place} to={a.to_place} />
          {(a.vehicle || a.party_name) && (
            <ChipRow>
              {a.vehicle && <MetaChip icon="truck-outline" label={a.vehicle} />}
              {a.party_name && <MetaChip icon="account-outline" label={a.party_name} />}
            </ChipRow>
          )}
        </RowCard>
      )}
      empty={filtering ? <Empty icon="magnify-close" title={t('empty.noMatch')} hint={t('empty.noMatchHint')} /> : <Empty icon="notebook-edit-outline" title={t('empty.ada')} hint={t('empty.adaHint')} />}
      overlay={<Fab label={t('actions.add')} onPress={() => router.push('/ada/form')} />}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('actions.search')} />
      <FilterPanel activeCount={active}>
        <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <Field label={t('fields.vehicle')} value={vehicle} onChange={setVehicle} caps />
        <Field label={t('fields.route')} value={route} onChange={setRoute} />
        <Chips<typeof direction>
          label={t('fields.direction')} value={direction} onChange={setDirection}
          options={[{ value: 'all', label: t('range.all') }, { value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]}
        />
      </FilterPanel>
      {rows.length > 0 && (
        <SummaryCard
          rows={[{ label: t('fields.due'), value: formatPKR(totals.due) }, { label: t('fields.received'), value: formatPKR(totals.received), tone: 'good' }]}
          headline={{ label: t('fields.balance'), value: formatPKR(totals.balance), tone: totals.balance > 0 ? 'bad' : undefined }}
        />
      )}
    </ListScreen>
  );
}
