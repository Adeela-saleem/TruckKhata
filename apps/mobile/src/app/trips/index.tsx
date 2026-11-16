import { router } from 'expo-router';
import { useState } from 'react';
import type { CycleStatus } from '../../domain/calc';
import { formatDate } from '../../domain/dates';
import { reportToDocument } from '../../print/html';
import { listCycles, type Direction } from '../../repo/cases';
import { buildReport } from '../../repo/reports';
import { useApp, useData } from '../../ui/context';
import { Chips, Empty, Fab, Field, SearchBar } from '../../ui/controls';
import { ChipRow, MetaChip, MoneyStrip, RouteLine, RowCard, RowHead } from '../../ui/rows';
import { FilterPanel, ListScreen, RangePicker, rangeFor, type RangeChoice } from '../../ui/screen';
import { StatusBadge, usePrint } from '../../ui/shared';

type StatusChoice = 'all' | CycleStatus;
type DirectionChoice = 'all' | Direction;

export default function TripList() {
  const { db, t } = useApp();
  const print = usePrint();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusChoice>('all');
  const [direction, setDirection] = useState<DirectionChoice>('all');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [vehicle, setVehicle] = useState('');
  const [party, setParty] = useState('');
  const range = rangeFor(choice, custom);
  const { data } = useData((d) => listCycles(d, {
    search, vehicle, party, range,
    status: status === 'all' ? undefined : status,
    direction: direction === 'all' ? undefined : direction,
  }), [search, vehicle, party, range.from, range.to, status, direction]);
  const rows = data ?? [];
  const active = [status !== 'all', direction !== 'all', choice !== 'all', vehicle, party].filter(Boolean).length;

  return (
    <ListScreen
      title={t('modules.trips')}
      actions={[{
        icon: 'printer-outline', label: t('actions.print'),
        onPress: () => print(async () => reportToDocument(await buildReport(db, 'cycles', { range, vehicle, party }), t('modules.trips'), '', t)),
      }]}
      data={rows}
      keyExtractor={(c) => c.caseId}
      renderItem={({ item: c }) => (
        <RowCard
          onPress={() => router.push(`/case/${c.caseId}`)}
          footer={<MoneyStrip items={[
            { label: t('fields.freight'), value: c.summary.freight },
            { label: t('fields.totalExpenses'), value: c.summary.totalExpenses },
            { label: `${t('fields.profit')} (${t(c.summary.confirmed ? 'trip.confirmed' : 'trip.provisional')})`, value: c.summary.profit, tone: c.summary.profit < 0 ? 'bad' : c.summary.confirmed ? 'good' : undefined },
          ]} />}
        >
          <RowHead title={c.caseNo} sub={formatDate(c.date)} end={<StatusBadge status={c.summary.status} />} />
          <RouteLine from={c.from} to={c.to} />
          {(c.vehicle || c.partyName) && (
            <ChipRow>
              {c.vehicle && <MetaChip icon="truck-outline" label={c.vehicle} />}
              {c.partyName && <MetaChip icon="account-outline" label={c.partyName} />}
            </ChipRow>
          )}
        </RowCard>
      )}
      empty={search || active ? <Empty icon="magnify-close" title={t('empty.noMatch')} hint={t('empty.noMatchHint')} /> : <Empty icon="truck-fast-outline" title={t('empty.trips')} hint={t('empty.tripsHint')} />}
      overlay={<Fab label={t('actions.add')} onPress={() => router.push('/trips/form')} />}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('actions.search')} />
      <FilterPanel activeCount={active}>
        <Chips<StatusChoice> label={t('fields.status')} value={status} onChange={setStatus}
          options={[{ value: 'all', label: t('range.all') }, ...(['outward_pending', 'return_pending', 'ready', 'complete'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
        <Chips<DirectionChoice> label={t('fields.direction')} value={direction} onChange={setDirection}
          options={[{ value: 'all', label: t('range.all') }, { value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
        <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <Field caps label={t('fields.vehicle')} value={vehicle} onChange={setVehicle} />
        <Field label={t('fields.party')} value={party} onChange={setParty} />
      </FilterPanel>
    </ListScreen>
  );
}
