import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { adaAmounts, dihariAmount, type AdjustMode, type Direction } from '../../core/domain/calc';
import { today } from '../../core/domain/dates';
import { referenceKey } from '../../core/domain/keys';
import { moneyToInput, parseMoney } from '../../core/domain/money';
import { AppError } from '../../core/db/core';
import { createAda, existingAdaForCaseNo, getAda, updateAda } from '../../core/repo/ada';
import { partyNames } from '../../core/repo/parties';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrNull, moneyOrZero, useAction, useForm } from '../../app/hooks';
import { Btn, Money, Note, SumLine } from '../../ui/bits';
import { AutoValue, Choice, DateField, Field, FormSection, MoneyField, SuggestField } from '../../ui/fields';
import { Page } from '../../ui/Page';

/** Blank is no days; anything else must be a whole number. */
function daysOrNull(text: string): number | null {
  if (text.trim() === '') return null;
  const days = Number(text.trim());
  if (!Number.isInteger(days) || days < 0) throw new AppError('errors.invalidDays');
  return days;
}

export default function AdaForm() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { ask, toast } = useDialog();
  const { busy, run } = useAction();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { values: f, set, setValues } = useForm({
    caseNo: params.get('caseNo') ?? '', direction: (params.get('direction') ?? 'outward') as Direction, date: today(),
    vehicle: '', weight: '', from: '', to: '', empty: '', party: '', freight: '', commission: '',
    mt: '', mtMode: 'add' as AdjustMode, dihariDays: '', dihariRate: '', dihariMode: 'add' as AdjustMode, received: '',
  });
  const [loaded, setLoaded] = useState(!id);
  const [original, setOriginal] = useState({ caseNo: '', direction: 'outward' as Direction });
  const [receiptCount, setReceiptCount] = useState(0);
  const { data: parties } = useData(partyNames);

  useEffect(() => {
    if (!id) return;
    getAda(db, id).then((a) => {
      if (!a) return;
      setValues({
        caseNo: a.case_no, direction: a.direction, date: a.entry_date, vehicle: a.vehicle ?? '', weight: a.weight ?? '', from: a.from_place ?? '', to: a.to_place ?? '',
        empty: a.empty ?? '', party: a.party_name ?? '', freight: moneyToInput(a.freight_rate),
        // Commission is a fixed amount now (client request); an older percent entry opens with its worked-out amount.
        commission: moneyToInput(a.commission),
        mt: a.mt_amount ? moneyToInput(a.mt_amount) : '', mtMode: a.mt_mode,
        dihariDays: a.dihari_days === null ? '' : String(a.dihari_days), dihariRate: moneyToInput(a.dihari_rate), dihariMode: a.dihari_mode,
        received: a.received ? moneyToInput(a.received) : '',
      });
      setOriginal({ caseNo: a.case_no, direction: a.direction });
      setReceiptCount(a.receipt_count);
      setLoaded(true);
    });
  }, [db, id, setValues]);

  // A new return file starts from the outward file of the same Case #, with the route reversed.
  useEffect(() => {
    if (id || f.direction !== 'return' || !f.caseNo.trim()) return;
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
  }, [db, f.caseNo, f.direction, id, setValues]);

  const receivedEditable = receiptCount <= 1;

  const preview = useMemo(() => {
    const days = f.dihariDays.trim() === '' ? null : Number(f.dihariDays);
    const dihari = dihariAmount(days === null || Number.isInteger(days) ? days : 0, parseMoney(f.dihariRate));
    const amounts = adaAmounts({
      freight: parseMoney(f.freight) ?? 0, commissionType: 'fixed', commissionValue: parseMoney(f.commission) ?? 0,
      mt: parseMoney(f.mt) ?? 0, mtMode: f.mtMode, dihari, dihariMode: f.dihariMode, received: parseMoney(f.received) ?? 0,
    });
    return { ...amounts, dihari };
  }, [f.freight, f.commission, f.mt, f.mtMode, f.dihariDays, f.dihariRate, f.dihariMode, f.received]);

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
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
        const existing = await existingAdaForCaseNo(db, f.caseNo, f.direction, id);
        if (existing.length > 0) {
          const choice = await ask({
            title: t('ada.dupTitle'), message: t('ada.dupMessage'),
            actions: [
              { label: t('actions.cancel'), value: 'cancel', tone: 'plain' },
              { label: t('actions.saveLinked'), value: 'save', tone: 'plain' },
              { label: t('actions.openExisting'), value: 'open', tone: 'primary' },
            ],
          });
          if (choice === 'open') { navigate(`/ada/${existing[0].id}`, { replace: true }); return; }
          if (choice !== 'save') return;
        }
      }
      if (id) {
        await updateAda(db, id, input);
        toast.success(t('web.saved'));
        navigate(`/ada/${id}`, { replace: true });
        return;
      }
      const newId = await createAda(db, input);
      toast.success(t('web.saved'));
      navigate(`/ada/${newId}`, { replace: true });
    });
  };

  const modeOptions = [{ value: 'add' as const, label: t('adjust.add') }, { value: 'deduct' as const, label: t('adjust.deduct') }];
  const saveButton = <Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy} disabled={!loaded}>{t('actions.save')}</Btn>;

  return (
    <Page title={id ? t('web.ada.editEntry') : t('web.ada.newEntry')} subtitle={t('modules.ada')}>
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5">
          <FormSection title={t('form.trip')}>
            <Field required caps label={t('fields.caseNo')} value={f.caseNo} onChange={set('caseNo')} autoFocus={!id} />
            <Choice label={t('fields.adaDirection')} value={f.direction} onChange={set('direction')}
              options={[{ value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
            <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
            <SuggestField label={t('fields.broker')} value={f.party} onChange={set('party')} suggestions={parties ?? []} />
            <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
            <Field label={t('fields.weight')} value={f.weight} onChange={set('weight')} />
            <Field label={t('fields.from')} value={f.from} onChange={set('from')} />
            <Field label={t('fields.to')} value={f.to} onChange={set('to')} />
            <Field label={t('fields.empty')} value={f.empty} onChange={set('empty')} />
          </FormSection>

          <FormSection title={t('fields.freight')}>
            <MoneyField label={t('fields.freightRate')} value={f.freight} onChange={set('freight')} />
            <MoneyField label={t('fields.commission')} value={f.commission} onChange={set('commission')} hint={t('fields.commissionFixed')} />
          </FormSection>

          <FormSection title={t('form.extras')} note={t('web.ada.extrasNote')}>
            <MoneyField label={t('fields.mtAmount')} value={f.mt} onChange={set('mt')} />
            <Choice label={`${t('fields.mt')}: ${t('adjust.label')}`} value={f.mtMode} onChange={set('mtMode')} options={modeOptions} />
            <Field label={t('fields.dihariDays')} value={f.dihariDays} onChange={set('dihariDays')} inputMode="numeric" />
            <MoneyField label={t('fields.dihariRate')} value={f.dihariRate} onChange={set('dihariRate')} />
            <AutoValue label={t('fields.dihariTotal')} value={`Rs ${(preview.dihari / 100).toLocaleString('en-US')}`} />
            <Choice label={`${t('fields.dihariTotal')}: ${t('adjust.label')}`} value={f.dihariMode} onChange={set('dihariMode')} options={modeOptions} />
          </FormSection>

          <FormSection title={t('form.payment')}>
            {receivedEditable
              ? <MoneyField label={t('fields.received')} value={f.received} onChange={set('received')} hint={!id ? t('ada.receivedHint') : undefined} />
              : <AutoValue label={t('fields.received')} value={`Rs ${((parseMoney(f.received) ?? 0) / 100).toLocaleString('en-US')}`} tone="good" />}
            {!receivedEditable && <div className="self-end"><Note>{t('ada.severalReceipts')}</Note></div>}
          </FormSection>
        </div>

        {/* The worked-out totals stay in view while typing. */}
        <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-4">
          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between card-head -mx-6 -mt-5 mb-4 px-6 py-4">
              <h2 className="card-title font-display text-[16px] text-content">{t('web.ada.calc')}</h2>
              <span className="text-[13px] text-content-subtle">{t('web.ada.calcNote')}</span>
            </div>
            <SumLine label={t('fields.freightRate')} value={parseMoney(f.freight) ?? 0} />
            <SumLine label={t('fields.commission')} value={preview.commission} sign="-" />
            <SumLine label={t('fields.net')} value={preview.net} total />
            <SumLine label={`${t('fields.mt')} (${t(`adjust.${f.mtMode}`)})`} value={parseMoney(f.mt) ?? 0} sign={f.mtMode === 'deduct' ? '-' : '+'} />
            <SumLine label={`${t('fields.dihariTotal')} (${t(`adjust.${f.dihariMode}`)})`} value={preview.dihari} sign={f.dihariMode === 'deduct' ? '-' : '+'} />
            <SumLine label={t('fields.due')} value={preview.due} total />
            <SumLine label={t('fields.received')} value={parseMoney(f.received) ?? 0} sign="-" tone="good" />
            <div className="mt-3 rounded-xl bg-surface-2 border border-line px-4 py-3 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold text-content">{t('fields.balance')}</span>
              <Money value={preview.balance} tone={preview.balance > 0 ? 'bad' : undefined} className="font-display text-[28px] font-semibold tracking-[-0.02em]" />
            </div>
            <p className="mt-3 text-[12px] text-content-subtle leading-relaxed">{t('ada.dueHint')}</p>
          </section>
          <div className="flex gap-2 justify-end">
            <Btn onClick={() => navigate(-1)}>{t('actions.cancel')}</Btn>
            {saveButton}
          </div>
        </aside>
      </form>
    </Page>
  );
}
