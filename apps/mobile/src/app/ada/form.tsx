import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { adaAmounts, dihariAmount, type AdjustMode, type Direction } from '../../domain/calc';
import { today } from '../../domain/dates';
import { referenceKey } from '../../domain/keys';
import { formatPKR, moneyToInput, parseMoney } from '../../domain/money';
import { AppError } from '../../db/core';
import { createAda, existingAdaForCaseNo, getAda, updateAda } from '../../repo/ada';
import { partyNames } from '../../repo/parties';
import { useApp, useData } from '../../ui/context';
import { AutoBox, Banner, Button, Chips, DateField, Field, MoneyField, SuggestField, SummaryCard, goBack } from '../../ui/controls';
import { FieldRow, FormSection, ReceiptLine } from '../../ui/rows';
import { useDialog } from '../../ui/dialog';
import { moneyOrNull, moneyOrZero, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';

/** Blank is no days; anything else must be a whole number. */
function daysOrNull(text: string): number | null {
  if (text.trim() === '') return null;
  const days = Number(text.trim());
  if (!Number.isInteger(days) || days < 0) throw new AppError('errors.invalidDays');
  return days;
}

export default function AdaForm() {
  const { db, t } = useApp();
  const { ask, toast } = useDialog();
  const { busy, run } = useAction();
  const params = useLocalSearchParams<{ id?: string; caseNo?: string; direction?: Direction }>();
  const { values: f, set, setValues } = useForm({
    caseNo: params.caseNo ?? '', direction: (params.direction ?? 'outward') as Direction, date: today(), vehicle: '', weight: '', from: '', to: '', empty: '', party: '',
    freight: '', commission: '',
    mt: '', mtMode: 'add' as AdjustMode, dihariDays: '', dihariRate: '', dihariMode: 'add' as AdjustMode, received: '',
  });
  const [loaded, setLoaded] = useState(!params.id);
  const [original, setOriginal] = useState({ caseNo: '', direction: 'outward' as Direction });
  const [receiptCount, setReceiptCount] = useState(0);
  const { data: parties } = useData(partyNames);

  useEffect(() => {
    if (!params.id) return;
    getAda(db, params.id).then((a) => {
      if (!a) return;
      setValues({
        caseNo: a.case_no, direction: a.direction, date: a.entry_date, vehicle: a.vehicle ?? '', weight: a.weight ?? '', from: a.from_place ?? '', to: a.to_place ?? '',
        empty: a.empty ?? '', party: a.party_name ?? '', freight: moneyToInput(a.freight_rate),
        // Commission is a fixed amount now; an older percent entry opens with its worked-out amount.
        commission: moneyToInput(a.commission),
        mt: a.mt_amount ? moneyToInput(a.mt_amount) : '', mtMode: a.mt_mode,
        dihariDays: a.dihari_days === null ? '' : String(a.dihari_days), dihariRate: moneyToInput(a.dihari_rate), dihariMode: a.dihari_mode,
        received: a.received ? moneyToInput(a.received) : '',
      });
      setOriginal({ caseNo: a.case_no, direction: a.direction });
      setReceiptCount(a.receipt_count);
      setLoaded(true);
    });
  }, [db, params.id, setValues]);

  // A new return file starts from the outward file of the same Case #, with the route reversed.
  useEffect(() => {
    if (params.id || f.direction !== 'return' || !f.caseNo.trim()) return;
    let current = true;
    existingAdaForCaseNo(db, f.caseNo, 'outward').then(([out]) => {
      if (!current || !out) return;
      setValues((v) => ({
        ...v,
        vehicle: v.vehicle || (out.vehicle ?? ''), party: v.party || (out.party_name ?? ''),
        from: v.from || (out.to_place ?? ''), to: v.to || (out.from_place ?? ''),
      }));
    });
    return () => { current = false; };
  }, [db, f.caseNo, f.direction, params.id, setValues]);

  const receivedEditable = receiptCount <= 1;

  const preview = useMemo(() => {
    const value = parseMoney(f.commission) ?? 0;
    const days = f.dihariDays.trim() === '' ? null : Number(f.dihariDays);
    const dihari = dihariAmount(days === null || Number.isInteger(days) ? days : 0, parseMoney(f.dihariRate));
    const amounts = adaAmounts({
      freight: parseMoney(f.freight) ?? 0, commissionType: 'fixed', commissionValue: value,
      mt: parseMoney(f.mt) ?? 0, mtMode: f.mtMode, dihari, dihariMode: f.dihariMode, received: parseMoney(f.received) ?? 0,
    });
    return { ...amounts, dihari };
  }, [f.freight, f.commission, f.mt, f.mtMode, f.dihariDays, f.dihariRate, f.dihariMode, f.received]);

  const save = () => run(async () => {
    let commissionValue = 0;
    if (f.commission.trim()) {
      const parsed = parseMoney(f.commission);
      if (parsed === null) throw new AppError('errors.invalidAmount');
      commissionValue = parsed;
    }
    const input = {
      caseNo: f.caseNo, direction: f.direction, entryDate: f.date, vehicle: f.vehicle, weight: f.weight, fromPlace: f.from, toPlace: f.to, empty: f.empty, partyName: f.party,
      freightRate: moneyOrZero(f.freight), commissionType: 'fixed' as const, commissionValue,
      mtAmount: moneyOrZero(f.mt), mtMode: f.mtMode, dihariDays: daysOrNull(f.dihariDays), dihariRate: moneyOrNull(f.dihariRate), dihariMode: f.dihariMode,
      received: receivedEditable ? moneyOrZero(f.received) : undefined,
    };
    // Moving an entry onto another Case # or direction needs the same warning as creating one there.
    const moved = referenceKey(f.caseNo) !== referenceKey(original.caseNo) || f.direction !== original.direction;
    if (referenceKey(f.caseNo) && moved) {
      const existing = await existingAdaForCaseNo(db, f.caseNo, f.direction, params.id);
      if (existing.length > 0) {
        const choice = await ask({
          title: t('ada.dupTitle'), message: t('ada.dupMessage'),
          actions: [
            { label: t('actions.openExisting'), value: 'open', tone: 'primary' },
            { label: t('actions.saveLinked'), value: 'save', tone: 'plain' },
            { label: t('actions.cancel'), value: 'cancel', tone: 'plain' },
          ],
        });
        if (choice === 'open') {
          router.replace(`/ada/${existing[0].id}`);
          return;
        }
        if (choice !== 'save') return;
      }
    }
    if (params.id) {
      await updateAda(db, params.id, input);
      toast(t('settings.saved'));
      goBack();
      return;
    }
    const id = await createAda(db, input);
    toast(t('settings.saved'));
    router.replace(`/ada/${id}`);
  });

  const modeOptions = [{ value: 'add' as const, label: t('adjust.add') }, { value: 'deduct' as const, label: t('adjust.deduct') }];

  return (
    <Screen
      title={params.id ? t('actions.edit') : `${t('actions.add')}: ${t('add.ada')}`}
      subtitle={t('modules.ada')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy || !loaded} />}
      sectioned
    >
      <FormSection title={t('form.trip')} icon="truck-outline">
      <Field required caps label={t('fields.caseNo')} value={f.caseNo} onChange={set('caseNo')} testID="caseNo" />
      <Chips label={t('fields.adaDirection')} value={f.direction} onChange={set('direction')}
        options={[{ value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <SuggestField label={t('fields.broker')} value={f.party} onChange={set('party')} suggestions={parties ?? []} />
      <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
      <FieldRow>
        <Field label={t('fields.from')} value={f.from} onChange={set('from')} />
        <Field label={t('fields.to')} value={f.to} onChange={set('to')} />
      </FieldRow>
      <FieldRow>
        <Field label={t('fields.weight')} value={f.weight} onChange={set('weight')} />
        <Field label={t('fields.empty')} value={f.empty} onChange={set('empty')} />
      </FieldRow>
      </FormSection>

      <FormSection title={t('fields.freight')} icon="cash-multiple">
      <FieldRow>
        <MoneyField label={t('fields.freightRate')} value={f.freight} onChange={set('freight')} />
        <MoneyField label={t('fields.commission')} value={f.commission} onChange={set('commission')} />
      </FieldRow>
      <AutoBox label={t('fields.net')} value={formatPKR(preview.net)} />
      </FormSection>

      <FormSection title={t('form.extras')} icon="plus-minus-variant">
      <MoneyField label={t('fields.mtAmount')} value={f.mt} onChange={set('mt')} />
      <Chips label={`${t('fields.mt')}: ${t('adjust.label')}`} value={f.mtMode} onChange={set('mtMode')} options={modeOptions} />

      <FieldRow>
        <Field label={t('fields.dihariDays')} value={f.dihariDays} onChange={set('dihariDays')} keyboard="number-pad" />
        <MoneyField label={t('fields.dihariRate')} value={f.dihariRate} onChange={set('dihariRate')} />
      </FieldRow>
      {preview.dihari > 0 && <AutoBox label={t('fields.dihariTotal')} value={formatPKR(preview.dihari)} />}
      <Chips label={`${t('fields.dihariTotal')}: ${t('adjust.label')}`} value={f.dihariMode} onChange={set('dihariMode')} options={modeOptions} />
      </FormSection>

      <FormSection title={t('form.payment')} icon="wallet-outline">

      <View>
        <ReceiptLine label={t('fields.freightRate')} value={parseMoney(f.freight) ?? 0} />
        <ReceiptLine label={t('fields.commission')} value={preview.commission} sign="-" />
        <ReceiptLine label={t('fields.mt')} value={parseMoney(f.mt) ?? 0} sign={f.mtMode === 'deduct' ? '-' : '+'} />
        <ReceiptLine label={t('fields.dihariTotal')} value={preview.dihari} sign={f.dihariMode === 'deduct' ? '-' : '+'} />
        <ReceiptLine label={t('fields.due')} value={preview.due} total />
      </View>
      {receivedEditable
        ? <MoneyField label={t('fields.received')} value={f.received} onChange={set('received')} />
        : <>
            <AutoBox label={t('fields.received')} value={formatPKR(parseMoney(f.received) ?? 0)} tone="good" />
            <Banner tone="info" icon="information-outline" text={t('ada.severalReceipts')} />
          </>}
      </FormSection>
      <SummaryCard
        rows={[{ label: t('fields.received'), value: formatPKR(parseMoney(f.received) ?? 0), tone: 'good' }]}
        headline={{ label: t('fields.balance'), value: formatPKR(preview.balance), tone: preview.balance > 0 ? 'bad' : undefined }}
      />
    </Screen>
  );
}
