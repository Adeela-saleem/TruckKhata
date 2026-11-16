import { sum, type Direction } from '../domain/calc';
import { inRange, type DateRange } from '../domain/dates';
import { referenceKey } from '../domain/keys';
import type { Db } from '../db/core';
import { adaTotals, listAda } from './ada';
import { listBills } from './bills';
import { en } from '../i18n/en';
import { ur } from '../i18n/ur';
import { getCaseView, listCycles, sheetTotals, type CaseView, type CycleRow } from './cases';
import { listInsurance } from './insurance';
import { listParties, partyAccount } from './parties';

export type ReportKind = 'vehicle' | 'cycles' | 'confirmed' | 'provisional' | 'ada' | 'party' | 'bills' | 'insurance';

export type ReportFilter = { range: DateRange; caseNo?: string; vehicle?: string; party?: string; route?: string; direction?: Direction };

export type ColumnType = 'text' | 'money' | 'date' | 'status';
export type ReportColumn = { key: string; label: string; type: ColumnType };
export type ReportRow = Record<string, string | number | null>;
/** `label` is a translation key; `text` is used as-is instead, for names typed by the user. */
/** `cost` marks a monthly cost taken off after the trips (the bottom block of the monthly sheet). */
export type ReportTotal = { label: string; text?: string; value: number; tone?: 'good' | 'bad' | 'muted'; cost?: boolean };
/** `foot` is a totals row under the table, keyed like the rows. */
export type ReportResult = { kind: ReportKind; columns: ReportColumn[]; rows: ReportRow[]; totals: ReportTotal[]; foot?: ReportRow };

const col = (key: string, label: string, type: ColumnType = 'text'): ReportColumn => ({ key, label, type });

async function cycleReport(db: Db, kind: 'cycles' | 'confirmed' | 'provisional', filter: ReportFilter): Promise<ReportResult> {
  const all = await listCycles(db, { caseNo: filter.caseNo, vehicle: filter.vehicle, party: filter.party, route: filter.route, range: filter.range });
  const cycles = all.filter((c) => kind === 'cycles' || (kind === 'confirmed' ? c.summary.confirmed : !c.summary.confirmed));
  const confirmed = cycles.filter((c) => c.summary.confirmed);
  const provisional = cycles.filter((c) => !c.summary.confirmed);
  const totals: ReportTotal[] = [
    { label: 'report.totalFreight', value: sum(cycles.map((c) => c.summary.freight)) },
    { label: 'report.totalExpenses', value: sum(cycles.map((c) => c.summary.totalExpenses)) },
  ];
  if (kind !== 'provisional') totals.push({ label: 'report.confirmedProfit', value: sum(confirmed.map((c) => c.summary.profit)), tone: 'good' });
  if (kind !== 'confirmed') totals.push({ label: 'report.provisionalProfit', value: sum(provisional.map((c) => c.summary.profit)), tone: 'muted' });
  return {
    kind,
    columns: [
      col('caseNo', 'fields.caseNo'), col('date', 'fields.date', 'date'), col('vehicle', 'fields.vehicle'), col('party', 'fields.party'),
      col('route', 'fields.route'), col('status', 'fields.status', 'status'), col('freight', 'fields.freight', 'money'),
      col('expenses', 'fields.totalExpenses', 'money'), col('profit', 'fields.profit', 'money'),
    ],
    rows: cycles.map((c) => ({
      caseNo: c.caseNo, date: c.date, vehicle: c.vehicle, party: c.partyName, route: c.route,
      status: `status.${c.summary.status}`, freight: c.summary.freight, expenses: c.summary.totalExpenses, profit: c.summary.profit,
    })),
    totals,
  };
}

/** Expense types are saved as typed, in English or Urdu, so both names count. */
const isType = (category: string, type: 'diesel' | 'oil') => {
  const c = category.trim().toLowerCase();
  return c.includes(type) || c === en.expenseType[type].toLowerCase() || c === ur.expenseType[type];
};

