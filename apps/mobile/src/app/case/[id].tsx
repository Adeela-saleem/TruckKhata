import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import type { Direction } from '../../domain/calc';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { caseDocument } from '../../print/documents';
import type { AdaView } from '../../repo/ada';
import { caseSheetCsv } from '../../print/csv';
import { getCaseView, markCaseComplete, ratePerUnit, reopenCase, sheetHeader, sheetTotals, type Leg } from '../../repo/cases';
import { shareTextFile } from '../../services/files';
import { useApp, useData } from '../../ui/context';
import { ChipRow, DirectionPill, IconWell, InfoGrid, MetaChip, MoneyStrip, PayProgress, RouteLine, RowCard, RowHead } from '../../ui/rows';
import type { IconName } from '../../ui/controls';
import { Badge, Banner, Button, Card, Line, SectionTitle, SummaryCard } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { DeleteButton, History, StatusBadge, usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

function AdaFileCard({ direction, entries, caseNo }: { direction: Direction; entries: AdaView[]; caseNo: string }) {
  const { t } = useApp();
  const title = t(direction === 'outward' ? 'trip.market' : 'trip.returnLoad');
  if (entries.length === 0) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconWell icon={direction === 'outward' ? 'arrow-top-right' : 'arrow-bottom-left'} tone="grey" />
          <View style={{ flex: 1 }}>
            <T variant="heading">{title}</T>
            <T variant="small" color={colors.muted}>{t('trip.notAdded')}</T>
          </View>
        </View>
        <Button tone="quiet" icon="plus" label={t(direction === 'outward' ? 'trip.addOutwardAda' : 'trip.addReturnAda')}
          onPress={() => router.push({ pathname: '/ada/form', params: { caseNo, direction } })} />
      </Card>
    );
  }
  return (
    <>
      {entries.map((a) => (
        <RowCard
          key={a.id} onPress={() => router.push(`/ada/${a.id}`)}
          footer={<>
            <PayProgress due={a.due} received={a.received} />
            <MoneyStrip items={[
              { label: t('fields.due'), value: a.due },
              { label: t('fields.received'), value: a.received, tone: 'good' },
              { label: t('fields.balance'), value: a.balance, tone: a.balance > 0 ? 'bad' : undefined },
            ]} />
          </>}
        >
          <RowHead title={title} sub={formatDate(a.entry_date)} end={<DirectionPill direction={direction} label={t(`direction.${direction}`)} />} />
          <RouteLine from={a.from_place} to={a.to_place} />
          {(a.party_name || a.weight) && (
            <ChipRow>
              {a.party_name && <MetaChip icon="account-outline" label={a.party_name} />}
              {a.weight && <MetaChip icon="weight" label={a.weight} />}
            </ChipRow>
          )}
        </RowCard>
      ))}
    </>
  );
}

