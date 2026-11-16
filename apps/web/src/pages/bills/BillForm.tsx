import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import { sum } from '../../core/domain/calc';
import { today } from '../../core/domain/dates';
import { moneyToInput, parseMoney } from '../../core/domain/money';
import { getBill, saveBill, vendorNames } from '../../core/repo/bills';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrZero, useAction, useForm } from '../../app/hooks';
import { Toggle } from '../../components/ui/Toggle';
import { cn } from '../../components/ui/cn';
import { Btn, Money, SumLine } from '../../ui/bits';
import { DateField, Field, FormSection, MoneyField, SuggestField, TextArea } from '../../ui/fields';
import { Page } from '../../ui/Page';

type LineDraft = { key: number; description: string; quantity: string; unit: string; amount: string };

let nextKey = 1;
const blank = (): LineDraft => ({ key: nextKey++, description: '', quantity: '', unit: '', amount: '' });

const cell = 'noir-input w-full h-11 px-3 rounded-xl text-[15px] text-content placeholder:text-content-subtle focus:outline-none';

export default function BillForm() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { values: f, set, setValues } = useForm({
    date: today(), vendor: '', vehicle: params.get('vehicle') ?? '', caseNo: params.get('caseNo') ?? '', paid: '', notes: '', count: false,
  });
  const [lines, setLines] = useState<LineDraft[]>(() => [blank()]);
  const [loaded, setLoaded] = useState(!id);
  const { data: vendors } = useData(vendorNames);

  useEffect(() => {
    if (!id) return;
    getBill(db, id).then((b) => {
      if (b) {
        setValues({ date: b.bill_date, vendor: b.vendor, vehicle: b.vehicle ?? '', caseNo: b.case_no ?? '', paid: b.paid ? moneyToInput(b.paid) : '', notes: b.notes ?? '', count: !!b.count_in_profit });
        setLines(b.lines.length
          ? b.lines.map((l) => ({ key: nextKey++, description: l.description, quantity: l.quantity ?? '', unit: l.unit ?? '', amount: moneyToInput(l.amount) }))
          : [blank()]);
      }
      setLoaded(true);
    });
  }, [db, id, setValues]);

  const hasCase = f.caseNo.trim() !== '';
  // Counting in trip profit needs a Case #; clearing the Case # clears the switch.
  useEffect(() => { if (!hasCase && f.count) set('count')(false); }, [hasCase, f.count, set]);

  const total = useMemo(() => sum(lines.map((l) => parseMoney(l.amount))), [lines]);
  const paid = parseMoney(f.paid) ?? 0;
  const balance = total - paid;
  const filled = lines.filter((l) => l.description.trim() || parseMoney(l.amount)).length;
  const change = (key: number, patch: Partial<LineDraft>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const saved = await saveBill(db, {
        date: f.date, vendor: f.vendor, vehicle: f.vehicle, caseNo: f.caseNo, paid: moneyOrZero(f.paid), notes: f.notes, countInProfit: f.count,
        lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, amount: moneyOrZero(l.amount) })),
      }, id);
      toast.success(t('web.saved'));
      navigate(`/bills/${saved}`, { replace: true });
    });
  };

  return (
    <Page title={id ? t('web.bills.editBill') : t('web.bills.newBill')} subtitle={t('modules.bills')}>
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
          <FormSection title={t('web.bills.details')}>
            <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
            <SuggestField required label={t('fields.vendor')} value={f.vendor} onChange={set('vendor')} suggestions={vendors ?? []} />
            <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
            <Field caps label={t('fields.caseOptional')} value={f.caseNo} onChange={set('caseNo')} />
            <div className="sm:col-span-2 flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
              <div className="min-w-0">
                <p className={cn('text-[14px] font-medium', hasCase ? 'text-content' : 'text-content-subtle')}>{t('bill.countLabel')}</p>
                <p className="mt-0.5 text-[12.5px] text-content-subtle">{hasCase ? t('bill.countHint') : t('web.bills.countNeedsCase')}</p>
              </div>
              <Toggle checked={f.count} onChange={set('count')} disabled={!hasCase} aria-label={t('bill.countLabel')} />
            </div>
          </FormSection>

          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3 mb-4">
              <h2 className="card-title font-display text-[18px] text-content">{t('bill.lines')}</h2>
              <span className="text-[13px] text-content-subtle tabular-nums">{t('web.bills.itemsCount', { count: filled })}</span>
            </div>
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_88px_100px_150px_40px] gap-3 pb-2 text-[13px] font-medium text-content-muted">
              <span>{t('fields.itemName')}<span className="text-rose-500 ms-0.5" aria-hidden>*</span></span>
              <span>{t('fields.quantity')}</span>
              <span>{t('fields.unit')}</span>
              <span className="text-end">{t('fields.amount')}<span className="text-rose-500 ms-0.5" aria-hidden>*</span></span>
              <span />
            </div>
            <ul className="flex flex-col gap-3">
              {lines.map((line, i) => (
                <li key={line.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_88px_100px_150px_40px] gap-3 items-center pb-3 sm:pb-0 border-b border-line sm:border-b-0 last:border-b-0">
                  <input aria-label={`${t('fields.itemName')} ${i + 1}`} placeholder={t('fields.itemName')} value={line.description}
                    onChange={(e) => change(line.key, { description: e.target.value })} className={cn(cell, 'col-span-2 sm:col-span-1')} autoComplete="off" />
                  <input aria-label={t('fields.quantity')} placeholder={t('fields.quantity')} value={line.quantity} inputMode="decimal"
                    onChange={(e) => change(line.key, { quantity: e.target.value })} className={cn(cell, 'tabular-nums')} autoComplete="off" />
                  <input aria-label={t('fields.unit')} placeholder={t('fields.unit')} value={line.unit}
                    onChange={(e) => change(line.key, { unit: e.target.value })} className={cell} autoComplete="off" />
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[14px] text-content-subtle pointer-events-none">Rs</span>
                    <input aria-label={t('fields.amount')} placeholder="0" value={line.amount} inputMode="decimal"
                      onChange={(e) => change(line.key, { amount: e.target.value })} className={cn(cell, 'ps-9 text-end tabular-nums')} autoComplete="off" />
                  </div>
                  <div className="flex justify-end">
                    <Btn tone="quiet" title={t('actions.remove')} disabled={lines.length === 1}
                      icon={<Trash2 size={16} className="text-rose-600 dark:text-rose-400" />}
                      onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <Btn icon={<Plus size={16} />} onClick={() => setLines((all) => [...all, blank()])}>{t('actions.addLine')}</Btn>
              <span className="flex items-baseline gap-3">
                <span className="text-[14px] text-content-muted">{t('fields.total')}</span>
                <Money value={total} className="text-[17px] font-semibold text-content" />
              </span>
            </div>
          </section>

          <FormSection title={t('form.payment')}>
            <MoneyField label={t('fields.paid')} value={f.paid} onChange={set('paid')} hint={t('web.bills.paidHint')} />
            <TextArea label={t('fields.notes')} value={f.notes} onChange={set('notes')} className="sm:col-span-2" />
          </FormSection>
        </div>

        {/* The bill total stays in view while typing. */}
        <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-4">
          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between border-b border-line pb-3 mb-2">
              <h2 className="card-title font-display text-[18px] text-content">{t('web.bills.summary')}</h2>
              <span className="text-[13px] text-content-subtle">{t('web.ada.calcNote')}</span>
            </div>
            <SumLine label={t('fields.total')} value={total} />
            <SumLine label={t('fields.paid')} value={paid} sign="-" tone="good" />
            <div className="mt-3 rounded-2xl bg-surface-2 border border-line px-4 py-3 flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-content">{t('fields.balance')}</span>
              <Money value={balance} tone={balance > 0 ? 'bad' : undefined} className="font-display text-[26px] font-semibold tracking-[-0.02em]" />
            </div>
            <p className="mt-3 text-[12.5px] text-content-subtle leading-relaxed">
              {f.count ? t('web.bills.countedNote', { caseNo: f.caseNo.trim() }) : hasCase ? t('trip.notCounted') : t('web.bills.noCaseNote')}
            </p>
          </section>
          <div className="flex gap-2 justify-end">
            <Btn onClick={() => navigate(-1)}>{t('actions.cancel')}</Btn>
            <Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy} disabled={!loaded}>{t('actions.save')}</Btn>
          </div>
        </aside>
      </form>
    </Page>
  );
}
