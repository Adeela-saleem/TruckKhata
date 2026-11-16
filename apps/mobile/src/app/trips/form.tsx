import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { today } from '../../domain/dates';
import { moneyToInput } from '../../domain/money';
import { findCaseByNo, getCaseView, getLeg, saveLeg, type Direction } from '../../repo/cases';
import { partyNames } from '../../repo/parties';
import { useApp, useData } from '../../ui/context';
import { Banner, Button, Chips, DateField, Field, MoneyField, SuggestField, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { moneyOrNull, useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';

export default function TripForm() {
  const params = useLocalSearchParams<{ id?: string; caseNo?: string; direction?: Direction }>();
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({
    caseNo: params.caseNo ?? '', direction: (params.direction ?? 'outward') as Direction, date: today(), vehicle: '', from: '', to: '',
    party: '', freight: '', driver: '', advance: '', weight: '', items: '',
  });
  const [freightFromAda, setFreightFromAda] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { data: parties } = useData(partyNames);

  useEffect(() => {
    if (!params.id) return;
    getLeg(db, params.id).then(async (l) => {
      if (!l) return;
      const view = await getCaseView(db, l.case_id);
      setIsComplete(view?.summary.confirmed ?? false);
      setValues({
        caseNo: l.case_no, direction: l.direction, date: l.trip_date, vehicle: l.vehicle ?? '', from: l.from_place ?? '', to: l.to_place ?? '', party: l.party_name ?? '',
        freight: moneyToInput(view?.caseRow.cycle_freight), driver: l.driver ?? '', advance: moneyToInput(l.advance), weight: l.weight ?? '', items: l.item_details ?? '',
      });
    });
  }, [db, params.id, setValues]);

  // A known Case # fills in what is already recorded, so the same details are not typed twice.
  useEffect(() => {
    if (params.id || !f.caseNo.trim()) return;
    let current = true;
    (async () => {
      const found = await findCaseByNo(db, f.caseNo);
      const view = found ? await getCaseView(db, found.id) : null;
      if (!current) return;
      const ada = view?.ada[0];
      const outward = view?.outward;
      const swap = f.direction === 'return' && outward;
      setFreightFromAda(!!ada);
      setValues((v) => ({
        ...v,
        vehicle: v.vehicle || (outward?.vehicle ?? ada?.vehicle ?? ''),
        party: v.party || (outward?.party_name ?? ada?.party_name ?? ''),
        from: v.from || ((swap ? outward?.to_place : outward?.from_place) ?? ada?.from_place ?? ''),
        to: v.to || ((swap ? outward?.from_place : outward?.to_place) ?? ada?.to_place ?? ''),
        driver: v.driver || (outward?.driver ?? ''),
        freight: v.freight || moneyToInput(view?.caseRow.cycle_freight ?? ada?.freight_rate),
      }));
    })();
    return () => { current = false; };
  }, [db, f.caseNo, f.direction, params.id, setValues]);

  const save = () => run(async () => {
    const caseId = await saveLeg(db, {
      caseNo: f.caseNo, direction: f.direction, date: f.date, vehicle: f.vehicle, fromPlace: f.from, toPlace: f.to, partyName: f.party, driver: f.driver,
      advance: moneyOrNull(f.advance), weight: f.weight, itemDetails: f.items, cycleFreight: moneyOrNull(f.freight),
    }, params.id);
    toast(t('settings.saved'));
    if (params.id) goBack();
    else router.replace(`/case/${caseId}`);
  });

  return (
    <Screen title={params.id ? t('actions.edit') : `${t('actions.add')}: ${t('add.trip')}`} subtitle={t('modules.trips')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      {isComplete && <Banner text={t('trip.editAfterComplete')} />}
      <Field required caps label={t('fields.caseNo')} value={f.caseNo} onChange={set('caseNo')} />
      <Chips label={t('fields.direction')} value={f.direction} onChange={set('direction')}
        options={[{ value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
      <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
      <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
      <Field label={t('fields.from')} value={f.from} onChange={set('from')} />
      <Field label={t('fields.to')} value={f.to} onChange={set('to')} />
      <SuggestField label={t('fields.party')} value={f.party} onChange={set('party')} suggestions={parties ?? []} />
      <MoneyField label={t('fields.cycleFreight')} value={f.freight} onChange={set('freight')} hint={freightFromAda ? t('trip.freightFromAda') : undefined} />
      <Field label={t('fields.driver')} value={f.driver} onChange={set('driver')} />
      <MoneyField label={t('fields.advance')} value={f.advance} onChange={set('advance')} />
      <Field label={t('fields.weight')} value={f.weight} onChange={set('weight')} />
      <Field multiline label={t('fields.itemDetails')} value={f.items} onChange={set('items')} />
    </Screen>
  );
}
