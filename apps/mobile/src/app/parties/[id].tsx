import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '../../domain/dates';
import { referenceKey } from '../../domain/keys';
import { formatPKR } from '../../domain/money';
import { partyDocument } from '../../print/documents';
import { partyAccount, setPartyArchived, type LedgerEntry } from '../../repo/parties';
import { useApp, useData } from '../../ui/context';
import { Avatar, ChipRow, DirectionPill, IconWell, MetaChip, MoneyStrip, Panel, PayProgress, RouteLine, RowCard, RowHead } from '../../ui/rows';
import { SummaryCard, Badge, Button, Chips, Empty, Field, SectionTitle } from '../../ui/controls';
import { useAction } from '../../ui/hooks';
import { FilterPanel, RangePicker, Screen, rangeFor, type RangeChoice } from '../../ui/screen';
import { DeleteButton, History, usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, fonts, space } from '../../ui/theme';

export default function PartyAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, t } = useApp();
  const print = usePrint();
  const { run } = useAction();
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [caseNo, setCaseNo] = useState('');
  const [kind, setKind] = useState<'all' | 'freight' | 'receipt'>('all');
  const range = rangeFor(choice, custom);
  const filter = { range, caseNo, kind: kind === 'all' ? undefined : kind };
  const { data, reload } = useData((d) => partyAccount(d, id, filter), [id, range.from, range.to, caseNo, kind]);

  if (!data) return <Screen title={t('modules.parties')}>{null}</Screen>;
  const p = data.party;
  const active = [choice !== 'all', caseNo, kind !== 'all'].filter(Boolean).length;

  // With a Case # filter typed, the matching Case # stands out on every entry.
  const searchKey = referenceKey(caseNo);
  const matches = (value: string) => searchKey !== '' && referenceKey(value).includes(searchKey);

  const open = (e: LedgerEntry) => {
    if (e.source === 'ada') router.push(`/ada/${e.refId}`);
    else router.push({ pathname: '/parties/adjustment', params: { partyId: id, id: e.refId } });
  };

  return (
    <Screen
      title={p.name}
      subtitle={t('modules.parties')}
      actions={[
        { icon: 'printer-outline', label: t('actions.print'), onPress: () => print(() => partyDocument(data, t)) },
        { icon: 'pencil-outline', label: t('actions.edit'), onPress: () => router.push({ pathname: '/parties/form', params: { id } }) },
      ]}
    >
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={p.name} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="title" numberOfLines={2}>{p.name}</T>
            <ChipRow>
              <MetaChip icon="phone-outline" label={p.phone ?? t('party.noPhone')} />
              <MetaChip icon="briefcase-outline" label={`${t('party.casesCount')}: ${p.caseCount}`} />
            </ChipRow>
          </View>
        </View>
        {p.address && <T variant="small" color={colors.muted}>{p.address}</T>}
      </Panel>
      <SummaryCard
        rows={[
          { label: t('party.totalFreight'), value: formatPKR(p.freight) },
          { label: t('party.fromAda'), value: formatPKR(p.received), tone: 'good' },
          ...(data.manualPayments > 0 ? [{ label: t('party.manualPayments'), value: formatPKR(data.manualPayments), tone: 'good' as const }] : []),
          ...(data.manualCharges > 0 ? [{ label: t('party.manualCharges'), value: formatPKR(data.manualCharges) }] : []),
        ]}
        headline={{ label: t('fields.outstanding'), value: formatPKR(p.outstanding), tone: p.outstanding > 0 ? 'bad' : undefined }}
      />

      {data.ada.length > 0 && <SectionTitle title={t('party.cases')} />}
      {data.ada.map((a) => (
        <RowCard
          key={a.id} onPress={() => router.push(`/ada/${a.id}`)}
          footer={<>
            <PayProgress due={a.due} received={a.received} />
            <MoneyStrip items={[
              { label: t('fields.freight'), value: a.due },
              { label: t('fields.received'), value: a.received, tone: 'good' },
              { label: t('fields.balance'), value: a.balance, tone: a.balance > 0 ? 'bad' : undefined },
            ]} />
          </>}
        >
          <RowHead title={`${t('fields.caseNo')} ${a.case_no}`} sub={formatDate(a.entry_date)} end={<DirectionPill direction={a.direction} label={t(`direction.${a.direction}`)} />} />
          <RouteLine from={a.from_place} to={a.to_place} />
        </RowCard>
      ))}

      <SectionTitle title={t('party.ledger')} action={t('party.addManual')} onAction={() => router.push({ pathname: '/parties/adjustment', params: { partyId: id } })} />
      <FilterPanel activeCount={active}>
        <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
        <Field caps label={t('fields.caseNo')} value={caseNo} onChange={setCaseNo} />
        <Chips<typeof kind>
          label={t('fields.entryType')} value={kind} onChange={setKind}
          options={[{ value: 'all', label: t('range.all') }, ...(['freight', 'receipt'] as const).map((k) => ({ value: k, label: t(`ledger.${k}`) }))]}
        />
      </FilterPanel>
      {data.ledger.length === 0 && <Empty title={t('empty.ledger')} />}
      {data.ledger.map((e) => (
        <RowCard key={e.key} onPress={() => open(e)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconWell icon={e.kind === 'freight' ? 'truck-outline' : e.kind === 'charge' ? 'cash-plus' : 'cash-check'} tone={e.kind === 'freight' || e.kind === 'charge' ? 'red' : 'green'} />
            <T variant="bodyStrong" style={{ flex: 1 }}>{t(`ledger.${e.kind}`)}</T>
            <T variant="amount" color={e.kind === 'freight' || e.kind === 'charge' ? colors.crimson : colors.emerald}>{`${e.kind === 'freight' || e.kind === 'charge' ? '' : '- '}${formatPKR(e.amount)}`}</T>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
            <T variant="small" color={colors.muted} style={{ flexShrink: 1 }}>
              {formatDate(e.date)}
              {e.caseNo ? '  |  ' : ''}
              {e.caseNo ? <CaseNo caseNo={e.caseNo} highlight={matches(e.caseNo)} /> : null}
            </T>
            <Badge tone={e.source === 'ada' ? 'info' : 'warn'} label={t(`ledger.source_${e.source}`)} />
          </View>
          {e.note && <T variant="small" color={colors.muted}>{e.note}</T>}
        </RowCard>
      ))}

      <Button
        tone="plain" icon="archive-outline" label={p.archived_at ? t('actions.unarchive') : t('actions.archive')}
        onPress={() => run(async () => { await setPartyArchived(db, id, !p.archived_at); await reload(); })}
      />
      <DeleteButton table="parties" id={id} />
      <History recordId={id} record={() => partyDocument(data, t)} />
    </Screen>
  );
}

function CaseNo({ caseNo, highlight }: { caseNo: string; highlight: boolean }) {
  const { t } = useApp();
  return (
    <T variant="small" color={colors.ink} style={[{ fontFamily: fonts.bold }, highlight && { backgroundColor: colors.accent }]}>
      {`${t('fields.caseNo')} ${caseNo}`}
    </T>
  );
}
