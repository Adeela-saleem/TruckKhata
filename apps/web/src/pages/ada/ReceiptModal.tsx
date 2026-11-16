import { useEffect } from 'react';
import { today } from '../../core/domain/dates';
import { moneyToInput } from '../../core/domain/money';
import { addReceipt, getAda, updateReceipt, type Receipt } from '../../core/repo/ada';
import { findManualPaymentOnCase } from '../../core/repo/parties';
import { useApp } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrZero, useAction, useForm } from '../../app/hooks';
import { Modal } from '../../components/ui/Modal';
import { Btn } from '../../ui/bits';
import { DateField, MoneyField, TextArea } from '../../ui/fields';
import { useDelete } from '../../ui/record';

/** Adds or changes one receipt on an Ada entry, without leaving the entry. */
export function ReceiptModal({ adaId, receipt, onClose }: { adaId: string; receipt: Receipt | null | 'new'; onClose: () => void }) {
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const remove = useDelete();
  const editing = receipt && receipt !== 'new' ? receipt : null;
  const { values: f, set, setValues } = useForm({ amount: '', date: today(), note: '' });

  useEffect(() => {
    setValues(editing ? { amount: moneyToInput(editing.amount), date: editing.receipt_date, note: editing.note ?? '' } : { amount: '', date: today(), note: '' });
  }, [editing, setValues]);

  const save = () => run(async () => {
    const amount = moneyOrZero(f.amount);
    if (editing) {
      await updateReceipt(db, editing.id, amount, f.date, f.note);
    } else {
      const entry = await getAda(db, adaId);
      if (entry && amount > 0 && (await findManualPaymentOnCase(db, entry.case_id, amount))) {
        if (!(await confirm(t('party.doubleTitle'), t('party.doubleReceiptMessage'), t('actions.saveAnyway'), 'danger'))) return;
      }
      await addReceipt(db, adaId, amount, f.date, f.note);
    }
    toast.success(t('web.saved'));
    onClose();
  });

  return (
    <Modal open={receipt !== null} onClose={onClose} size="md" title={editing ? t('web.ada.receiptEdit') : t('web.ada.receiptNew')}
      footer={<>
        {editing && <Btn tone="danger" className="me-auto" onClick={() => remove('ada_receipts', editing.id, onClose)}>{t('actions.delete')}</Btn>}
        <Btn onClick={onClose}>{t('actions.cancel')}</Btn>
        <Btn tone="primary" busy={busy} onClick={save}>{t('actions.save')}</Btn>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
        <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
        <TextArea label={t('fields.note')} value={f.note} onChange={set('note')} className="sm:col-span-2" />
      </div>
    </Modal>
  );
}
