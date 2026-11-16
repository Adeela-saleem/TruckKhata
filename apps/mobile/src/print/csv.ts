import { formatDate } from '../domain/dates';
import type { Translate } from '../i18n';
import { ratePerUnit, sheetHeader, sheetTotals, type CaseView } from '../repo/cases';
import type { ReportResult } from '../repo/reports';

const rupees = (paisa: number | null | undefined) => (paisa === null || paisa === undefined ? '' : (paisa / 100).toFixed(2));
const csvFile = (lines: (string | number | null)[][]) => `\uFEFF${lines.map((l) => l.map(cell).join(',')).join('\r\n')}`;

function cell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // Spreadsheet apps run cells starting with these characters as formulas.
  // Plain numbers such as -500.00 stay numbers.
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The BOM makes Excel read Urdu text correctly. */
export function reportToCsv(report: ReportResult, t: Translate): string {
  const header = report.columns.map((c) => cell(t(c.label))).join(',');
  const rows = report.rows.map((row) =>
    report.columns.map((c) => {
      const value = row[c.key];
      if (c.type === 'money') return (Number(value ?? 0) / 100).toFixed(2);
      if (c.type === 'date') return formatDate(value as string);
      if (c.type === 'status') return cell(t(String(value)));
      return cell(value);
    }).join(','),
  );
  // Totals go under the table, as they would be written at the bottom of a paper sheet.
  const totals = report.totals.length
    ? ['', ...report.totals.map((x) => `${cell(x.text ?? t(x.label))},${(x.value / 100).toFixed(2)}`)]
    : [];
  return `﻿${[header, ...rows, ...totals].join('\r\n')}`;
}

/** The trip sheet as the company keeps it on paper: header, expense rows, then total, freight and profit. */
export function caseSheetCsv(v: CaseView, t: Translate): string {
  const h = sheetHeader(v);
  const st = sheetTotals(v);
  const out = v.adaOutward[0];
  const ret = v.adaReturn[0];
  const lines: (string | number | null)[][] = [
    [h.vehicle],
    [t('fields.caseNo'), v.caseRow.case_no],
    [t('fields.from'), h.from, formatDate(v.outward?.trip_date ?? out?.entry_date ?? null)],
    [t('fields.to'), h.to, formatDate(v.returnLeg?.trip_date ?? ret?.entry_date ?? null)],
    [t('fields.broker'), h.broker],
    [t('trip.market'), h.market?.weight ?? null, rupees(h.market?.freight)],
    [t('trip.returnLoad'), h.returnLoad?.weight ?? null, rupees(h.returnLoad?.freight)],
    [t('fields.driver'), h.driver],
    [t('fields.advance'), rupees(h.advance)],
    [],
    [t('trip.expenses'), t('fields.station'), t('fields.slipNo'), t('fields.litres'), t('fields.amount'), t('fields.rate')],
    ...v.expenses.map((e) => [e.category, e.vendor, e.slip_no, e.quantity, rupees(e.amount), rupees(ratePerUnit(e.amount, e.quantity))]),
    ...v.bills.filter((b) => b.count_in_profit).map((b) => [t('modules.bills'), b.vendor, null, null, rupees(b.total), null]),
    [],
    [t('trip.outwardFreight'), null, null, null, rupees(st.outwardFreight)],
    [t('trip.returnFreight'), null, null, null, rupees(st.returnFreight)],
    [t('fields.total'), null, null, null, rupees(st.expenses)],
    [t('trip.cycleFreight'), null, null, null, rupees(st.freight)],
    [t('trip.net'), null, null, null, rupees(st.profit)],
  ];
  if (v.ada.length) lines.push([t('trip.received'), null, null, null, rupees(st.received)], [t('trip.balance'), null, null, null, rupees(st.balance)]);
  return csvFile(lines);
}
