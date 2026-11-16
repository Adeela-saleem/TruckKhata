import { router, useLocalSearchParams } from 'expo-router';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { billDocument } from '../../print/documents';
import { getBill } from '../../repo/bills';
import { useApp, useData } from '../../ui/context';
import { AutoBox, Badge, Button, Card, Empty, Line, SectionTitle } from '../../ui/controls';
import { Screen } from '../../ui/screen';
import { DeleteButton, History, usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export default function BillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useApp();
  const print = usePrint();
  const { data: b } = useData((db) => getBill(db, id), [id]);
  if (!b) return <Screen title={t('modules.bills')}>{null}</Screen>;
  if (b.deleted_at) return <Screen title={t('modules.bills')}><Empty title={t('errors.notFound')} /></Screen>;
  return (
    <Screen
      title={b.vendor}
      subtitle={t('modules.bills')}
      actions={[
        { icon: 'printer-outline', label: t('actions.print'), onPress: () => print(() => billDocument(b, t)) },
        { icon: 'pencil-outline', label: t('actions.edit'), onPress: () => router.push({ pathname: '/bills/form', params: { id } }) },
      ]}
    >
      <Card>
        <Line label={t('fields.date')} value={formatDate(b.bill_date)} />
        {b.vehicle && <Line label={t('fields.vehicle')} value={b.vehicle} />}
        {b.case_no && <Line label={t('fields.caseNo')} value={b.case_no} />}
        {b.notes && <T variant="small" color={colors.muted}>{b.notes}</T>}
      </Card>
      <SectionTitle title={t('bill.lines')} />
      {b.lines.map((l) => (
        <Card key={l.id}>
          <Line label={[l.description, l.quantity, l.unit].filter(Boolean).join('  ')} value={formatPKR(l.amount)} strong />
        </Card>
      ))}
      <AutoBox label={t('fields.total')} value={formatPKR(b.total)} />
      <AutoBox label={t('fields.paid')} value={formatPKR(b.paid)} tone="good" />
      <AutoBox label={t('fields.balance')} value={formatPKR(b.balance)} tone={b.balance > 0 ? 'bad' : undefined} />
      {b.case_id && <Badge tone={b.count_in_profit ? 'good' : 'info'} label={t(b.count_in_profit ? 'trip.countedInProfit' : 'trip.notCounted')} />}
      {b.case_id && <Button tone="quiet" icon="truck-fast-outline" label={t('bill.linkedCase')} onPress={() => router.push(`/case/${b.case_id}`)} />}
      <DeleteButton table="bills" id={id} />
      <History recordId={id} record={() => billDocument(b, t)} />
    </Screen>
  );
}
