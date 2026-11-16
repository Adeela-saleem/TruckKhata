import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { InsuranceStatus } from '../../domain/calc';
import { daysBetween, formatDate, today } from '../../domain/dates';
import { reportToDocument } from '../../print/html';
import { listInsurance } from '../../repo/insurance';
import { buildReport } from '../../repo/reports';
import { useApp, useData } from '../../ui/context';
import { Chips, Empty, Fab, SearchBar } from '../../ui/controls';
import { IconWell, RowCard } from '../../ui/rows';
import { FilterPanel, ListScreen, RangePicker, rangeFor, type RangeChoice } from '../../ui/screen';
import { InsuranceBadge, usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

type StatusChoice = 'all' | InsuranceStatus | 'archived';
const wells = { active: 'green', expiring: 'amber', expired: 'red' } as const;

export default function InsuranceList() {
  const { db, t } = useApp();
  const print = usePrint();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusChoice>('all');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const range = rangeFor(choice, custom);
  const { data } = useData((db) => listInsurance(db, {
    search, range, archived: status === 'archived', status: status === 'all' || status === 'archived' ? undefined : status,
  }), [search, status, range.from, range.to]);
  const active = [status !== 'all', choice !== 'all'].filter(Boolean).length;
  return (
    <ListScreen
      title={t('modules.insurance')}
      actions={[{
        icon: 'printer-outline', label: t('actions.print'),
        onPress: () => print(async () => reportToDocument(await buildReport(db, 'insurance', { range, vehicle: search }), t('modules.insurance'), '', t)),
      }]}
      data={data ?? []}
      keyExtractor={(i) => i.id}
      renderItem={({ item: i }) => (
        <RowCard onPress={() => router.push(`/insurance/${i.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconWell icon="shield-car" tone={wells[i.status]} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading" numberOfLines={1}>{i.vehicle}</T>
              <T variant="small" color={colors.muted} numberOfLines={1}>{[i.category, i.policy_no].filter(Boolean).join('  |  ') || `${t('insurance.expiresOn')}: ${formatDate(i.expiry_date)}`}</T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <InsuranceBadge status={i.status} />
              <T variant="small" color={colors.muted}>{formatDate(i.expiry_date)}</T>
            </View>
          </View>
          <DaysLeft expiry={i.expiry_date} status={i.status} />
        </RowCard>
      )}
      empty={search || active ? <Empty icon="magnify-close" title={t('empty.noMatch')} hint={t('empty.noMatchHint')} /> : <Empty icon="shield-car" title={t('empty.insurance')} hint={t('empty.insuranceHint')} />}
      overlay={<Fab label={t('actions.add')} onPress={() => router.push('/insurance/form')} />}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('fields.vehicle')} />
      <FilterPanel activeCount={active}>
        <Chips<StatusChoice> label={t('fields.status')} value={status} onChange={setStatus}
          options={[
            { value: 'all', label: t('range.all') }, { value: 'expiring', label: t('insurance.expiring') }, { value: 'expired', label: t('insurance.expired') },
            { value: 'active', label: t('insurance.active') }, { value: 'archived', label: t('party.archived') },
          ]} />
        <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} options={['all', 'month', 'custom']} />
      </FilterPanel>
    </ListScreen>
  );
}

/** A year-long bar that empties as the expiry date comes closer. */
function DaysLeft({ expiry, status }: { expiry: string; status: InsuranceStatus }) {
  const { t } = useApp();
  const left = daysBetween(today(), expiry);
  const share = Math.max(0, Math.min(1, left / 365));
  const color = status === 'expired' ? colors.crimson : status === 'expiring' ? colors.marigold : colors.emerald;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(14,22,17,0.08)', overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${share * 100}%`, backgroundColor: color }} />
      </View>
      <T variant="small" color={color}>{left < 0 ? t('insurance.expired') : t('insurance.daysLeft', { count: left })}</T>
    </View>
  );
}
