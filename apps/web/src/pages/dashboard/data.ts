import { sum, type CycleStatus } from '../../core/domain/calc';
import { addDays, daysBetween, monthRange, parseISODate, toISODate, today, type DateRange } from '../../core/domain/dates';
import type { Db } from '../../core/db/core';
import { en } from '../../core/i18n/en';
import { ur } from '../../core/i18n/ur';
import { listCycles } from '../../core/repo/cases';
import { listInsurance } from '../../core/repo/insurance';
import { listParties } from '../../core/repo/parties';
import { getSetting } from '../../core/repo/settings';

export type Period = 'month' | 'quarter' | 'year';

const BACKUP_DAYS = 7;

export function periodRange(period: Period): DateRange {
  const now = parseISODate(today());
  if (period === 'month') return monthRange(today());
  if (period === 'quarter') return { from: toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: monthRange(today()).to };
  return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: monthRange(today()).to };
}

/** Calendar months ending with this one, oldest first, as YYYY-MM. */
function months(count: number): string[] {
  const now = parseISODate(today());
  return Array.from({ length: count }, (_, i) => toISODate(new Date(now.getFullYear(), now.getMonth() - count + 1 + i, 1)).slice(0, 7));
}

/** Expense types are typed freely in English or Urdu, so both spellings count. */
export const expenseGroups = ['diesel', 'oil', 'toll', 'loading', 'peshgi', 'bills', 'other'] as const;
export type ExpenseGroup = (typeof expenseGroups)[number];

function groupOf(category: string): ExpenseGroup {
  const c = category.trim().toLowerCase();
  const is = (k: keyof typeof en.expenseType) => c.includes(k) || c === en.expenseType[k].toLowerCase() || c === ur.expenseType[k];
  if (is('diesel')) return 'diesel';
  if (is('oil')) return 'oil';
  if (is('toll')) return 'toll';
  if (is('loading') || is('unloading')) return 'loading';
  if (is('peshgi')) return 'peshgi';
  return 'other';
}

const inside = (day: string, r: DateRange) => (!r.from || day >= r.from) && (!r.to || day <= r.to);

export async function loadDashboard(db: Db, period: Period) {
  const range = periodRange(period);
  const [cycles, parties, insurance, company, lastBackup, expenseRows, billRows] = await Promise.all([
    listCycles(db), listParties(db), listInsurance(db), getSetting(db, 'company_name'), getSetting(db, 'last_backup_at'),
    db.all<{ category: string; amount: number; day: string }>('SELECT category, amount, expense_date AS day FROM expenses WHERE deleted_at IS NULL'),
    db.all<{ total: number; day: string }>(`SELECT COALESCE((SELECT SUM(amount) FROM bill_lines l WHERE l.bill_id = b.id), 0) AS total, b.bill_date AS day
      FROM bills b WHERE b.deleted_at IS NULL AND b.count_in_profit = 1 AND b.case_id IS NOT NULL`),
  ]);
  const inPeriod = cycles.filter((c) => inside(c.date, range));

  const trend = months(period === 'year' ? 12 : 6).map((key) => {
    const rows = cycles.filter((c) => c.date.startsWith(key));
    return {
      key,
      freight: sum(rows.map((c) => c.summary.freight)),
      expenses: sum(rows.map((c) => c.summary.totalExpenses)),
      profit: sum(rows.map((c) => c.summary.profit)),
      trips: rows.length,
    };
  });

  const expenseTotals = new Map<ExpenseGroup, number>(expenseGroups.map((g) => [g, 0]));
  for (const e of expenseRows) if (inside(e.day, range)) expenseTotals.set(groupOf(e.category), (expenseTotals.get(groupOf(e.category)) ?? 0) + e.amount);
  for (const b of billRows) if (inside(b.day, range)) expenseTotals.set('bills', (expenseTotals.get('bills') ?? 0) + b.total);
  const expenses = expenseGroups.map((g) => ({ group: g, amount: expenseTotals.get(g) ?? 0 })).filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);

  const statuses: CycleStatus[] = ['complete', 'ready', 'return_pending', 'outward_pending'];
  const status = statuses.map((s) => ({ status: s, count: inPeriod.filter((c) => c.summary.status === s).length }));

  const trucks = new Map<string, { profit: number; trips: number; freight: number }>();
  for (const c of inPeriod) {
    const key = c.vehicle ?? '–';
    const v = trucks.get(key) ?? { profit: 0, trips: 0, freight: 0 };
    trucks.set(key, { profit: v.profit + c.summary.profit, trips: v.trips + 1, freight: v.freight + c.summary.freight });
  }

  const owing = parties.filter((p) => p.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  const stale = !lastBackup || Date.now() - new Date(lastBackup).getTime() > BACKUP_DAYS * 86400000;
  const now = today();

  return {
    range,
    totals: {
      trips: inPeriod.length,
      freight: sum(inPeriod.map((c) => c.summary.freight)),
      expenses: sum(inPeriod.map((c) => c.summary.totalExpenses)),
      profit: sum(inPeriod.map((c) => c.summary.profit)),
      confirmed: sum(inPeriod.filter((c) => c.summary.confirmed).map((c) => c.summary.profit)),
      provisional: sum(inPeriod.filter((c) => !c.summary.confirmed).map((c) => c.summary.profit)),
    },
    previousProfit: trend.length > 1 ? trend[trend.length - 2].profit : 0,
    trend,
    expenses,
    status,
    trucks: [...trucks.entries()].map(([vehicle, v]) => ({ vehicle, ...v })).sort((a, b) => b.profit - a.profit),
    collections: owing.slice(0, 5).map((p) => ({ id: p.id, name: p.name, received: p.received, outstanding: p.outstanding })),
    outstanding: sum(owing.map((p) => p.outstanding)),
    owingCount: owing.length,
    policies: insurance.map((i) => ({ id: i.id, vehicle: i.vehicle, expiry: i.expiry_date, status: i.status, days: daysBetween(now, i.expiry_date), start: i.start_date ?? addDays(i.expiry_date, -365) }))
      .sort((a, b) => a.days - b.days),
    alerts: insurance.filter((i) => i.status !== 'active').length,
    toFinish: cycles.filter((c) => !c.summary.confirmed)
      .sort((a, b) => Number(b.summary.status === 'ready') - Number(a.summary.status === 'ready') || b.date.localeCompare(a.date)),
    companyMissing: !company?.trim(),
    backupDue: stale && cycles.length > 0,
    empty: cycles.length === 0 && parties.length === 0 && insurance.length === 0,
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
