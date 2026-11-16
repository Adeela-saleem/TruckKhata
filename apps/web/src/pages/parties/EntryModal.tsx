import { useEffect } from 'react';
import { today } from '../../core/domain/dates';
import { moneyToInput } from '../../core/domain/money';
import { findPossibleDoublePayment, recordPartyPayment, saveAdjustment, type Adjustment } from '../../core/repo/parties';
import { useApp } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrZero, useAction, useForm } from '../../app/hooks';
import { Modal } from '../../components/ui/Modal';
import { Btn, Note } from '../../ui/bits';
import { Choice, DateField, Field, MoneyField, TextArea } from '../../ui/fields';
import { HistoryCard, useDelete } from '../../ui/record';

/**
 * Records a payment from the party (or a manual charge), or changes a manual entry already saved.
 * A new payment with a Case # that has this party's Ada entry goes into Ada Register as Received.
 */
export function EntryModal({ partyId, entry, caseNo, onClose }: {
  partyId: string; entry: Adjustment | 'new' | null; caseNo?: string; onClose: () => void;
}) {
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const remove = useDelete();
  const editing = entry && entry !== 'new' ? entry : null;
  const { values: f, set, setValues } = useForm({ kind: 'payment' as Adjustment['kind'], amount: '', date: today(), caseNo: '', note: '' });

  useEffect(() => {
    if (entry === null) return;
    setValues(editing
      ? { kind: editing.kind, amount: moneyToInput(editing.amount), date: editing.adj_date, caseNo: editing.case_no ?? '', note: editing.note ?? '' }
      : { kind: 'payment', amount: '', date: today(), caseNo: caseNo ?? '', note: '' });
  }, [entry, editing, caseNo, setValues]);

  const save = () => run(async () => {
    const amount = moneyOrZero(f.amount);
    if (!editing && f.kind === 'payment' && amount > 0 && (await findPossibleDoublePayment(db, f.caseNo, amount))) {
      if (!(await confirm(t('party.doubleTitle'), t('party.doubleMessage'), t('actions.saveAnyway'), 'danger'))) return;
    }
    const input = { partyId, amount, date: f.date, note: f.note, caseNo: f.caseNo };
    if (!editing && f.kind === 'payment') {
      const result = await recordPartyPayment(db, input);
      toast.success(result.linked ? t('party.paymentLinked', { caseNo: result.caseNo }) : t('web.saved'));
    } else {
      await saveAdjustment(db, { ...input, kind: f.kind }, editing?.id);
      toast.success(t('web.saved'));
    }
    onClose();
  });

  return (
    <Modal open={entry !== null} onClose={onClose} size="md" title={editing ? t('web.parties.entryEdit') : t('web.parties.recordPayment')}
      footer={<>
        {editing && <Btn tone="danger" className="me-auto" onClick={() => remove('party_adjustments', editing.id, onClose)}>{t('actions.delete')}</Btn>}
        <Btn onClick={onClose}>{t('actions.cancel')}</Btn>
        <Btn tone="primary" busy={busy} onClick={save}>{t('actions.save')}</Btn>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Choice label={t('party.manualKind')} value={f.kind} onChange={set('kind')} className="sm:col-span-2"
          options={[{ value: 'payment', label: t('web.parties.kindPayment') }, { value: 'charge', label: t('ledger.charge') }]} />
        <MoneyField required label={t('fields.amount')} value={f.amount} onChange={set('amount')} />
        <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
        <Field caps label={t('fields.caseOptional')} value={f.caseNo} onChange={set('caseNo')} className="sm:col-span-2" />
        <TextArea label={t('fields.note')} value={f.note} onChange={set('note')} className="sm:col-span-2" />
        {!editing && f.kind === 'payment' && <div className="sm:col-span-2"><Note>{t('party.manualHint')}</Note></div>}
        {editing && <div className="sm:col-span-2"><HistoryCard recordIds={[editing.id]} /></div>}
      </div>
    </Modal>
  );
}
