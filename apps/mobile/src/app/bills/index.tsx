import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { sum } from '../../domain/calc';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { reportToDocument } from '../../print/html';
import { listBills } from '../../repo/bills';
import { buildReport } from '../../repo/reports';
import { useApp, useData } from '../../ui/context';
import { Chips, Empty, Fab, Field, SearchBar, SummaryCard } from '../../ui/controls';
import { ChipRow, IconWell, MetaChip, MoneyStrip, PayProgress, RowCard, RowHead } from '../../ui/rows';
import { FilterPanel, ListScreen, RangePicker, rangeFor, type RangeChoice } from '../../ui/screen';
import { usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

type PaidChoice = 'all' | 'paid' | 'unpaid';

export default function BillList() {
  const { db, t } = useApp();
  const print = usePrint();
  const [search, setSearch] = useState('');
  const [paid, setPaid] = useState<PaidChoice>('all');
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [vendor, setVendor] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const range = rangeFor(choice, custom);
  const { data } = useData((d) => listBills(d, { search, vendor, vehicle, caseNo, range, paid: paid === 'all' ? undefined : paid }), [search, vendor, vehicle, caseNo, range.from, range.to, paid]);
  const rows = data ?? [];
  const active = [paid !== 'all', choice !== 'all', vendor, vehicle, caseNo].filter(Boolean).length;
  return (
    <ListScreen
      title={t('modules.bills')}
      actions={[{
        icon: 'printer-outline', label: t('actions.print'),
        onPress: () => print(async () => reportToDocument(await buildReport(db, 'bills', { range, vehicle, caseNo, party: vendor }), t('modules.bills'), '', t)),
      }]}
      data={rows}
      keyExtractor={(b) => b.id}
      renderItem={({ item: b }) => (
        <RowCard
          onPress={() => router.push(`/bills/${b.id}`)}
          footer={<>
            <PayProgress due={b.total} received={b.paid} />
            <MoneyStrip items={[
              { label: t('fields.total'), value: b.total },
              { label: t('fields.paid'), value: b.paid, tone: 'good' },
              { label: t('fields.balance'), value: b.balance, tone: b.balance > 0 ? 'bad' : undefined },
            ]} />
          </>}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconWell icon="receipt-text-outline" />
            <View style={{ flex: 1 }}><RowHead title={b.vendor} sub={formatDate(b.bill_date)} /></View>
          </View>
          {b.lines.length > 0 && <T variant="small" color={colors.muted} numberOfLines={1}>{b.lines.map((l) => l.description).join(', ')}</T>}
          {(b.vehicle || b.case_no) && (
            <ChipRow>
              {b.vehicle && <MetaChip icon="truck-outline" label={b.vehicle} />}
              {b.case_no && <MetaChip icon="pound" label={b.case_no} />}
            </ChipRow>
          )}
        </RowCard>
      )}
      empty={search || active ? <Empty icon="magnify-close" title={t('empty.noMatch')} hint={t('empty.noMatchHint')} /> : <Empty icon="receipt-text-outline" title={t('empty.bills')} hint={t('empty.billsHint')} />}
      overlay={<Fab label={t('actions.add')} onPress={() => router.push('/bills/form')} />}
    >
      <SearchBar value={search} onChange={setSearch} placeholder={t('actions.search')} />
      <FilterPanel activeCount={active}>
        <Chips<PaidChoice> label={t('bill.paidStatus')} value={paid} onChange={setPaid}
          options={[{ value: 'all', label: t('bill.allStatus') }, { value: 'unpaid', label: t('bill.unpaid') }, { value: 'paid', label: t('bill.paid') }]} />
        <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <Field label={t('fields.vendor')} value={vendor} onChange={setVendor} />
        <Field caps label={t('fields.vehicle')} value={vehicle} onChange={setVehicle} />
        <Field caps label={t('fields.caseNo')} value={caseNo} onChange={setCaseNo} />
      </FilterPanel>
      {rows.length > 0 && (
        <SummaryCard
          rows={[{ label: t('fields.total'), value: formatPKR(sum(rows.map((b) => b.total))) }, { label: t('fields.paid'), value: formatPKR(sum(rows.map((b) => b.paid))), tone: 'good' }]}
          headline={{ label: t('fields.balance'), value: formatPKR(sum(rows.map((b) => b.balance))), tone: 'bad' }}
        />
      )}
    </ListScreen>
  );
}
