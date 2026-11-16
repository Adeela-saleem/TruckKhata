import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { sum } from '../../domain/calc';
import { today } from '../../domain/dates';
import { formatPKR, moneyToInput, parseMoney } from '../../domain/money';
import { getBill, saveBill, vendorNames } from '../../repo/bills';
import { useApp, useData } from '../../ui/context';
import { AutoBox, Button, Card, DateField, Field, MoneyField, SuggestField, Toggle, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { moneyOrZero, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { colors, space } from '../../ui/theme';

type LineDraft = { description: string; quantity: string; unit: string; amount: string };
const blank: LineDraft = { description: '', quantity: '', unit: '', amount: '' };

export default function BillForm() {
  const params = useLocalSearchParams<{ id?: string; caseNo?: string }>();
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ date: today(), vendor: '', vehicle: '', caseNo: params.caseNo ?? '', paid: '', notes: '', count: false });
  const [lines, setLines] = useState<LineDraft[]>([blank]);
  const { data: vendors } = useData(vendorNames);

  useEffect(() => {
    if (!params.id) return;
    getBill(db, params.id).then((b) => {
      if (!b) return;
      setValues({ date: b.bill_date, vendor: b.vendor, vehicle: b.vehicle ?? '', caseNo: b.case_no ?? '', paid: moneyToInput(b.paid), notes: b.notes ?? '', count: !!b.count_in_profit });
      setLines(b.lines.map((l) => ({ description: l.description, quantity: l.quantity ?? '', unit: l.unit ?? '', amount: moneyToInput(l.amount) })));
    });
  }, [db, params.id, setValues]);

  const total = useMemo(() => sum(lines.map((l) => parseMoney(l.amount))), [lines]);
  const change = (index: number, patch: Partial<LineDraft>) => setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const save = () => run(async () => {
    const id = await saveBill(db, {
      date: f.date, vendor: f.vendor, vehicle: f.vehicle, caseNo: f.caseNo, paid: moneyOrZero(f.paid), notes: f.notes, countInProfit: f.count,
      lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, amount: moneyOrZero(l.amount) })),
    }, params.id);
    toast(t('settings.saved'));
    if (params.id) goBack();
    else router.replace(`/bills/${id}`);
  });

  return (
    <Screen title={params.id ? t('actions.edit') : `${t('actions.add')}: ${t('add.bill')}`} subtitle={t('modules.bills')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <SuggestField required label={t('fields.vendor')} value={f.vendor} onChange={set('vendor')} suggestions={vendors ?? []} />
      <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
      <Field caps label={t('fields.caseOptional')} value={f.caseNo} onChange={set('caseNo')} />
      {lines.map((line, i) => (
        <Card key={i}>
          <View style={{ gap: space.sm }}>
            <Field required label={t('fields.itemName')} value={line.description} onChange={(description) => change(i, { description })} />
            <MoneyField required label={t('fields.amount')} value={line.amount} onChange={(amount) => change(i, { amount })} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Field label={t('fields.quantity')} value={line.quantity} onChange={(quantity) => change(i, { quantity })} keyboard="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('fields.unit')} value={line.unit} onChange={(unit) => change(i, { unit })} /></View>
            </View>
            {lines.length > 1 && (
              <Pressable accessibilityRole="button" accessibilityLabel={t('actions.remove')} onPress={() => setLines(lines.filter((_, x) => x !== i))} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
                <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.crimson} />
              </Pressable>
            )}
          </View>
        </Card>
      ))}
      <Button tone="quiet" icon="plus" label={t('actions.addLine')} onPress={() => setLines([...lines, blank])} />
      <AutoBox label={t('fields.total')} value={formatPKR(total)} />
      <MoneyField label={t('fields.paid')} value={f.paid} onChange={set('paid')} />
      <AutoBox label={t('fields.balance')} value={formatPKR(total - (parseMoney(f.paid) ?? 0))} tone={total - (parseMoney(f.paid) ?? 0) > 0 ? 'bad' : undefined} />
      <Field multiline label={t('fields.notes')} value={f.notes} onChange={set('notes')} />
      {f.caseNo.trim() !== '' && <Toggle label={t('bill.countLabel')} hint={t('bill.countHint')} value={f.count} onChange={set('count')} />}
    </Screen>
  );
}
