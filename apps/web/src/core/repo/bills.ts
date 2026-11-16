import { balance, sum } from '../domain/calc';
import { inRange, type DateRange } from '../domain/dates';
import { nameKey, referenceKey } from '../domain/keys';
import { AppError, insert, logChange, newId, update, type Db } from '../db/core';
import { findOrCreateCase } from './lookups';

export type BillLine = { id: string; description: string; quantity: string | null; unit: string | null; amount: number };

export type BillView = {
  id: string; case_id: string | null; case_no: string | null; bill_date: string; vendor: string; vehicle: string | null;
  paid: number; notes: string | null; count_in_profit: number; total: number; balance: number; lines: BillLine[]; deleted_at: string | null;
};

const selectBill = `SELECT b.*, c.case_no FROM bills b LEFT JOIN cases c ON c.id = b.case_id`;

async function withLines(db: Db, rows: Omit<BillView, 'total' | 'balance' | 'lines'>[]): Promise<BillView[]> {
  const lines = await db.all<BillLine & { bill_id: string }>('SELECT * FROM bill_lines ORDER BY position');
  return rows.map((row) => {
    const own = lines.filter((l) => l.bill_id === row.id);
    const total = sum(own.map((l) => l.amount));
    return { ...row, lines: own, total, balance: balance(total, row.paid) };
  });
}

export type BillFilter = {
  search?: string; vendor?: string; vehicle?: string; caseNo?: string; range?: DateRange; paid?: 'paid' | 'unpaid';
};

export async function listBills(db: Db, filter: BillFilter = {}): Promise<BillView[]> {
  const rows = await db.all<BillView>(`${selectBill} WHERE b.deleted_at IS NULL ORDER BY b.bill_date DESC, b.created_at DESC`);
  const term = nameKey(filter.search);
  const key = referenceKey(filter.search);
  return (await withLines(db, rows)).filter((b) => {
    if (filter.range && !inRange(b.bill_date, filter.range)) return false;
    if (filter.vendor && !nameKey(b.vendor).includes(nameKey(filter.vendor))) return false;
    if (filter.vehicle && !referenceKey(b.vehicle).includes(referenceKey(filter.vehicle))) return false;
    if (filter.caseNo && !referenceKey(b.case_no).includes(referenceKey(filter.caseNo))) return false;
    if (filter.paid === 'paid' && b.balance > 0) return false;
    if (filter.paid === 'unpaid' && b.balance <= 0) return false;
    if (!term) return true;
    return (
      nameKey(b.vendor).includes(term) ||
      (key !== '' && (referenceKey(b.vehicle).includes(key) || referenceKey(b.case_no).includes(key))) ||
      b.lines.some((l) => nameKey(l.description).includes(term))
    );
  });
}

export async function getBill(db: Db, id: string): Promise<BillView | null> {
  const row = await db.get<BillView>(`${selectBill} WHERE b.id = ?`, [id]);
  return row ? (await withLines(db, [row]))[0] : null;
}

export async function billsForCase(db: Db, caseId: string): Promise<BillView[]> {
  const rows = await db.all<BillView>(`${selectBill} WHERE b.case_id = ? AND b.deleted_at IS NULL ORDER BY b.bill_date`, [caseId]);
  return withLines(db, rows);
}

export type BillInput = {
  date: string; vendor: string; vehicle?: string; caseNo?: string; paid: number; notes?: string; countInProfit: boolean;
  lines: { description: string; quantity?: string; unit?: string; amount: number }[];
};

export async function saveBill(db: Db, input: BillInput, id?: string): Promise<string> {
  if (!nameKey(input.vendor)) throw new AppError('errors.vendorRequired');
  const lines = input.lines.filter((l) => l.description.trim() || l.amount);
  if (lines.length === 0) throw new AppError('errors.lineRequired');
  if (lines.some((l) => !l.description.trim())) throw new AppError('errors.lineDescription');
  const total = sum(lines.map((l) => l.amount));
  if (input.paid > total) throw new AppError('errors.paidTooHigh');
  const hasCase = referenceKey(input.caseNo) !== '';
  // SRS 06: a bill only reaches trip profit when it is linked to a trip and confirmed.
  if (input.countInProfit && !hasCase) throw new AppError('errors.countNeedsCase');
  return db.tx(async () => {
    const caseRow = hasCase ? await findOrCreateCase(db, input.caseNo as string) : null;
    const row = {
      case_id: caseRow?.id ?? null, bill_date: input.date, vendor: input.vendor.trim(), vendor_key: nameKey(input.vendor),
      vehicle: input.vehicle?.trim() || null, vehicle_key: referenceKey(input.vehicle) || null, paid: input.paid,
      notes: input.notes?.trim() || null, count_in_profit: input.countInProfit ? 1 : 0,
    };
    const billId = id ?? (await insert(db, 'bills', row));
    if (id) {
      const before = (await db.get<{ total: number }>('SELECT COALESCE(SUM(amount),0) AS total FROM bill_lines WHERE bill_id = ?', [id]))?.total ?? 0;
      await update(db, 'bills', id, row);
      if (before !== total) await logChange(db, 'bills', id, 'edited', 'total', before, total);
      await db.run('DELETE FROM bill_lines WHERE bill_id = ?', [id]);
    }
    for (const [position, line] of lines.entries()) {
      await db.run(
        'INSERT INTO bill_lines (id, bill_id, position, description, quantity, unit, amount) VALUES (?,?,?,?,?,?,?)',
        [newId(), billId, position, line.description.trim(), line.quantity?.trim() || null, line.unit?.trim() || null, line.amount],
      );
    }
    return billId;
  });
}

export async function vendorNames(db: Db): Promise<string[]> {
  return (await db.all<{ vendor: string }>('SELECT vendor FROM bills WHERE deleted_at IS NULL GROUP BY vendor_key ORDER BY vendor_key')).map((v) => v.vendor);
}
