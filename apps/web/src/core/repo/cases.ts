import { cycleSummary, type CycleSummary, type Direction } from '../domain/calc';
import { inRange, localDay, type DateRange } from '../domain/dates';
import { referenceKey } from '../domain/keys';
import { AppError, insert, nowStamp, update, type Db } from '../db/core';
import { adaForCase, type AdaView } from './ada';
import { billsForCase, type BillView } from './bills';
import { findCaseByNo, findOrCreateCase, findOrCreateParty, type CaseRow } from './lookups';
import { adjustmentsForCase, type Adjustment } from './parties';
import { en } from '../i18n/en';
import { ur } from '../i18n/ur';

export { findCaseByNo };

export type { Direction };

export type Leg = {
  id: string; case_id: string; party_id: string | null; party_name: string | null; direction: Direction;
  trip_date: string; vehicle: string | null; from_place: string | null; to_place: string | null;
  driver: string | null; advance: number | null; weight: string | null; item_details: string | null;
};

export type Expense = {
  id: string; case_id: string; category: string; description: string | null; amount: number;
  expense_date: string; vendor: string | null; notes: string | null; slip_no: string | null; quantity: string | null;
};

export type CaseView = {
  caseRow: CaseRow; ada: AdaView[]; adaOutward: AdaView[]; adaReturn: AdaView[]; legs: Leg[]; outward: Leg | null; returnLeg: Leg | null;
  expenses: Expense[]; bills: BillView[]; adjustments: (Adjustment & { party_name: string })[]; summary: CycleSummary;
};

const selectLeg = `SELECT l.*, p.name AS party_name FROM trip_legs l LEFT JOIN parties p ON p.id = l.party_id`;

export async function getCaseView(db: Db, caseId: string): Promise<CaseView | null> {
  const caseRow = await db.get<CaseRow>('SELECT * FROM cases WHERE id = ?', [caseId]);
  if (!caseRow) return null;
  const [ada, legs, expenses, bills, adjustments] = await Promise.all([
    adaForCase(db, caseId),
    db.all<Leg>(`${selectLeg} WHERE l.case_id = ? AND l.deleted_at IS NULL ORDER BY l.trip_date`, [caseId]),
    db.all<Expense>('SELECT * FROM expenses WHERE case_id = ? AND deleted_at IS NULL ORDER BY expense_date, created_at', [caseId]),
    billsForCase(db, caseId),
    adjustmentsForCase(db, caseId),
  ]);
  const outward = legs.find((l) => l.direction === 'outward') ?? null;
  const returnLeg = legs.find((l) => l.direction === 'return') ?? null;
  const adaOutward = ada.filter((a) => a.direction === 'outward');
  const adaReturn = ada.filter((a) => a.direction === 'return');
  return {
    caseRow, ada, adaOutward, adaReturn, legs, outward, returnLeg, expenses, bills, adjustments,
    summary: cycleSummary({
      adaEntries: ada.map((a) => ({ freight: a.freight_rate, net: a.due })),
      cycleFreight: caseRow.cycle_freight,
      expenses: expenses.map((e) => e.amount),
      countedBills: bills.filter((b) => b.count_in_profit).map((b) => b.total),
      // A direction counts as done once it has a trip or an Ada file.
      hasOutward: outward !== null || adaOutward.length > 0,
      hasReturn: returnLeg !== null || adaReturn.length > 0,
      completedAt: caseRow.completed_at,
    }),
  };
}

export type LegInput = {
  caseNo: string; direction: Direction; date: string; vehicle?: string; fromPlace?: string; toPlace?: string;
  partyName?: string; driver?: string; advance?: number | null; weight?: string; itemDetails?: string;
  cycleFreight?: number | null;
};

/** Each case has one outward and one return leg. Returns the case id. */
export async function saveLeg(db: Db, input: LegInput, id?: string): Promise<string> {
  if (!referenceKey(input.caseNo)) throw new AppError('errors.caseRequired');
  return db.tx(async () => {
    const caseRow = await findOrCreateCase(db, input.caseNo);
    const same = await db.get<{ id: string }>(
      'SELECT id FROM trip_legs WHERE case_id = ? AND direction = ? AND deleted_at IS NULL',
      [caseRow.id, input.direction],
    );
    if (same && same.id !== id) throw new AppError('errors.legExists');
    const party = input.partyName?.trim() ? await findOrCreateParty(db, input.partyName) : null;
    const row = {
      case_id: caseRow.id, party_id: party, direction: input.direction, trip_date: input.date,
      vehicle: input.vehicle?.trim() || null, vehicle_key: referenceKey(input.vehicle) || null,
      from_place: input.fromPlace?.trim() || null, to_place: input.toPlace?.trim() || null,
      driver: input.driver?.trim() || null, advance: input.advance ?? null,
      weight: input.weight?.trim() || null, item_details: input.itemDetails?.trim() || null,
    };
    if (id) await update(db, 'trip_legs', id, row);
    else await insert(db, 'trip_legs', row);
    if (input.cycleFreight !== undefined) await update(db, 'cases', caseRow.id, { cycle_freight: input.cycleFreight });
    return caseRow.id;
  });
}

