import { formatDate, today } from '../domain/dates';
import { formatPKR } from '../domain/money';
import { hasUrdu, type Lang, type Translate } from '../i18n';
import type { Company } from '../repo/settings';
import type { ReportResult } from '../repo/reports';

export type PrintSection =
  | { type: 'pairs'; title?: string; pairs: [string, string | null | undefined][] }
  /** With `details`, lines after the first in a cell print smaller underneath (e.g. diesel slip details). */
  | { type: 'table'; title?: string; head: string[]; rows: (string | null)[][]; numeric?: number[]; foot?: (string | null)[]; nowrap?: number[]; details?: boolean }
  /** A ruled sheet without a header row: label in the first column, values after it. */
  | { type: 'grid'; title?: string; rows: (string | null)[][]; numeric?: number[] }
  /** Totals sit in a box at the bottom right, as written under a paper sheet; the last line is the result. */
  | { type: 'totals'; title?: string; totals: [string, string][] }
  | { type: 'note'; text: string };

/** Wide tables, such as the monthly vehicle sheet, print on a landscape page. */
export type PrintDocument = { title: string; subtitle?: string; sections: PrintSection[]; landscape?: boolean; fileName?: string };

export type PrintFonts = { latin?: string; latinBold?: string; urdu?: string; urduBold?: string };

