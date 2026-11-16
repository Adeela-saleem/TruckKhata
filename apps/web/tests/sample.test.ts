import { describe, expect, it } from 'vitest';
import { clearRecords, isEmpty, loadSampleData } from '../src/core/sample';
import { listCycles } from '../src/core/repo/cases';
import { buildReport } from '../src/core/repo/reports';
import { getSetting } from '../src/core/repo/settings';
import { monthRange, today } from '../src/core/domain/dates';
import { testDb } from './helpers';

describe('Sample data', () => {
  it('fills six months through the real rules, and clears without touching settings', async () => {
    const db = await testDb();
    expect(await isEmpty(db)).toBe(true);
    await loadSampleData(db);
    const cycles = await listCycles(db);
    expect(cycles.length).toBeGreaterThan(30);
    expect(cycles.some((c) => c.summary.confirmed)).toBe(true);
    expect(cycles.some((c) => !c.summary.confirmed)).toBe(true);
    const month = await buildReport(db, 'vehicle', { range: monthRange(today()), vehicle: 'LES-4521' });
    expect(month.totals.find((x) => x.label === 'report.costs.salary')?.value).toBe(-6000000);
    await clearRecords(db);
    expect(await isEmpty(db)).toBe(true);
    expect(await getSetting(db, 'company_name')).toBe('Al Madina Goods Transport');
  });
});