export const getLeg = (db: Db, id: string) => db.get<Leg & { case_no: string }>(
  `SELECT l.*, p.name AS party_name, c.case_no FROM trip_legs l LEFT JOIN parties p ON p.id = l.party_id
   JOIN cases c ON c.id = l.case_id WHERE l.id = ?`, [id]);

export type ExpenseInput = {
  caseId: string; category: string; description?: string; amount: number; date: string; vendor?: string; notes?: string;
  slipNo?: string; quantity?: string;
};

export async function saveExpense(db: Db, input: ExpenseInput, id?: string): Promise<string> {
  if (!input.category.trim()) throw new AppError('errors.categoryRequired');
  if (input.amount <= 0) throw new AppError('errors.amountRequired');
  const row = {
    case_id: input.caseId, category: input.category.trim(), description: input.description?.trim() || null,
    amount: input.amount, expense_date: input.date, vendor: input.vendor?.trim() || null, notes: input.notes?.trim() || null,
    slip_no: input.slipNo?.trim() || null, quantity: input.quantity?.trim() || null,
  };
  return db.tx(async () => {
    if (id) {
      await update(db, 'expenses', id, row);
      return id;
    }
    return insert(db, 'expenses', row);
  });
}

export const getExpense = (db: Db, id: string) => db.get<Expense>('SELECT * FROM expenses WHERE id = ?', [id]);

export async function expenseCategories(db: Db): Promise<string[]> {
  const rows = await db.all<{ category: string }>('SELECT DISTINCT category FROM expenses WHERE deleted_at IS NULL ORDER BY category');
  return rows.map((r) => r.category);
}

export async function markCaseComplete(db: Db, caseId: string): Promise<void> {
  const view = await getCaseView(db, caseId);
  if (view?.summary.status !== 'ready') throw new AppError('errors.needBothLegs');
  await db.tx(() => update(db, 'cases', caseId, { completed_at: nowStamp() }));
}

export function reopenCase(db: Db, caseId: string) {
  return db.tx(() => update(db, 'cases', caseId, { completed_at: null }));
}

export type CycleRow = {
  caseId: string; caseNo: string; vehicle: string | null; partyName: string | null; route: string; from: string | null; to: string | null;
  date: string; outward: Leg | null; returnLeg: Leg | null; hasOutward: boolean; hasReturn: boolean; summary: CycleSummary;
};

export type CycleFilter = {
  search?: string; caseNo?: string; vehicle?: string; party?: string; route?: string;
  status?: CycleSummary['status']; direction?: Direction; range?: DateRange;
};

