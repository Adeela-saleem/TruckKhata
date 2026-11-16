import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { CycleStatus, InsuranceStatus } from '../domain/calc';
import { formatDate } from '../domain/dates';
import { formatPKR } from '../domain/money';
import type { Db } from '../db/core';
import { getCompany } from '../repo/settings';
import { deleteImpact, historyFor, softDelete, type LogEntry, type TrashTable } from '../repo/trash';
import type { PrintDocument, PrintSection } from '../print/html';
import { printDocument, sharePdf } from '../services/print';
import { useApp, useData } from './context';
import { Badge, Button, goBack } from './controls';
import { useDialog } from './dialog';
import { T } from './text';
import { colors, space } from './theme';

export function StatusBadge({ status }: { status: CycleStatus }) {
  const { t } = useApp();
  const tone = status === 'complete' ? 'good' : status === 'ready' ? 'info' : 'warn';
  return <Badge label={t(`status.${status}`)} tone={tone} />;
}

export function InsuranceBadge({ status }: { status: InsuranceStatus }) {
  const { t } = useApp();
  return <Badge label={t(`insurance.${status}`)} tone={status === 'active' ? 'good' : status === 'expiring' ? 'warn' : 'bad'} />;
}

/** Returns a function that warns about linked effects, then moves the record to the Recycle Bin. */
export function useDelete() {
  const { db, t } = useApp();
  const { confirm, toast, showError } = useDialog();
  return async (table: TrashTable, id: string, after?: () => void) => {
    try {
      const impacts = await deleteImpact(db, table, id);
      const lines = impacts.map((i) => t(i.key, i.count === undefined ? undefined : { count: i.count }));
      const ok = await confirm(t('bin.deleteTitle'), t('bin.deleteMessage'), t('actions.delete'), 'danger', lines);
      if (!ok) return;
      await softDelete(db, table, id);
      toast(t('history.deleted'));
      after?.();
    } catch (error) {
      showError(error);
    }
  };
}

export function usePrint() {
  const { db, lang, t } = useApp();
  const { ask, showError } = useDialog();
  return async (build: () => Promise<PrintDocument> | PrintDocument) => {
    const choice = await ask({
      title: t('print.title'),
      actions: [
        { label: t('actions.print'), value: 'print', tone: 'primary' },
        { label: t('actions.sharePdf'), value: 'share', tone: 'plain' },
        { label: t('actions.cancel'), value: 'cancel', tone: 'plain' },
      ],
    });
    if (choice !== 'print' && choice !== 'share') return;
    try {
      const [doc, company] = await Promise.all([build(), getCompany(db)]);
      await (choice === 'print' ? printDocument : sharePdf)(doc, company, lang, t);
    } catch (error) {
      showError(error);
    }
  };
}