function tripColumns(v: CaseView) {
  const st = sheetTotals(v);
  const diesel = v.expenses.filter((e) => isType(e.category, 'diesel'));
  const oil = v.expenses.filter((e) => isType(e.category, 'oil'));
  const litres = diesel.reduce((n, e) => n + (Number((e.quantity ?? '').replace(/,/g, '')) || 0), 0);
  const dieselTotal = sum(diesel.map((e) => e.amount));
  const oilTotal = sum(oil.map((e) => e.amount));
  const out = v.adaOutward[0];
  const ret = v.adaReturn[0];
  return {
    outwardDate: v.outward?.trip_date ?? out?.entry_date ?? null,
    returnDate: v.returnLeg?.trip_date ?? ret?.entry_date ?? null,
    weight: [out?.weight ?? v.outward?.weight, ret?.weight ?? v.returnLeg?.weight].filter(Boolean).join(' / ') || null,
    station: v.outward?.to_place ?? out?.to_place ?? null,
    market: st.outwardFreight, returnFreight: st.returnFreight,
    returnCommission: sum(v.adaReturn.map((a) => a.commission)),
    litres: litres ? String(litres) : null,
    diesel: dieselTotal, oil: oilTotal,
    // Everything else on the trip: peshgi, bilty, loading, toll, counted bills.
    tripExp: st.expenses - dieselTotal - oilTotal,
    profit: st.profit,
  };
}

/** The monthly costs the company always writes under its sheet, found in Bill Book line names. */
const fixedCosts = [
  { key: 'salary', match: /salary|salar|slary|tankhwa|تنخواہ/i },
  { key: 'tyre', match: /tyre|tire|ٹائر/i },
  { key: 'munshiyana', match: /munshi|منشی/i },
  { key: 'spare', match: /spare|part|پرزے|پرزہ/i },
  { key: 'trolley', match: /trol|trali|troli|rent|ٹرالی/i },
] as const;

/**
 * Trips laid out like the company's monthly sheet: going and return dates, weights, station,
 * broker, market and return freight, return commission, litres, diesel and oil apart, the rest
 * of the trip expenses and the trip profit, with a totals row under the columns.
 */
export async function tripSheetReport(db: Db, cycles: CycleRow[], showVehicle: boolean): Promise<ReportResult> {
  const views = (await Promise.all(cycles.map((c) => getCaseView(db, c.caseId)))).filter((v): v is CaseView => v !== null);
  const rows = cycles.map((c, i) => ({ caseNo: c.caseNo, vehicle: c.vehicle, broker: c.partyName, ...tripColumns(views[i]) }))
    .sort((a, b) => (a.outwardDate ?? '').localeCompare(b.outwardDate ?? ''));
  const litres = rows.reduce((n, r) => n + (Number(r.litres) || 0), 0);
  return {
    kind: 'vehicle',
    columns: [
      col('caseNo', 'fields.caseNo'), ...(showVehicle ? [col('vehicle', 'fields.vehicle')] : []),
      col('outwardDate', 'report.outwardDate', 'date'), col('returnDate', 'report.returnDate', 'date'),
      col('weight', 'fields.weight'), col('station', 'report.station'), col('broker', 'fields.broker'),
      col('market', 'trip.market', 'money'), col('returnFreight', 'trip.returnLoad', 'money'), col('returnCommission', 'report.returnCommission', 'money'),
      col('litres', 'fields.litres'), col('diesel', 'expenseType.diesel', 'money'), col('oil', 'expenseType.oil', 'money'),
      col('tripExp', 'report.tripExpenses', 'money'), col('profit', 'fields.profit', 'money'),
    ],
    rows,
    foot: {
      caseNo: 'report.footTotal', market: sum(rows.map((r) => r.market)), returnFreight: sum(rows.map((r) => r.returnFreight)),
      returnCommission: sum(rows.map((r) => r.returnCommission)), litres: litres ? String(litres) : null,
      diesel: sum(rows.map((r) => r.diesel)), oil: sum(rows.map((r) => r.oil)), tripExp: sum(rows.map((r) => r.tripExp)), profit: sum(rows.map((r) => r.profit)),
    },
    totals: [
      { label: 'report.totalFreight', value: sum(rows.map((r) => r.market + r.returnFreight)) },
      { label: 'expenseType.diesel', value: sum(rows.map((r) => r.diesel)) },
      { label: 'expenseType.oil', value: sum(rows.map((r) => r.oil)) },
      { label: 'report.tripExpenses', value: sum(rows.map((r) => r.tripExp)) },
      { label: 'report.grossProfit', value: sum(rows.map((r) => r.profit)), tone: 'good' },
    ],
  };
}

