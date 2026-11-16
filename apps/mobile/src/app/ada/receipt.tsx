import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { today } from '../../domain/dates';
import { moneyToInput } from '../../domain/money';
import { addReceipt, getAda, updateReceipt, type Receipt } from '../../repo/ada';
import { findManualPaymentOnCase } from '../../repo/parties';
import { useApp } from '../../ui/context';
import { Button, DateField, Field, MoneyField, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { moneyOrZero, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { DeleteButton } from '../../ui/shared';

export default function ReceiptForm() {
  const { adaId, id } = useLocalSearchParams<{ adaId: string; id?: string }>();
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ amount: '', date: today(), note: '' });

  useEffect(() => {
    if (!id) return;
    db.get<Receipt>('SELECT * FROM ada_receipts WHERE id = ?', [id]).then((r) => {
      if (r) setValues({ amount: moneyToInput(r.amount), date: r.receipt_date, note: r.note ?? '' });
    });
  }, [db, id, setValues]);

  const save = () => run(async () => {
    const amount = moneyOrZero(f.amount);
    if (id) {
      await updateReceipt(db, id, amount, f.date, f.note);
    } else {
      const entry = await getAda(db, adaId);
      if (entry && amount > 0 && (await findManualPaymentOnCase(db, entry.case_id, amount))) {
        const ok = await confirm(t('party.doubleTitle'), t('party.doubleReceiptMessage'), t('actions.saveAnyway'), 'danger');
        if (!ok) return;
      }
      await addReceipt(db, adaId, amount, f.date, f.note);
    }
    toast(t('settings.saved'));
    goBack();
  });

  return (
    <Screen title={id ? t('actions.edit') : t('ada.addReceipt')} subtitle={t('modules.ada')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <Field multiline label={t('fields.note')} value={f.note} onChange={set('note')} />
      {id && <DeleteButton table="ada_receipts" id={id} />}
    </Screen>
  );
}
