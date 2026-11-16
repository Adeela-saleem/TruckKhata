import { describe, expect, it } from 'vitest';
import { adaAmounts, commissionAmount, cycleSummary, dihariAmount, cycleStatus, freightAfterCommission, insuranceStatus, partyOutstanding } from '../src/domain/calc';
import { monthRange, weekRange, inRange } from '../src/domain/dates';
import { nameKey, referenceKey } from '../src/domain/keys';
import { formatPKR, moneyToInput, parseMoney, parsePercent } from '../src/domain/money';

describe('money', () => {
  it('parses typed amounts into paisa', () => {
    expect(parseMoney('1,200.50')).toBe(120050);
    expect(parseMoney('Rs 500')).toBe(50000);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
  });
  it('avoids floating point errors', () => {
    expect(parseMoney('1.15')).toBe(115);
    expect(parseMoney('19.99')).toBe(1999);
  });
  it('formats PKR', () => {
    expect(formatPKR(45000000)).toBe('Rs 450,000');
    expect(formatPKR(120050)).toBe('Rs 1,200.50');
    expect(formatPKR(-5000)).toBe('-Rs 50');
    expect(formatPKR(null)).toBe('Rs 0');
  });
  it('round-trips input values', () => {
    expect(moneyToInput(120050)).toBe('1200.50');
    expect(moneyToInput(50000)).toBe('500');
    expect(parseMoney(moneyToInput(120005))).toBe(120005);
  });
  it('limits percent to 100', () => {
    expect(parsePercent('2.5')).toBe(250);
    expect(parsePercent('101')).toBeNull();
  });
});

describe('references', () => {
  it('treats spacing, dashes and capitals as the same reference', () => {
    expect(referenceKey('TLP-1234')).toBe(referenceKey(' tlp 1234 '));
    expect(referenceKey('کیس-12')).toBe('کیس12');
    expect(nameKey('  Ali   Traders ')).toBe('ali traders');
  });
});

describe('commission and balance', () => {
  it('handles fixed and percent commission', () => {
    expect(commissionAmount(10000000, 'fixed', 500000)).toBe(500000);
    expect(commissionAmount(10000000, 'percent', 250)).toBe(250000);
    expect(freightAfterCommission(10000000, 'percent', 500)).toBe(9500000);
  });
  it('rounds percent commission to whole paisa', () => {
    expect(commissionAmount(333, 'percent', 1000)).toBe(33);
    expect(Number.isInteger(commissionAmount(12345, 'percent', 333))).toBe(true);
  });
  it('applies manual entries to the party balance', () => {
    expect(partyOutstanding([1000, 500], 300, 100)).toBe(1300);
  });
});

describe('cycle', () => {
  const base = { adaEntries: [], cycleFreight: null, expenses: [], countedBills: [], hasOutward: true, hasReturn: true, completedAt: null };
  it('moves through statuses', () => {
    expect(cycleStatus(false, false, null)).toBe('outward_pending');
    expect(cycleStatus(true, false, null)).toBe('return_pending');
    expect(cycleStatus(true, true, null)).toBe('ready');
    expect(cycleStatus(true, true, '2026-01-01')).toBe('complete');
  });
  it('only confirms profit when complete', () => {
    expect(cycleSummary({ ...base, cycleFreight: 1000 }).confirmed).toBe(false);
    expect(cycleSummary({ ...base, cycleFreight: 1000, hasReturn: false, completedAt: 'x' }).confirmed).toBe(false);
    expect(cycleSummary({ ...base, cycleFreight: 1000, completedAt: 'x' }).confirmed).toBe(true);
  });
  it('profit is freight minus expenses and confirmed bills', () => {
    const s = cycleSummary({ ...base, cycleFreight: 10000, expenses: [1000, 2000], countedBills: [500] });
    expect(s.totalExpenses).toBe(3500);
    expect(s.profit).toBe(6500);
  });
  it('uses net Ada freight when present and flags a mismatch with the trip', () => {
    // Revision Addendum: cycle freight is outward net + return net, not the gross freight rate.
    const s = cycleSummary({ ...base, adaEntries: [{ freight: 9000, net: 8000 }], cycleFreight: 10000 });
    expect(s.freight).toBe(8000);
    expect(s.freightMismatch).toBe(true);
    expect(cycleSummary({ ...base, adaEntries: [{ freight: 9000, net: 8000 }], cycleFreight: 9000 }).freightMismatch).toBe(false);
  });
});

describe('Ada amounts', () => {
  const base = { freight: 3500000, commissionType: 'fixed' as const, commissionValue: 0, mt: 0, mtMode: 'add' as const, dihari: 0, dihariMode: 'add' as const, received: 0 };
  it('adds or deducts M.T. and Dihari after commission', () => {
    expect(adaAmounts({ ...base, commissionValue: 100000, mt: 50000, dihari: 200000 })).toEqual({ commission: 100000, net: 3400000, due: 3650000, balance: 3650000 });
    expect(adaAmounts({ ...base, mt: 50000, mtMode: 'deduct', dihari: 200000, dihariMode: 'deduct', received: 3000000 }))
      .toMatchObject({ net: 3500000, due: 3250000, balance: 250000 });
  });
  it('works out Dihari from days and the amount per day', () => {
    expect(dihariAmount(3, 150000)).toBe(450000);
    expect(dihariAmount(null, 150000)).toBe(150000);
    expect(dihariAmount(0, 150000)).toBe(0);
    expect(dihariAmount(null, null)).toBe(0);
  });
});

describe('insurance status', () => {
  it('marks active, expiring and expired', () => {
    expect(insuranceStatus('2026-12-31', '2026-11-01', 30)).toBe('active');
    expect(insuranceStatus('2026-12-01', '2026-11-01', 30)).toBe('expiring');
    expect(insuranceStatus('2026-11-01', '2026-11-01', 30)).toBe('expiring');
    expect(insuranceStatus('2026-10-31', '2026-11-01', 30)).toBe('expired');
  });
});

describe('date ranges', () => {
  it('builds week and month ranges', () => {
    expect(weekRange('2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(inRange('2026-02-28', monthRange('2026-02-10'))).toBe(true);
    expect(inRange('2026-03-01', monthRange('2026-02-10'))).toBe(false);
  });
});
