import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { adaDocument } from '../../print/documents';
import { getAda, listReceipts } from '../../repo/ada';
import { useApp, useData } from '../../ui/context';
import { Button, Empty, SectionTitle, SummaryCard } from '../../ui/controls';
import { DirectionPill, IconWell, InfoGrid, Panel, ReceiptLine, RouteLine, RowCard } from '../../ui/rows';
import { Screen } from '../../ui/screen';
import { DeleteButton, History, usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

export default function AdaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useApp();
  const print = usePrint();
  const { data } = useData(async (db) => {
    const entry = await getAda(db, id);
    const receipts = entry ? await listReceipts(db, id) : [];
    const hasTrip = entry ? (await db.get('SELECT 1 FROM trip_legs WHERE case_id = ? AND deleted_at IS NULL', [entry.case_id])) !== null : false;
    return { entry, receipts, hasTrip };
  }, [id]);
  const a = data?.entry;

  if (data && (!a || a.deleted_at)) {
    return <Screen title={t('modules.ada')}><Empty title={t('errors.notFound')} /></Screen>;
  }
  if (!a) return <Screen title={t('modules.ada')}>{null}</Screen>;

  return (
    <Screen
      title={a.case_no}
      subtitle={t('modules.ada')}
      actions={[
        { icon: 'printer-outline', label: t('actions.print'), onPress: () => print(() => adaDocument(a, data?.receipts ?? [], t)) },
        { icon: 'pencil-outline', label: t('actions.edit'), onPress: () => router.push({ pathname: '/ada/form', params: { id } }) },
      ]}
    >
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <DirectionPill direction={a.direction} label={t(`direction.${a.direction}`)} />
          <T variant="small" color={colors.muted}>{formatDate(a.entry_date)}</T>
        </View>
        <RouteLine from={a.from_place} to={a.to_place} />
        <InfoGrid items={[
          { icon: 'account-outline', label: t('fields.broker'), value: a.party_name },
          { icon: 'truck-outline', label: t('fields.vehicle'), value: a.vehicle },
          { icon: 'weight', label: t('fields.weight'), value: a.weight },
          { icon: 'package-variant', label: t('fields.empty'), value: a.empty },
          { icon: 'note-text-outline', label: t('fields.emptyMt'), value: a.empty_mt },
          { icon: 'note-text-outline', label: t('fields.dihari'), value: a.dihari },
        ]} />
      </Panel>
      <Panel title={t('fields.freight')}>
        <View>
          <ReceiptLine label={t('fields.freightRate')} value={a.freight_rate} />
          <ReceiptLine label={t('fields.commission')} value={a.commission} sign="-" />
          <ReceiptLine label={t('fields.net')} value={a.net} total />
          {a.mt_amount > 0 && <ReceiptLine label={`${t('fields.mt')} (${t(`adjust.${a.mt_mode}`)})`} value={a.mt_amount} sign={a.mt_mode === 'deduct' ? '-' : '+'} />}
          {a.dihari_total > 0 && (
            <ReceiptLine
              label={`${t('fields.dihariTotal')}${a.dihari_days === null ? '' : `: ${a.dihari_days} x ${formatPKR(a.dihari_rate)}`}`}
              value={a.dihari_total} sign={a.dihari_mode === 'deduct' ? '-' : '+'}
            />
          )}
          {(a.mt_amount > 0 || a.dihari_total > 0) && <ReceiptLine label={t('fields.due')} value={a.due} total />}
        </View>
      </Panel>
      <SummaryCard
        rows={[{ label: t('fields.due'), value: formatPKR(a.due) }, { label: t('fields.received'), value: formatPKR(a.received), tone: 'good' }]}
        headline={{ label: t('fields.balance'), value: formatPKR(a.balance), tone: a.balance > 0 ? 'bad' : undefined }}
      />

      <Button icon="pencil-outline" label={t('ada.editEntry')} onPress={() => router.push({ pathname: '/ada/form', params: { id } })} />

      <SectionTitle title={t('ada.receipts')} action={t('actions.add')} onAction={() => router.push({ pathname: '/ada/receipt', params: { adaId: id } })} />
      {(data?.receipts ?? []).map((r) => (
        <RowCard key={r.id} onPress={() => router.push({ pathname: '/ada/receipt', params: { adaId: id, id: r.id } })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconWell icon="cash-check" tone="green" />
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">{formatDate(r.receipt_date)}</T>
              {r.note && <T variant="small" color={colors.muted} numberOfLines={2}>{r.note}</T>}
            </View>
            <T variant="amount" color={colors.emerald}>{`+ ${formatPKR(r.amount)}`}</T>
          </View>
        </RowCard>
      ))}

      <Button
        tone="quiet" icon="truck-fast-outline" label={data?.hasTrip ? t('ada.openTrip') : t('ada.addTrip')}
        onPress={() => (data?.hasTrip ? router.push(`/case/${a.case_id}`) : router.push({ pathname: '/trips/form', params: { caseNo: a.case_no } }))}
      />
      <DeleteButton table="ada_entries" id={id} />
      <History recordId={id} record={() => adaDocument(a, data?.receipts ?? [], t)} />
    </Screen>
  );
}