const moneyFields = new Set(['freight_rate', 'amount', 'paid', 'advance', 'cycle_freight', 'total', 'mt_amount', 'dihari_rate']);
const fieldLabels: Record<string, string> = {
  freight_rate: 'fields.freightRate', commission_type: 'commission.label', commission_value: 'fields.commission', amount: 'fields.amount', paid: 'fields.paid',
  advance: 'fields.advance', cycle_freight: 'fields.cycleFreight', total: 'fields.total', entry_date: 'fields.date', trip_date: 'fields.date', bill_date: 'fields.date',
  receipt_date: 'fields.date', adj_date: 'fields.date', expense_date: 'fields.date', expiry_date: 'fields.expiry', start_date: 'fields.startDate', vehicle: 'fields.vehicle', vehicle_key: '',
  party_id: 'fields.party', case_id: 'fields.caseNo', market: 'fields.market', weight: 'fields.weight', from_place: 'fields.from', to_place: 'fields.to', empty: 'fields.empty',
  empty_mt: 'fields.emptyMt', dihari: 'fields.dihari', note: 'fields.note', notes: 'fields.notes', driver: 'fields.driver', item_details: 'fields.itemDetails', category: 'fields.category',
  description: 'fields.description', vendor: 'fields.vendor', vendor_key: '', name: 'fields.name', name_key: '', phone: 'fields.phoneShort', address: 'fields.addressShort', completed_at: 'fields.status',
  mt_amount: 'fields.mtAmount', mt_mode: 'fields.mt', dihari_days: 'fields.dihariDays', dihari_rate: 'fields.dihariRate', dihari_mode: 'fields.dihariTotal',
  direction: 'fields.direction', slip_no: 'fields.slipNo', quantity: 'fields.litres', count_in_profit: 'bill.countLabel', policy_no: 'fields.policyNo', company: 'fields.insuranceCompany', archived_at: 'party.archived', attachment_uri: 'fields.attachment', kind: 'party.manualKind',
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

/** Creates the PDF straight away and opens the share sheet, with the company header and watermark. */
export function usePdf() {
  const { db, lang, t } = useApp();
  const { showError } = useDialog();
  const [busy, setBusy] = useState(false);
  const make = async (build: () => Promise<PrintDocument> | PrintDocument) => {
    if (busy) return;
    setBusy(true);
    try {
      const [doc, company] = await Promise.all([build(), getCompany(db)]);
      await sharePdf(doc, company, lang, t);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };
  return { make, busy };
}

/**
 * Collapsed by default: most people never need it, but it must be there for money edits.
 * The PDF icon prints the record itself (when given) followed by every history entry.
 */
export function History({ recordId, record }: { recordId: string; record?: () => Promise<PrintDocument> | PrintDocument }) {
  const { t } = useApp();
  const pdf = usePdf();
  const [open, setOpen] = useState(false);
  const { data } = useData((db: Db) => historyFor(db, recordId), [recordId, open]);
  const rows = (data ?? []).map((e) => ({ id: e.id, at: e.at, text: describe(e, t) })).filter((r) => r.text);
  const makePdf = () => pdf.make(async () => {
    const base = record ? await record() : null;
    const table: PrintSection = rows.length
      ? { type: 'table', title: t('actions.history'), head: [t('fields.date'), t('history.time'), t('history.change')], rows: rows.map((r) => [formatDate(r.at), timeOf(r.at), r.text]) }
      : { type: 'note', text: t('history.none') };
    return {
      title: base ? `${base.title}: ${t('actions.history')}` : t('actions.history'),
      subtitle: base?.subtitle,
      sections: [...(base?.sections ?? []), table],
    };
  });
  return (
    <View style={styles.history}>
      <View style={styles.historyHead}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.historyToggle} onPress={() => setOpen(!open)}>
          <MaterialCommunityIcons name="history" size={22} color={colors.muted} />
          <T variant="label" color={colors.muted} style={{ flex: 1 }}>{t('actions.history')}</T>
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('actions.historyPdf')} disabled={pdf.busy} onPress={makePdf} style={styles.pdfButton}>
          <MaterialCommunityIcons name="file-pdf-box" size={30} color={pdf.busy ? colors.muted : colors.crimson} />
        </Pressable>
      </View>
      {open && rows.map((r) => (
        <View key={r.id} style={styles.historyRow}>
          <T variant="small">{r.text}</T>
          <T variant="small" color={colors.muted}>{formatDate(r.at)} {timeOf(r.at)}</T>
        </View>
      ))}
      {open && rows.length === 0 && <T variant="small" color={colors.muted}>{t('history.none')}</T>}
    </View>
  );
}

export function DeleteButton({ table, id, after }: { table: TrashTable; id: string; after?: () => void }) {
  const { t } = useApp();
  const remove = useDelete();
  return <Button label={t('actions.delete')} tone="plain" icon="trash-can-outline" onPress={() => remove(table, id, after ?? (() => goBack()))} />;
}

const styles = StyleSheet.create({
  history: { gap: space.xs, marginTop: space.sm },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  historyToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  pdfButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  historyRow: { paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.line },
});