export default function CaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { run } = useAction();
  const print = usePrint();
  const { data: v, reload } = useData((d) => getCaseView(d, id), [id]);
  if (!v) return <Screen title={t('trip.caseScreen')}>{null}</Screen>;
  const s = v.summary;
  const caseNo = v.caseRow.case_no;
  const h = sheetHeader(v);
  const st = sheetTotals(v);

  const complete = () => run(async () => {
    if (await confirm(t('trip.completeTitle'), t('trip.completeMessage', { profit: formatPKR(s.profit) }), t('trip.markComplete'))) {
      await markCaseComplete(db, id);
      toast(t('status.complete'));
      await reload();
    }
  });
  const reopen = () => run(async () => {
    if (await confirm(t('trip.reopenTitle'), t('trip.reopenMessage'), t('trip.reopen'))) {
      await reopenCase(db, id);
      await reload();
    }
  });
  const legForm = (leg: Leg | null, direction: Direction) =>
    router.push({ pathname: '/trips/form', params: leg ? { id: leg.id } : { caseNo, direction } });
  const load = (l: typeof h.market) => (l ? [formatPKR(l.freight), l.weight].filter(Boolean).join('\n') : t('trip.notAddedShort'));

  return (
    <Screen
      title={caseNo}
      subtitle={t('trip.sheet')}
      actions={[
        { icon: 'printer-outline', label: t('actions.print'), onPress: () => print(() => caseDocument(v, t)) },
      ]}
    >
      {/* Tapping the sheet opens the trip itself, to change driver, advance or dates. */}
      <RowCard onPress={v.outward || v.returnLeg ? () => legForm(v.outward ?? v.returnLeg, v.outward ? 'outward' : 'return') : undefined}>
        <RowHead title={`${t('fields.caseNo')} ${caseNo}`} end={<StatusBadge status={s.status} />} />
        <RouteLine from={h.from} to={h.to} />
        {(h.vehicle || h.broker) && (
          <ChipRow>
            {h.vehicle && <MetaChip icon="truck-outline" label={h.vehicle} />}
            {h.broker && <MetaChip icon="account-outline" label={h.broker} />}
          </ChipRow>
        )}
        <InfoGrid items={[
          { icon: 'arrow-top-right', label: t('trip.market'), value: load(h.market) },
          { icon: 'arrow-bottom-left', label: t('trip.returnLoad'), value: load(h.returnLoad) },
          { icon: 'steering', label: t('fields.driver'), value: h.driver },
          { icon: 'cash-fast', label: t('fields.advance'), value: h.advance === null ? null : formatPKR(h.advance) },
        ]} />
      </RowCard>

      <SectionTitle title={t('trip.expenses')} action={t('actions.add')} onAction={() => router.push({ pathname: '/trips/expense', params: { caseId: id } })} />
      {v.expenses.length === 0 && <T color={colors.muted}>{t('trip.noExpenses')}</T>}
      {v.expenses.map((e) => {
        const rate = ratePerUnit(e.amount, e.quantity);
        const details = [
          e.vendor,
          e.slip_no && `${t('fields.slipNo')} ${e.slip_no}`,
          e.quantity && `${e.quantity} ${t('fields.litres')}`,
          rate !== null && `${t('fields.rate')} ${formatPKR(rate)}`,
        ].filter(Boolean).join('  |  ');
        return (
          <RowCard key={e.id} onPress={() => router.push({ pathname: '/trips/expense', params: { caseId: id, id: e.id } })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconWell icon={expenseIcon(e.category)} tone="grey" />
              <View style={{ flex: 1 }}>
                <T variant="bodyStrong" numberOfLines={1}>{e.category}</T>
                {details !== '' && <T variant="small" color={colors.muted} numberOfLines={2}>{details}</T>}
              </View>
              <T variant="amount">{formatPKR(e.amount)}</T>
            </View>
          </RowCard>
        );
      })}
      {v.bills.filter((b) => b.count_in_profit).map((b) => (
        <RowCard key={b.id} onPress={() => router.push(`/bills/${b.id}`)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconWell icon="receipt-text-outline" tone="grey" />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="bodyStrong" numberOfLines={1}>{b.vendor}</T>
              <Badge tone="good" label={t('trip.countedInProfit')} />
            </View>
            <T variant="amount">{formatPKR(b.total)}</T>
          </View>
        </RowCard>
      ))}

      <SummaryCard
        rows={[
          { label: t('trip.outwardFreight'), value: formatPKR(st.outwardFreight) },
          { label: t('trip.returnFreight'), value: formatPKR(st.returnFreight) },
          { label: t('trip.cycleFreight'), value: formatPKR(st.freight) },
          { label: t('report.totalExpenses'), value: `- ${formatPKR(st.expenses)}`, tone: 'bad' },
        ]}
        headline={{ label: t('trip.net'), value: formatPKR(s.profit), tone: s.profit < 0 ? 'bad' : undefined }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Badge tone={s.confirmed ? 'good' : 'warn'} label={t(s.confirmed ? 'trip.confirmed' : 'trip.provisional')} />
          {!s.confirmed && <T variant="small" color="#AEB5AC" style={{ flex: 1 }}>{t('trip.notConfirmed')}</T>}
        </View>
      </SummaryCard>
      {v.ada.length > 0 && (
        <RowCard footer={<MoneyStrip items={[
          { label: t('trip.received'), value: st.received, tone: 'good' },
          { label: t('trip.balance'), value: st.balance, tone: st.balance > 0 ? 'bad' : undefined },
        ]} />}>
          <PayProgress due={st.received + st.balance} received={st.received} />
        </RowCard>
      )}
      <Button tone="plain" icon="microsoft-excel" label={t('trip.shareSheet')} onPress={() => run(() => shareTextFile(`trip-sheet-${caseNo}.csv`, caseSheetCsv(v, t), 'text/csv'))} />

      {s.freightMismatch && (
        <Banner text={t('trip.mismatch', { trip: formatPKR(v.caseRow.cycle_freight), ada: formatPKR(v.ada.reduce((n, a) => n + a.freight_rate, 0)) })} />
      )}

      {!s.confirmed && (
        s.status === 'ready'
          ? <Button icon="check-decagram-outline" label={t('trip.markComplete')} onPress={complete} />
          : <Banner tone="info" icon="information-outline" text={t('trip.needBoth')} />
      )}
      {s.confirmed && <Button tone="plain" icon="lock-open-outline" label={t('trip.reopen')} onPress={reopen} />}

      <SectionTitle title={t('trip.adaFiles')} />
      <AdaFileCard direction="outward" entries={v.adaOutward} caseNo={caseNo} />
      <AdaFileCard direction="return" entries={v.adaReturn} caseNo={caseNo} />

      {v.bills.some((b) => !b.count_in_profit) && <SectionTitle title={t('trip.linkedBills')} />}
      {v.bills.filter((b) => !b.count_in_profit).map((b) => (
        <Card key={b.id} onPress={() => router.push(`/bills/${b.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
            <T variant="bodyStrong" style={{ flexShrink: 1 }}>{b.vendor}</T>
            <T variant="amount">{formatPKR(b.total)}</T>
          </View>
          <Badge tone="info" label={t('trip.notCounted')} />
        </Card>
      ))}

      {v.adjustments.length > 0 && <SectionTitle title={t('trip.manualEntries')} />}
      {v.adjustments.map((j) => (
        <Card key={j.id} onPress={() => router.push({ pathname: '/parties/adjustment', params: { partyId: j.party_id, id: j.id } })}>
          <Line label={`${j.party_name} (${t(`ledger.${j.kind}`)})`} value={formatPKR(j.amount)} strong />
        </Card>
      ))}

      {v.outward && <DeleteLeg label={t('trip.outwardTrip')} leg={v.outward} after={reload} />}
      {v.returnLeg && <DeleteLeg label={t('trip.returnTrip')} leg={v.returnLeg} after={reload} />}
      <History recordId={id} record={() => caseDocument(v, t)} />
    </Screen>
  );
}

function DeleteLeg({ label, leg, after }: { label: string; leg: Leg; after: () => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <T variant="small" color={colors.muted}>{label}</T>
      <DeleteButton table="trip_legs" id={leg.id} after={after} />
    </View>
  );
}

/** A recognisable mark for the common expense types, in English or Urdu. */
function expenseIcon(category: string): IconName {
  const c = category.toLowerCase();
  if (c.includes('diesel') || c.includes('ڈیزل')) return 'gas-station-outline';
  if (c.includes('oil') || c.includes('آئل')) return 'oil';
  if (c.includes('peshgi') || c.includes('پیشگی')) return 'cash-fast';
  if (c.includes('toll') || c.includes('ٹول')) return 'boom-gate-outline';
  if (c.includes('load') || c.includes('لوڈ')) return 'dolly';
  if (c.includes('bilty') || c.includes('بلٹی')) return 'file-document-outline';
  if (c.includes('broker') || c.includes('بروکر')) return 'account-tie-outline';
  return 'receipt-text-outline';
}