const esc = (value: string | null | undefined) =>
  (value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const face = (family: string, weight: number, data?: string) =>
  data ? `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${data}) format('truetype');}` : '';

function section(s: PrintSection): string {
  const title = 'title' in s && s.title ? `<h2>${esc(s.title)}</h2>` : '';
  if (s.type === 'note') return `<p class="note">${esc(s.text)}</p>`;
  if (s.type === 'pairs') {
    const rows = s.pairs.filter(([, v]) => v).map(([k, v]) => `<div class="pair"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`);
    return `<section>${title}<div class="pairs">${rows.join('')}</div></section>`;
  }
  if (s.type === 'totals') {
    const rows = s.totals.map(([k, v], i) => `<tr class="${i === s.totals.length - 1 ? 'result' : ''}"><th>${esc(k)}</th><td class="n">${esc(v)}</td></tr>`);
    return `<section class="totals-wrap">${title}<table class="totals"><tbody>${rows.join('')}</tbody></table></section>`;
  }
  const num = new Set(s.numeric ?? []);
  const keep = new Set(s.type === 'table' ? s.nowrap ?? [] : []);
  const cls = (i: number) => [num.has(i) ? 'n' : '', keep.has(i) ? 'nw' : ''].join(' ').trim();
  const detailed = s.type === 'table' && s.details;
  const text = (c: string | null) => {
    if (!detailed || !c?.includes('\n')) return esc(c);
    const [first, ...rest] = c.split('\n');
    return `${esc(first)}${rest.filter(Boolean).map((l) => `<div class="sub">${esc(l)}</div>`).join('')}`;
  };
  const cells = (r: (string | null)[], tag: 'td' | 'th' = 'td') => r.map((c, i) => `<${tag} class="${cls(i)}">${text(c)}</${tag}>`).join('');
  if (s.type === 'grid') {
    return `<section>${title}<table class="grid"><tbody>${s.rows.map((r) => `<tr>${cells(r)}</tr>`).join('')}</tbody></table></section>`;
  }
  const head = s.head.map((h, i) => `<th class="${num.has(i) ? 'n' : ''}">${esc(h)}</th>`).join('');
  const body = s.rows.map((r) => `<tr>${cells(r)}</tr>`).join('');
  const foot = s.foot ? `<tfoot><tr>${cells(s.foot)}</tr></tfoot>` : '';
  return `<section>${title}<table class="sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></section>`;
}

/** Print layouts favour readability over matching the phone screen (SRS 09). */
export function renderDocument(doc: PrintDocument, company: Company, lang: Lang, t: Translate, fonts: PrintFonts = {}): string {
  const name = company.name?.trim() || t('app.name');
  const watermark = company.logo
    ? `<img class="wm-logo" src="${esc(company.logo)}" alt="" />`
    : `<div class="wm-text">${esc(name)}</div>`;
  const contact = [company.phone, company.address].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${face('PrintLatin', 400, fonts.latin)}${face('PrintLatin', 700, fonts.latinBold)}
${face('PrintUrdu', 400, fonts.urdu)}${face('PrintUrdu', 700, fonts.urduBold)}
@page { size: A4${doc.landscape ? ' landscape' : ''}; margin: 14mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: ${lang === 'ur' ? `'PrintUrdu', 'PrintLatin'` : `'PrintLatin', 'PrintUrdu'`}, Arial, sans-serif; color: #15192B; font-size: 11.5pt; line-height: ${lang === 'ur' ? 2 : 1.4}; }
.wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none; }
.wm-logo { max-width: 60%; max-height: 45%; opacity: 0.08; }
.wm-text { font-size: 60pt; font-weight: 700; opacity: 0.06; transform: rotate(-28deg); text-align: center; line-height: 1.6; }
main { position: relative; z-index: 1; }
header { border-bottom: 2pt solid #121412; padding-bottom: 8pt; margin-bottom: 12pt; }
.company { font-size: 17pt; font-weight: 700; color: #121412; }
.contact { font-size: 9.5pt; color: #4B5165; }
h1 { font-size: 14pt; margin: 10pt 0 0; }
.subtitle { font-size: 10pt; color: #4B5165; }
h2 { font-size: 11pt; margin: 14pt 0 5pt; color: #121412; text-transform: uppercase; letter-spacing: 0.02em; break-after: avoid; }
section { break-inside: auto; }
.pairs { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18pt; border-top: 0.75pt solid #8E939E; }
.pair { display: flex; justify-content: space-between; gap: 10pt; border-bottom: 0.75pt solid #8E939E; padding: 3pt 2pt; break-inside: avoid; }
.pair .k { color: #121412; font-weight: 700; text-transform: uppercase; font-size: 9.5pt; }
.pair .v { font-weight: 400; text-align: end; overflow-wrap: anywhere; }
/* Ruled like the company's spreadsheet: grey header band, bold headings, every cell boxed. */
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
table.sheet th { text-align: center; background: #DADBDF; font-weight: 700; text-transform: uppercase; font-size: 8.8pt; padding: 4pt 3pt; border: 0.75pt solid #6F7480; }
table.sheet td { padding: 3.5pt 4pt; border: 0.75pt solid #8E939E; vertical-align: top; overflow-wrap: anywhere; }
table.sheet tfoot td { font-weight: 700; background: #EEEFF2; border-top: 1.2pt solid #121412; }
table.grid td { padding: 3.5pt 5pt; border: 0.75pt solid #8E939E; }
table.grid td:first-child { font-weight: 700; text-transform: uppercase; background: #EEEFF2; width: 22%; }
.n { text-align: end; white-space: nowrap; }
.nw { white-space: nowrap; }
/* Spacing letters apart breaks joined Urdu script. */
[dir=rtl] h2, [dir=rtl] th, [dir=rtl] .k { letter-spacing: 0; }
.sub { font-size: 8.5pt; color: #4B5165; margin-top: 1pt; }
.totals-wrap { display: flex; flex-direction: column; align-items: flex-end; break-inside: avoid; }
table.totals { width: 46%; min-width: 220pt; margin-top: 10pt; }
table.totals th { text-align: start; text-transform: uppercase; font-weight: 700; font-size: 9.5pt; padding: 3.5pt 6pt; border: 0.75pt solid #8E939E; background: #EEEFF2; }
table.totals td { padding: 3.5pt 6pt; border: 0.75pt solid #8E939E; }
table.totals tr.result th, table.totals tr.result td { border-top: 1.4pt solid #121412; font-size: 11pt; font-weight: 700; background: #E3E4E8; }
.note { font-size: 9.5pt; color: #4B5165; }
footer { margin-top: 18pt; font-size: 8.5pt; color: #4B5165; }
</style></head><body>
<div class="wm">${watermark}</div>
<main>
<header><div class="company">${esc(name)}</div>${contact ? `<div class="contact">${contact}</div>` : ''}
<h1>${esc(doc.title)}</h1>${doc.subtitle ? `<div class="subtitle">${esc(doc.subtitle)}</div>` : ''}</header>
${doc.sections.map(section).join('\n')}
<footer>${esc(t('report.generatedOn'))}: ${formatDate(today())}</footer>
</main></body></html>`;
}

export function needsUrduFont(doc: PrintDocument, company: Company, lang: Lang): boolean {
  return lang === 'ur' || hasUrdu(JSON.stringify(doc)) || hasUrdu(company.name) || hasUrdu(company.address);
}

export function reportToDocument(report: ReportResult, title: string, subtitle: string, t: Translate): PrintDocument {
  const numeric = report.columns.flatMap((c, i) => (c.type === 'money' ? [i] : []));
  const show = (c: ReportResult['columns'][number], value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return '';
    if (c.type === 'money') return formatPKR(Number(value));
    if (c.type === 'date') return formatDate(value as string);
    if (c.type === 'status') return t(String(value));
    return String(value);
  };
  const sections: PrintSection[] = [{
    type: 'table', numeric,
    // Dates and references stay on one line, as in the sheet.
    nowrap: report.columns.flatMap((c, i) => (c.type === 'date' || c.key === 'caseNo' || c.key === 'vehicle' ? [i] : [])),
    head: report.columns.map((c) => t(c.label)),
    rows: report.rows.map((row) => report.columns.map((c) => (c.type === 'money' ? formatPKR(Number(row[c.key] ?? 0)) : show(c, row[c.key])))),
    foot: report.foot ? report.columns.map((c, i) => (i === 0 && typeof report.foot?.[c.key] === 'string' ? t(String(report.foot[c.key])) : show(c, report.foot?.[c.key]))) : undefined,
  }];
  // The monthly sheet's bottom block: the trips' profit, each monthly cost, then the profit left.
  const totals = report.kind === 'vehicle'
    ? report.totals.slice(report.totals.findIndex((x) => x.label === 'report.grossProfit'))
    : report.totals;
  if (totals.length) sections.push({ type: 'totals', totals: totals.map((x) => [x.text ?? t(x.label), formatPKR(x.value)]) });
  return { title, subtitle, sections, landscape: report.columns.length > 9 };
}