export async function listCycles(db: Db, filter: CycleFilter = {}): Promise<CycleRow[]> {
  const ids = await db.all<{ id: string }>(
    `SELECT id FROM cases c WHERE EXISTS (SELECT 1 FROM trip_legs l WHERE l.case_id = c.id AND l.deleted_at IS NULL)
       OR EXISTS (SELECT 1 FROM ada_entries a WHERE a.case_id = c.id AND a.deleted_at IS NULL)`,
  );
  const views = await Promise.all(ids.map((r) => getCaseView(db, r.id)));
  const term = filter.search?.trim().toLowerCase();
  const key = referenceKey(filter.search);
  const has = (value: string | null | undefined, needle: string) => (value ?? '').toLowerCase().includes(needle.toLowerCase());
  return views
    .filter((v): v is CaseView => v !== null)
    .map<CycleRow>((v) => {
      const first = v.outward ?? v.returnLeg;
      const sheet = sheetHeader(v);
      return {
        caseId: v.caseRow.id, caseNo: v.caseRow.case_no, vehicle: sheet.vehicle,
        partyName: sheet.broker, route: [sheet.from, sheet.to].filter(Boolean).join(' - '), from: sheet.from, to: sheet.to,
        // A confirmed profit belongs to the day it was confirmed.
        date: v.caseRow.completed_at ? localDay(v.caseRow.completed_at) : first?.trip_date ?? v.ada[0]?.entry_date ?? localDay(v.caseRow.created_at),
        outward: v.outward, returnLeg: v.returnLeg, summary: v.summary,
        hasOutward: v.outward !== null || v.adaOutward.length > 0, hasReturn: v.returnLeg !== null || v.adaReturn.length > 0,
      };
    })
    .filter((c) => {
      if (filter.range && !inRange(c.date, filter.range)) return false;
      if (filter.status && c.summary.status !== filter.status) return false;
      if (filter.direction && !(filter.direction === 'outward' ? c.hasOutward : c.hasReturn)) return false;
      if (filter.caseNo && !referenceKey(c.caseNo).includes(referenceKey(filter.caseNo))) return false;
      if (filter.vehicle && !referenceKey(c.vehicle).includes(referenceKey(filter.vehicle))) return false;
      if (filter.party && !has(c.partyName, filter.party)) return false;
      if (filter.route && !has(c.route, filter.route)) return false;
      if (!term) return true;
      return (
        (key !== '' && (referenceKey(c.caseNo).includes(key) || referenceKey(c.vehicle).includes(key))) ||
        has(c.partyName, term) || has(c.route, term) ||
        has(c.returnLeg?.from_place, term) || has(c.returnLeg?.to_place, term)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}



/** Going and return freight, all expenses, profit, and what the broker still owes on this case. */
export type SheetTotals = {
  outwardFreight: number; returnFreight: number; freight: number; expenses: number; profit: number; received: number; balance: number;
};

export function sheetTotals(v: CaseView): SheetTotals {
  const due = (rows: AdaView[]) => rows.reduce((n, a) => n + a.due, 0);
  const hasAda = v.ada.length > 0;
  return {
    // Without Ada files the whole trip freight was typed on the trip, so it sits under outward.
    outwardFreight: hasAda ? due(v.adaOutward) : v.summary.freight,
    returnFreight: hasAda ? due(v.adaReturn) : 0,
    freight: v.summary.freight,
    expenses: v.summary.totalExpenses,
    profit: v.summary.profit,
    received: v.ada.reduce((n, a) => n + a.received, 0),
    balance: v.ada.reduce((n, a) => n + a.balance, 0),
  };
}

export type SheetHeader = {
  vehicle: string | null; from: string | null; to: string | null; broker: string | null;
  market: { weight: string | null; freight: number } | null;
  returnLoad: { weight: string | null; freight: number } | null;
  cycleFreight: number;
};

const joinText = (values: (string | null)[]) => values.filter(Boolean).join(', ') || null;

/**
 * The top of the trip sheet. Market is the outward Ada file and Return is the return Ada file,
 * each shown with weight and net freight. Driver and advance are not on the sheet (client request).
 */
export function sheetHeader(v: CaseView): SheetHeader {
  const out = v.adaOutward[0];
  const leg = v.outward ?? v.returnLeg;
  const load = (rows: AdaView[]) => rows.length
    ? { weight: joinText(rows.map((a) => a.weight)), freight: rows.reduce((n, a) => n + a.due, 0) }
    : null;
  return {
    vehicle: v.outward?.vehicle ?? out?.vehicle ?? v.returnLeg?.vehicle ?? v.ada[0]?.vehicle ?? null,
    from: v.outward?.from_place ?? out?.from_place ?? null,
    to: v.outward?.to_place ?? out?.to_place ?? null,
    broker: leg?.party_name ?? out?.party_name ?? v.ada[0]?.party_name ?? null,
    market: load(v.adaOutward),
    returnLoad: load(v.adaReturn),
    cycleFreight: v.summary.freight,
  };
}

/** Diesel rate per litre from the amount and litres, as on the paper sheet. */
export function ratePerUnit(amount: number, quantity: string | null): number | null {
  const units = Number((quantity ?? '').replace(/,/g, ''));
  return units > 0 ? Math.round(amount / units) : null;
}

/** The expense types the paper trip sheet always lists, in its order. */
export const sheetTypes = ['diesel', 'oil', 'peshgi', 'bilty', 'loading', 'unloading', 'broker'] as const;
export type SheetType = (typeof sheetTypes)[number];

/** Expense types are typed freely, in English or Urdu, so both spellings count. */
export function expenseTypeOf(category: string): SheetType | null {
  const c = category.trim().toLowerCase();
  // Unloading before loading: "unloading" contains "loading".
  const order: SheetType[] = ['diesel', 'oil', 'peshgi', 'bilty', 'unloading', 'loading', 'broker'];
  return order.find((k) => c.includes(k) || c === en.expenseType[k].toLowerCase() || c === ur.expenseType[k]) ?? null;
}

export type SheetExpenseRow = {
  /** The type as typed on the expense, or null for an empty fixed line (print shows `typeKey`). */
  category: string | null; typeKey: SheetType | null;
  station: string | null; slipNo: string | null; litres: string | null; amount: number | null; rate: number | null;
};

/**
 * The expense lines of the trip sheet: every fixed type in the sheet's order (an empty line when
 * nothing was spent on it), then any other types, then Bill Book bills counted in this trip.
 */
export function sheetExpenseRows(v: CaseView, billLabel: string): SheetExpenseRow[] {
  const row = (e: Expense): SheetExpenseRow => ({
    category: e.category, typeKey: expenseTypeOf(e.category), station: e.vendor, slipNo: e.slip_no, litres: e.quantity,
    amount: e.amount, rate: ratePerUnit(e.amount, e.quantity),
  });
  const rows: SheetExpenseRow[] = [];
  for (const type of sheetTypes) {
    const own = v.expenses.filter((e) => expenseTypeOf(e.category) === type);
    if (own.length) rows.push(...own.map(row));
    else rows.push({ category: null, typeKey: type, station: null, slipNo: null, litres: null, amount: null, rate: null });
  }
  rows.push(...v.expenses.filter((e) => expenseTypeOf(e.category) === null).map(row));
  rows.push(...v.bills.filter((b) => b.count_in_profit).map((b): SheetExpenseRow => ({
    category: billLabel, typeKey: null, station: b.vendor, slipNo: null, litres: null, amount: b.total, rate: null,
  })));
  return rows;
}
