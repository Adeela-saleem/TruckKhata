import { useState } from 'react';
import { ChevronDown, FileDown, Trash2 } from 'lucide-react';
import { formatDate } from '../core/domain/dates';
import { formatPKR } from '../core/domain/money';
import type { PrintDocument, PrintSection } from '../core/print/html';
import { getCompany } from '../core/repo/settings';
import { deleteImpact, historyFor, softDelete, type LogEntry, type TrashTable } from '../core/repo/trash';
import { useApp, useData } from '../app/context';
import { useDialog } from '../app/dialog';
import { printDocument } from '../platform/print';
import { Btn } from './bits';

/** Builds a document and downloads it as a PDF, with the company header and watermark on every page. */
export function usePrint() {
  const { db, lang, t } = useApp();
  const { showError } = useDialog();
  const [busy, setBusy] = useState(false);
  const print = async (build: () => Promise<PrintDocument> | PrintDocument) => {
    if (busy) return;
    setBusy(true);
    try {
      const [doc, company] = await Promise.all([build(), getCompany(db)]);
      await printDocument(doc, company, lang, t);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  return { print, busy };
}

export function PrintButton({ build, label }: { build: () => Promise<PrintDocument> | PrintDocument; label?: string }) {
  const { t } = useApp();
  const { print, busy } = usePrint();
  return <Btn icon={<FileDown size={16} />} disabled={busy} onClick={() => print(build)}>{label ?? t('web.printPdf')}</Btn>;
}

/** Warns about linked effects, then moves the record to the Recycle Bin. */
export function useDelete() {
  const { db, t, changed } = useApp();
  const { confirm, toast, showError } = useDialog();
  return async (table: TrashTable, id: string, after?: () => void) => {
    try {
      const impacts = await deleteImpact(db, table, id);
      const lines = impacts.map((i) => t(i.key, i.count === undefined ? undefined : { count: i.count }));
      if (!(await confirm(t('bin.deleteTitle'), t('bin.deleteMessage'), t('actions.delete'), 'danger', lines))) return;
      await softDelete(db, table, id);
      toast.success(t('history.deleted'));
      changed();
      after?.();
    } catch (error) {
      showError(error);
    }
  };
}

export function DeleteButton({ table, id, after, label }: { table: TrashTable; id: string; after?: () => void; label?: string }) {
  const { t } = useApp();
  const remove = useDelete();
  return <Btn tone="danger" icon={<Trash2 size={16} />} onClick={() => remove(table, id, after)}>{label ?? t('actions.delete')}</Btn>;
}

const moneyFields = new Set(['freight_rate', 'amount', 'paid', 'advance', 'cycle_freight', 'total', 'mt_amount', 'dihari_rate', 'commission_value']);
const fieldLabels: Record<string, string> = {
  freight_rate: 'fields.freightRate', commission_type: 'commission.label', commission_value: 'fields.commission', amount: 'fields.amount', paid: 'fields.paid',
  advance: 'fields.advance', cycle_freight: 'fields.cycleFreight', total: 'fields.total', entry_date: 'fields.date', trip_date: 'fields.date', bill_date: 'fields.date',
  receipt_date: 'fields.date', adj_date: 'fields.date', expense_date: 'fields.date', expiry_date: 'fields.expiry', start_date: 'fields.startDate', vehicle: 'fields.vehicle', vehicle_key: '',
  party_id: 'fields.party', case_id: 'fields.caseNo', market: 'fields.market', weight: 'fields.weight', from_place: 'fields.from', to_place: 'fields.to', empty: 'fields.empty',
  empty_mt: 'fields.emptyMt', dihari: 'fields.dihari', note: 'fields.note', notes: 'fields.notes', driver: 'fields.driver', item_details: 'fields.itemDetails', category: 'fields.category',
  description: 'fields.description', vendor: 'fields.vendor', vendor_key: '', name: 'fields.name', name_key: '', phone: 'fields.phoneShort', address: 'fields.addressShort', completed_at: 'fields.status',
  mt_amount: 'fields.mtAmount', mt_mode: 'fields.mt', dihari_days: 'fields.dihariDays', dihari_rate: 'fields.dihariRate', dihari_mode: 'fields.dihariTotal',
  direction: 'fields.direction', slip_no: 'fields.slipNo', quantity: 'fields.litres', count_in_profit: 'bill.countLabel', policy_no: 'fields.policyNo', company: 'fields.insuranceCompany',
  archived_at: 'party.archived', attachment_uri: 'fields.attachment', kind: 'party.manualKind',
};

function describe(entry: LogEntry, t: (k: string, v?: Record<string, string>) => string): string | null {
  if (entry.action !== 'edited' || !entry.field) return t(`history.${entry.action}`);
  const label = fieldLabels[entry.field];
  if (label === '') return null;
  const show = (value: string | null) => {
    if (value === null) return t('history.blank');
    if (moneyFields.has(entry.field as string)) return formatPKR(Number(value));
    if (entry.field?.endsWith('_date')) return formatDate(value);
    // Long ids and stamps mean nothing to a reader.
    return value.length > 24 ? '...' : value;
  };
  return t('history.changedFromTo', { field: label ? t(label) : entry.field, from: show(entry.old_value), to: show(entry.new_value) });
}

const timeOf = (at: string) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * The record's history, closed until asked for. The PDF prints the full record
 * followed by every change, with the company watermark (client request: "just History").
 */
export function HistoryCard({ recordIds, record }: { recordIds: string[]; record?: () => Promise<PrintDocument> | PrintDocument }) {
  const { t } = useApp();
  const { print, busy } = usePrint();
  const [open, setOpen] = useState(false);
  const { data } = useData(async (db) => (await Promise.all(recordIds.map((id) => historyFor(db, id)))).flat()
    .sort((a, b) => b.at.localeCompare(a.at)), [recordIds.join(',')]);
  const rows = (data ?? []).map((e) => ({ id: e.id, at: e.at, text: describe(e, t) })).filter((r) => r.text);
  const makePdf = () => print(async () => {
    const base = record ? await record() : null;
    const table: PrintSection = rows.length
      ? { type: 'table', title: t('actions.history'), head: [t('fields.date'), t('history.time'), t('history.change')], rows: rows.map((r) => [formatDate(r.at), timeOf(r.at), r.text]) }
      : { type: 'note', text: t('history.none') };
    return { title: base ? `${base.title}: ${t('actions.history')}` : t('actions.history'), subtitle: base?.subtitle, sections: [...(base?.sections ?? []), table], landscape: base?.landscape };
  });
  return (
    <section className="card">
      <div className="flex items-center gap-2 px-6 py-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex-1 flex items-center gap-2 h-10 text-start text-[14px] font-semibold text-content">
          {t('actions.history')}
          <span className="text-[13px] font-normal text-content-subtle tabular-nums">{rows.length}</span>
          <ChevronDown size={16} className={`text-content-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <Btn tone="quiet" icon={<FileDown size={16} className="text-rose-600 dark:text-rose-400" />} disabled={busy} onClick={makePdf}>{t('actions.pdf')}</Btn>
      </div>
      {open && (
        <ol className="border-t border-line px-6 py-2">
          {rows.length === 0 && <li className="py-3 text-[13px] text-content-subtle">{t('history.none')}</li>}
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 border-b border-line last:border-b-0">
              <span className="text-[14px] text-content">{r.text}</span>
              <span className="text-[12px] text-content-subtle tabular-nums">{formatDate(r.at)} {timeOf(r.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
