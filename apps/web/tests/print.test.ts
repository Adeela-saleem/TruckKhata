import { describe, expect, it } from 'vitest';
import { translator } from '../src/core/i18n';
import { en } from '../src/core/i18n/en';
import { ur } from '../src/core/i18n/ur';
import { reportToCsv } from '../src/core/print/csv';
import { partyDocument } from '../src/core/print/documents';
import { renderDocument } from '../src/core/print/html';
import type { ReportResult } from '../src/core/repo/reports';

const t = translator('en');
const company = { name: 'Awan <Goods>', phone: '0300', address: null, logo: null };

describe('print documents', () => {
  const doc = { title: 'Bill', sections: [{ type: 'pairs' as const, pairs: [['Vendor', '<script>'], ['Empty', null]] as [string, string | null][] }] };
  it('escapes entered text', () => {
    const html = renderDocument(doc, company, 'en', t);
    expect(html).toContain('Awan &lt;Goods&gt;');
    expect(html).not.toContain('<script>');
  });
  it('leaves out blank fields', () => {
    expect(renderDocument(doc, company, 'en', t)).not.toContain('Empty');
  });
  it('uses the logo as a watermark when configured, otherwise the company name', () => {
    expect(renderDocument(doc, { ...company, logo: 'data:image/png;base64,AA' }, 'en', t)).toContain('wm-logo" src="data:image/png;base64,AA"');
    expect(renderDocument(doc, company, 'en', t)).toContain('class="wm-text">Awan');
  });
  it('sets right-to-left for Urdu', () => {
    expect(renderDocument(doc, company, 'ur', translator('ur'))).toContain('dir="rtl"');
  });
});

describe('forms and paper', () => {
  it('does not print form hints such as "optional" on a statement', () => {
    const account = { party: { name: 'Ali', phone: '0300', address: 'Lahore', received: 0, outstanding: 0 }, ada: [], ledger: [], manualPayments: 0, manualCharges: 0 } as never;
    const html = renderDocument(partyDocument(account, t), company, 'en', t);
    expect(html).not.toContain('optional');
    expect(html).toContain('Phone');
  });
});

describe('CSV', () => {
  const report: ReportResult = {
    kind: 'ada', totals: [],
    columns: [{ key: 'a', label: 'fields.vendor', type: 'text' }, { key: 'b', label: 'fields.amount', type: 'money' }, { key: 'c', label: 'fields.date', type: 'date' }],
    rows: [{ a: 'Ali, "Sons"', b: 150050, c: '2026-10-05' }, { a: '=HYPERLINK("x")', b: 0, c: null }],
  };
  it('quotes values, formats amounts and adds a BOM for Urdu', () => {
    const csv = reportToCsv(report, t);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Ali, ""Sons""",1500.50,05/10/2026');
  });
  it('stops formulas from running in Excel', () => {
    expect(reportToCsv(report, t)).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('translations', () => {
  const keys = (node: object, prefix = ''): string[] =>
    Object.entries(node).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
  it('has every English string in Urdu', () => {
    expect(keys(ur).sort()).toEqual(keys(en).sort());
  });
  it('keeps the same placeholders in both languages', () => {
    const urdu = translator('ur');
    for (const key of keys(en)) {
      const names = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort();
      expect(names(urdu(key)), key).toEqual(names(t(key)));
    }
  });
  it('fills in values', () => {
    expect(t('trip.completeMessage', { profit: 'Rs 5' })).toBe('Profit of Rs 5 will be confirmed.');
  });
});
