import { useEffect } from 'react';
import { today } from '../../core/domain/dates';
import { formatPKR, moneyToInput, parseMoney } from '../../core/domain/money';
import { expenseCategories, ratePerUnit, saveExpense, type Expense } from '../../core/repo/cases';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrZero, useAction, useForm } from '../../app/hooks';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../components/ui/cn';
import { Btn } from '../../ui/bits';
import { AutoValue, DateField, Field, MoneyField, SuggestField, TextArea } from '../../ui/fields';
import { useDelete } from '../../ui/record';

/** The rows printed on the paper trip sheet, offered as one-tap choices. */
const common = ['diesel', 'oil', 'peshgi', 'bilty', 'loading', 'unloading', 'broker', 'toll'] as const;

const blank = () => ({ category: '', description: '', amount: '', date: today(), vendor: '', slipNo: '', quantity: '', notes: '' });

/** Adds or changes one expense on the trip sheet, without leaving the sheet. */
export function ExpenseModal({ caseId, expense, onClose }: { caseId: string; expense: Expense | null | 'new'; onClose: () => void }) {
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const remove = useDelete();
  const editing = expense && expense !== 'new' ? expense : null;
  const { values: f, set, setValues } = useForm(blank());
  const { data: categories } = useData(expenseCategories);

  useEffect(() => {
    setValues(editing ? {
      category: editing.category, description: editing.description ?? '', amount: moneyToInput(editing.amount), date: editing.expense_date,
      vendor: editing.vendor ?? '', slipNo: editing.slip_no ?? '', quantity: editing.quantity ?? '', notes: editing.notes ?? '',
    } : blank());
  }, [editing, expense, setValues]);

  const save = () => run(async () => {
    await saveExpense(db, {
      caseId, category: f.category, description: f.description, amount: moneyOrZero(f.amount), date: f.date, vendor: f.vendor,
      slipNo: f.slipNo, quantity: f.quantity, notes: f.notes,
    }, editing?.id);
    toast.success(t('web.saved'));
    onClose();
  });

  const labels = common.map((key) => t(`expenseType.${key}`));
  const rate = ratePerUnit(parseMoney(f.amount) ?? 0, f.quantity);

  return (
    <Modal open={expense !== null} onClose={onClose} size="lg" title={editing ? t('web.trips.editExpense') : t('trip.addExpense')}
      footer={<>
        {editing && <Btn tone="danger" className="me-auto" onClick={() => remove('expenses', editing.id, onClose)}>{t('actions.delete')}</Btn>}
        <Btn onClick={onClose}>{t('actions.cancel')}</Btn>
        <Btn tone="primary" busy={busy} onClick={save}>{t('actions.save')}</Btn>
      </>}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-medium text-content-muted">{t('trip.quickCategory')}</span>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <button key={label} type="button" aria-pressed={f.category === label} onClick={() => set('category')(label)}
                className={cn('h-8 px-3 rounded-full text-[13.5px] font-medium border transition-colors',
                  f.category === label ? 'bg-brand-soft text-brand-strong border-brand/40' : 'bg-surface border-line text-content-muted hover:text-content hover:bg-surface-2')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SuggestField required label={t('fields.category')} value={f.category} onChange={set('category')} suggestions={categories ?? []} />
          <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
          <Field label={t('fields.station')} value={f.vendor} onChange={set('vendor')} />
          <Field caps label={t('fields.slipNo')} value={f.slipNo} onChange={set('slipNo')} />
          <Field label={t('fields.litres')} value={f.quantity} onChange={set('quantity')} inputMode="decimal" />
          <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
          <AutoValue label={t('fields.rate')} value={rate === null ? '–' : formatPKR(rate)} />
          <p className="self-end pb-3 text-[12.5px] text-content-subtle">{rate === null ? t('web.trips.noRate') : t('web.trips.rateHint')}</p>
          <Field label={t('fields.description')} value={f.description} onChange={set('description')} className="sm:col-span-2" />
          <TextArea label={t('fields.notes')} value={f.notes} onChange={set('notes')} className="sm:col-span-2" />
        </div>
      </div>
    </Modal>
  );
}
