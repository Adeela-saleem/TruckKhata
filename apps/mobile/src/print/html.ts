import { formatDate, today } from '../domain/dates';
import { formatPKR } from '../domain/money';
import { hasUrdu, type Lang, type Translate } from '../i18n';
import type { Company } from '../repo/settings';
import type { ReportResult } from '../repo/reports';

export type PrintSection =
  | { type: 'pairs'; title?: string; pairs: [string, string | null | undefined][] }
  | { type: 'table'; title?: string; head: string[]; rows: (string | null)[][]; numeric?: number[] }
  | { type: 'totals'; title?: string; totals: [string, string][] }
  | { type: 'note'; text: string };

/** Wide tables, such as the monthly vehicle sheet, print on a landscape page. */
export type PrintDocument = { title: string; subtitle?: string; sections: PrintSection[]; landscape?: boolean };

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
    const rows = s.totals.map(([k, v]) => `<div class="total"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`);
    return `<section>${title}<div class="totals">${rows.join('')}</div></section>`;
  }
  const num = new Set(s.numeric ?? []);
  const head = s.head.map((h, i) => `<th class="${num.has(i) ? 'n' : ''}">${esc(h)}</th>`).join('');
  const body = s.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${num.has(i) ? 'n' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<section>${title}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
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
header { border-bottom: 2.5pt solid #121412; padding-bottom: 8pt; margin-bottom: 12pt; }
.company { font-size: 17pt; font-weight: 700; color: #121412; }
.contact { font-size: 9.5pt; color: #4B5165; }
h1 { font-size: 14pt; margin: 10pt 0 0; }
.subtitle { font-size: 10pt; color: #4B5165; }
h2 { font-size: 11.5pt; margin: 14pt 0 5pt; color: #121412; break-after: avoid; }
section { break-inside: auto; }
.pairs { display: grid; grid-template-columns: 1fr 1fr; gap: 1pt 18pt; }
.pair { display: flex; justify-content: space-between; gap: 10pt; border-bottom: 0.5pt solid #D9DCE5; padding: 2.5pt 0; break-inside: avoid; }
.pair .k { color: #4B5165; }
.pair .v { font-weight: 700; text-align: end; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { text-align: start; background: #F0FCCB; padding: 4pt; border-bottom: 1pt solid #121412; }
td { padding: 3.5pt 4pt; border-bottom: 0.5pt solid #D9DCE5; vertical-align: top; overflow-wrap: anywhere; }
.n { text-align: end; white-space: nowrap; }
.totals { border: 1pt solid #121412; padding: 5pt 9pt; break-inside: avoid; }
.total { display: flex; justify-content: space-between; padding: 2pt 0; }
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
  const sections: PrintSection[] = [];
  const totals: PrintSection = { type: 'totals', totals: report.totals.map((x) => [x.text ?? t(x.label), formatPKR(x.value)]) };
  // The monthly vehicle sheet reads top to bottom: trips first, then what is taken off, then the bachat.
  const totalsLast = report.kind === 'vehicle';
  if (report.totals.length && !totalsLast) sections.push(totals);
  sections.push({
    type: 'table', numeric,
    head: report.columns.map((c) => t(c.label)),
    rows: report.rows.map((row) => report.columns.map((c) => {
      const value = row[c.key];
      if (c.type === 'money') return formatPKR(Number(value ?? 0));
      if (c.type === 'date') return formatDate(value as string);
      if (c.type === 'status') return t(String(value));
      return value === null ? '' : String(value);
    })),
  });
  if (report.totals.length && totalsLast) sections.push(totals);
  return { title, subtitle, sections, landscape: report.columns.length > 10 };
}