/**
 * One truck's month, as on the company's sheet: the trips, then the trips' total profit, the
 * monthly costs from the Bill Book (salary, tyre, munshiyana, spare part and trolley rent always
 * listed, anything else under its own name) and the profit left, the bachat.
 */
async function vehicleReport(db: Db, filter: ReportFilter): Promise<ReportResult> {
  const cycles = await listCycles(db, { vehicle: filter.vehicle, range: filter.range });
  const sheet = await tripSheetReport(db, cycles, !referenceKey(filter.vehicle));
  // Bills counted in a trip are already in that trip's profit.
  const bills = (await listBills(db, { range: filter.range, vehicle: filter.vehicle })).filter((b) => !b.count_in_profit);
  const fixed = new Map<string, number>(fixedCosts.map((c) => [c.key, 0]));
  const others = new Map<string, number>();
  for (const b of bills) {
    for (const l of b.lines) {
      const name = l.description.trim() || b.vendor;
      const known = fixedCosts.find((c) => c.match.test(name));
      if (known) {
        fixed.set(known.key, (fixed.get(known.key) ?? 0) + l.amount);
        continue;
      }
      const found = [...others.keys()].find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
      others.set(found, (others.get(found) ?? 0) + l.amount);
    }
  }
  const tripProfit = sum(sheet.rows.map((r) => Number(r.profit)));
  const costTotal = sum([...fixed.values(), ...others.values()]);
  return {
    ...sheet,
    totals: [
      ...sheet.totals,
      ...[...fixed.entries()].map(([key, value]): ReportTotal => ({ label: `report.costs.${key}`, value: -value, tone: 'bad', cost: true })),
      ...[...others.entries()].map(([text, value]): ReportTotal => ({ label: '', text, value: -value, tone: 'bad', cost: true })),
      { label: 'report.bachat', value: tripProfit - costTotal, tone: tripProfit - costTotal < 0 ? 'bad' : 'good' },
    ],
  };
}

async function adaReport(db: Db, filter: ReportFilter): Promise<ReportResult> {
  const party = filter.party?.toLowerCase();
  const rows = (await listAda(db, { range: filter.range, vehicle: filter.vehicle, route: filter.route, direction: filter.direction })).filter(
    (a) => (!party || (a.party_name ?? '').toLowerCase().includes(party))
      && (!filter.caseNo || referenceKey(a.case_no).includes(referenceKey(filter.caseNo))),
  );
  const t = adaTotals(rows);
  return {
    kind: 'ada',
    columns: [
      col('caseNo', 'fields.caseNo'), col('direction', 'fields.direction', 'status'), col('date', 'fields.date', 'date'), col('vehicle', 'fields.vehicle'),
      col('party', 'fields.broker'), col('route', 'fields.route'), col('freight', 'fields.freightRate', 'money'), col('commission', 'fields.commission', 'money'),
      col('mt', 'fields.mt', 'money'), col('dihari', 'fields.dihariTotal', 'money'), col('due', 'fields.due', 'money'), col('received', 'fields.received', 'money'), col('balance', 'fields.balance', 'money'),
    ],
    rows: rows.map((a) => ({
      caseNo: a.case_no, direction: `direction.${a.direction}`, date: a.entry_date, vehicle: a.vehicle, party: a.party_name,
      route: [a.from_place, a.to_place].filter(Boolean).join(' - '),
      freight: a.freight_rate, commission: a.commission,
      // Signed, so a deducted M.T. or Dihari shows as minus and the row adds up to Total due.
      mt: a.mt_mode === 'deduct' ? -a.mt_amount : a.mt_amount, dihari: a.dihari_mode === 'deduct' ? -a.dihari_total : a.dihari_total, due: a.due, received: a.received, balance: a.balance,
    })),
    totals: [
      { label: 'fields.due', value: t.due },
      { label: 'fields.received', value: t.received, tone: 'good' },
      { label: 'fields.balance', value: t.balance, tone: 'bad' },
    ],
  };
}

