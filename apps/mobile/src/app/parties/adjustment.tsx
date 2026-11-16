import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { today } from '../../domain/dates';
import { moneyToInput } from '../../domain/money';
import { findPossibleDoublePayment, recordPartyPayment, saveAdjustment, type Adjustment } from '../../repo/parties';
import { useApp } from '../../ui/context';
import { Banner, Button, Chips, DateField, Field, MoneyField, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { moneyOrZero, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { DeleteButton, History } from '../../ui/shared';

export default function AdjustmentForm() {
  const { partyId, id } = useLocalSearchParams<{ partyId: string; id?: string }>();
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ kind: 'payment' as Adjustment['kind'], amount: '', date: today(), caseNo: '', note: '' });

  useEffect(() => {
    if (!id) return;
    db.get<Adjustment>(
      'SELECT j.*, c.case_no FROM party_adjustments j LEFT JOIN cases c ON c.id = j.case_id WHERE j.id = ?', [id],
    ).then((j) => j && setValues({ kind: j.kind, amount: moneyToInput(j.amount), date: j.adj_date, caseNo: j.case_no ?? '', note: j.note ?? '' }));
  }, [db, id, setValues]);

  const save = () => run(async () => {
    const amount = moneyOrZero(f.amount);
    if (!id && f.kind === 'payment' && (await findPossibleDoublePayment(db, f.caseNo, amount))) {
      const ok = await confirm(t('party.doubleTitle'), t('party.doubleMessage'), t('actions.saveAnyway'), 'danger');
      if (!ok) return;
    }
    const input = { partyId, amount, date: f.date, note: f.note, caseNo: f.caseNo };
    if (!id && f.kind === 'payment') {
      const result = await recordPartyPayment(db, input);
      toast(result.linked ? t('party.paymentLinked', { caseNo: result.caseNo }) : t('settings.saved'));
    } else {
      await saveAdjustment(db, { ...input, kind: f.kind }, id);
      toast(t('settings.saved'));
    }
    goBack();
  });

  return (
    <Screen title={id ? t('actions.edit') : t('party.addManual')} subtitle={t('modules.parties')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <Banner tone="info" icon="information-outline" text={t('party.manualHint')} />
      <Chips label={t('party.manualKind')} value={f.kind} onChange={set('kind')}
        options={[{ value: 'payment', label: t('ledger.payment') }, { value: 'charge', label: t('ledger.charge') }]} />
      <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <Field caps label={t('fields.caseOptional')} value={f.caseNo} onChange={set('caseNo')} />
      <Field multiline label={t('fields.note')} value={f.note} onChange={set('note')} />
      {id && <DeleteButton table="party_adjustments" id={id} />}
      {id && <History recordId={id} />}
    </Screen>
  );
}
