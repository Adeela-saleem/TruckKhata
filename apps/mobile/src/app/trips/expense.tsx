import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { today } from '../../domain/dates';
import { formatPKR, moneyToInput, parseMoney } from '../../domain/money';
import { expenseCategories, getExpense, ratePerUnit, saveExpense } from '../../repo/cases';
import { useApp, useData } from '../../ui/context';
import { AutoBox, Button, Chips, DateField, Field, MoneyField, SuggestField, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { moneyOrZero, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { DeleteButton, History } from '../../ui/shared';

/** The rows printed on the paper trip sheet, offered as one-tap choices. */
const common = ['diesel', 'oil', 'peshgi', 'bilty', 'loading', 'unloading', 'broker', 'toll'] as const;

export default function ExpenseForm() {
  const { caseId, id } = useLocalSearchParams<{ caseId: string; id?: string }>();
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ category: '', description: '', amount: '', date: today(), vendor: '', slipNo: '', quantity: '', notes: '' });
  const { data: categories } = useData(expenseCategories);

  useEffect(() => {
    if (!id) return;
    getExpense(db, id).then((e) => e && setValues({
      category: e.category, description: e.description ?? '', amount: moneyToInput(e.amount), date: e.expense_date, vendor: e.vendor ?? '',
      slipNo: e.slip_no ?? '', quantity: e.quantity ?? '', notes: e.notes ?? '',
    }));
  }, [db, id, setValues]);

  const save = () => run(async () => {
    await saveExpense(db, {
      caseId, category: f.category, description: f.description, amount: moneyOrZero(f.amount), date: f.date, vendor: f.vendor,
      slipNo: f.slipNo, quantity: f.quantity, notes: f.notes,
    }, id);
    toast(t('settings.saved'));
    goBack();
  });

  const labels = common.map((key) => t(`expenseType.${key}`));
  const rate = ratePerUnit(parseMoney(f.amount) ?? 0, f.quantity);

  return (
    <Screen title={id ? t('actions.edit') : t('trip.addExpense')} subtitle={t('modules.trips')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <Chips label={t('trip.quickCategory')} value={labels.includes(f.category) ? f.category : null} onChange={set('category')}
        options={labels.map((label) => ({ value: label, label }))} />
      <SuggestField required label={t('fields.category')} value={f.category} onChange={set('category')} suggestions={categories ?? []} />
      <Field label={t('fields.station')} value={f.vendor} onChange={set('vendor')} />
      <Field caps label={t('fields.slipNo')} value={f.slipNo} onChange={set('slipNo')} />
      <Field label={t('fields.litres')} value={f.quantity} onChange={set('quantity')} keyboard="decimal-pad" />
      <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
      {rate !== null && <AutoBox label={t('fields.rate')} value={formatPKR(rate)} />}
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <Field label={t('fields.description')} value={f.description} onChange={set('description')} />
      <Field multiline label={t('fields.notes')} value={f.notes} onChange={set('notes')} />
      {id && <DeleteButton table="expenses" id={id} />}
      {id && <History recordId={id} />}
    </Screen>
  );
}