async function partyReport(db: Db, filter: ReportFilter): Promise<ReportResult> {
  const term = filter.party?.toLowerCase();
  const parties = (await listParties(db)).filter((p) => !term || p.name.toLowerCase().includes(term));
  const rows: ReportRow[] = [];
  for (const p of parties) {
    const account = await partyAccount(db, p.id, { range: filter.range, caseNo: filter.caseNo });
    for (const e of account?.ledger ?? []) {
      rows.push({ party: p.name, date: e.date, caseNo: e.caseNo, entry: `ledger.${e.kind}`, source: `ledger.source_${e.source}`, amount: e.amount, note: e.note });
    }
  }
  return {
    kind: 'party',
    columns: [
      col('party', 'fields.party'), col('date', 'fields.date', 'date'), col('caseNo', 'fields.caseNo'), col('entry', 'fields.entryType', 'status'),
      col('source', 'fields.source', 'status'), col('amount', 'fields.amount', 'money'), col('note', 'fields.notes'),
    ],
    rows,
    // Outstanding is today's position, so it stays the same whatever dates are picked.
    totals: [
      { label: 'report.receivedAll', value: sum(parties.map((p) => p.received)), tone: 'good' },
      { label: 'fields.outstanding', value: sum(parties.map((p) => p.outstanding)), tone: 'bad' },
    ],
  };
}

async function billReport(db: Db, filter: ReportFilter): Promise<ReportResult> {
  const rows = await listBills(db, { range: filter.range, vehicle: filter.vehicle, caseNo: filter.caseNo, vendor: filter.party });
  return {
    kind: 'bills',
    columns: [
      col('date', 'fields.date', 'date'), col('vendor', 'fields.vendor'), col('vehicle', 'fields.vehicle'), col('caseNo', 'fields.caseNo'),
      col('items', 'fields.items'), col('total', 'fields.total', 'money'), col('paid', 'fields.paid', 'money'), col('balance', 'fields.balance', 'money'),
    ],
    rows: rows.map((b) => ({
      date: b.bill_date, vendor: b.vendor, vehicle: b.vehicle, caseNo: b.case_no,
      items: b.lines.map((l) => l.description).join(', '), total: b.total, paid: b.paid, balance: b.balance,
    })),
    totals: [
      { label: 'fields.total', value: sum(rows.map((b) => b.total)) },
      { label: 'fields.paid', value: sum(rows.map((b) => b.paid)), tone: 'good' },
      { label: 'fields.balance', value: sum(rows.map((b) => b.balance)), tone: 'bad' },
    ],
  };
}

async function insuranceReport(db: Db, filter: ReportFilter): Promise<ReportResult> {
  const rows = (await listInsurance(db, { search: filter.vehicle })).filter((i) => inRange(i.expiry_date, filter.range));
  return {
    kind: 'insurance',
    columns: [
      col('vehicle', 'fields.vehicle'), col('category', 'fields.insuranceType'), col('policyNo', 'fields.policyNo'),
      col('expiry', 'fields.expiry', 'date'), col('status', 'fields.status', 'status'),
    ],
    rows: rows.map((i) => ({ vehicle: i.vehicle, category: i.category, policyNo: i.policy_no, expiry: i.expiry_date, status: `insurance.${i.status}` })),
    totals: [],
  };
}

export function buildReport(db: Db, kind: ReportKind, filter: ReportFilter): Promise<ReportResult> {
  switch (kind) {
    case 'ada': return adaReport(db, filter);
    case 'party': return partyReport(db, filter);
    case 'bills': return billReport(db, filter);
    case 'insurance': return insuranceReport(db, filter);
    case 'vehicle': return vehicleReport(db, filter);
    default: return cycleReport(db, kind, filter);
  }
}
