import { formatDate } from '../core/domain/dates';
import type { Translate } from '../core/i18n';
import { reportToCsv } from '../core/print/csv';
import { reportToDocument } from '../core/print/html';
import type { ReportColumn, ReportKind, ReportResult, ReportRow, ReportTotal } from '../core/repo/reports';
import { downloadText } from '../platform/files';
import type { DateRange } from '../core/domain/dates';

export const col = (key: string, label: string, type: ReportColumn['type'] = 'text'): ReportColumn => ({ key, label, type });

/** A list as a report, so it prints and exports exactly like the Reports page (client request: every list as a full PDF). */
export function listReport(kind: ReportKind, columns: ReportColumn[], rows: ReportRow[], totals: ReportTotal[] = []): ReportResult {
  return { kind, columns, rows, totals };
}

export function periodText(range: DateRange, t: Translate) {
  return range.from || range.to ? `${t('report.period')}: ${formatDate(range.from) || '...'} - ${formatDate(range.to) || '...'}` : t('range.all');
}

export const listDocument = (report: ReportResult, title: string, subtitle: string, t: Translate) => reportToDocument(report, title, subtitle, t);

export function downloadCsv(report: ReportResult, name: string, t: Translate) {
  downloadText(`${name}.csv`, reportToCsv(report, t), 'text/csv;charset=utf-8');
}
