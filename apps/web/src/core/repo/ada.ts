import { adaAmounts, commissionAmount, dihariAmount, sum, type AdjustMode, type CommissionType, type Direction } from '../domain/calc';
import { inRange, today, type DateRange } from '../domain/dates';
import { referenceKey } from '../domain/keys';
import { AppError, insert, logChange, nowStamp, update, type Db } from '../db/core';
import { findCaseByNo, findOrCreateCase, findOrCreateParty } from './lookups';

export type AdaInput = {
  caseNo: string; direction: Direction; entryDate: string; market?: string; vehicle?: string; weight?: string;
  fromPlace?: string; toPlace?: string; empty?: string; partyName?: string;
  freightRate: number; commissionType: CommissionType; commissionValue: number;
  mtAmount: number; mtMode: AdjustMode; dihariDays: number | null; dihariRate: number | null; dihariMode: AdjustMode;
  /** On create it becomes the first receipt. On edit it replaces the single receipt, if there is at most one. */
  received?: number;
};

export type AdaView = {
  id: string; case_id: string; case_no: string; party_id: string | null; party_name: string | null;
  direction: Direction; entry_date: string; market: string | null; vehicle: string | null; weight: string | null;
  from_place: string | null; to_place: string | null; empty: string | null;
  freight_rate: number; commission_type: CommissionType; commission_value: number;
  mt_amount: number; mt_mode: AdjustMode; dihari_days: number | null; dihari_rate: number | null; dihari_mode: AdjustMode;
  /** Free-text notes from before M.T. and Dihari became amounts. */
  empty_mt: string | null; dihari: string | null;
  received: number; receipt_count: number;
  /** commission, net (after commission), dihari_total, due (net with M.T. and Dihari) and balance are calculated. */
  commission: number; net: number; dihari_total: number; due: number; balance: number; deleted_at: string | null;
};

export type Receipt = { id: string; ada_id: string; receipt_date: string; amount: number; note: string | null };

export type ReceiptWithAda = Receipt & { case_no: string; party_name: string | null; direction: Direction; entry_date: string };

const selectAda = `
  SELECT a.*, c.case_no, p.name AS party_name,
    COALESCE((SELECT SUM(r.amount) FROM ada_receipts r WHERE r.ada_id = a.id AND r.deleted_at IS NULL), 0) AS received,
    (SELECT COUNT(*) FROM ada_receipts r WHERE r.ada_id = a.id AND r.deleted_at IS NULL) AS receipt_count
  FROM ada_entries a JOIN cases c ON c.id = a.case_id LEFT JOIN parties p ON p.id = a.party_id`;

type AdaRow = Omit<AdaView, 'commission' | 'net' | 'dihari_total' | 'due' | 'balance'>;

function withTotals(row: AdaRow): AdaView {
  const dihari_total = dihariAmount(row.dihari_days, row.dihari_rate);
  const amounts = adaAmounts({
    freight: row.freight_rate, commissionType: row.commission_type, commissionValue: row.commission_value,
    mt: row.mt_amount, mtMode: row.mt_mode, dihari: dihari_total, dihariMode: row.dihari_mode, received: row.received,
  });
  return { ...row, ...amounts, dihari_total };
}

export type AdaFilter = {
  search?: string; range?: DateRange; partyId?: string; vehicle?: string; market?: string; route?: string; direction?: Direction;
};

export async function listAda(db: Db, filter: AdaFilter = {}): Promise<AdaView[]> {
  const rows = await db.all<AdaRow>(`${selectAda} WHERE a.deleted_at IS NULL ORDER BY a.entry_date DESC, a.created_at DESC`);
  const term = filter.search?.trim().toLowerCase();
  const key = referenceKey(filter.search);
  return rows.map(withTotals).filter((r) => {
    if (filter.range && !inRange(r.entry_date, filter.range)) return false;
    if (filter.partyId && r.party_id !== filter.partyId) return false;
    if (filter.direction && r.direction !== filter.direction) return false;
    if (filter.vehicle && !referenceKey(r.vehicle).includes(referenceKey(filter.vehicle))) return false;
    if (filter.market && !(r.market ?? '').toLowerCase().includes(filter.market.toLowerCase())) return false;
    if (filter.route && !`${r.from_place ?? ''} ${r.to_place ?? ''}`.toLowerCase().includes(filter.route.toLowerCase())) return false;
    if (!term) return true;
    return (
      (key !== '' && (referenceKey(r.case_no).includes(key) || referenceKey(r.vehicle).includes(key))) ||
      [r.party_name, r.market, r.from_place, r.to_place].some((v) => (v ?? '').toLowerCase().includes(term))
    );
  });
}

export async function getAda(db: Db, id: string): Promise<AdaView | null> {
  const row = await db.get<AdaRow>(`${selectAda} WHERE a.id = ?`, [id]);
  return row ? withTotals(row) : null;
}

export async function adaForCase(db: Db, caseId: string): Promise<AdaView[]> {
  const rows = await db.all<AdaRow>(`${selectAda} WHERE a.case_id = ? AND a.deleted_at IS NULL ORDER BY a.direction DESC, a.entry_date`, [caseId]);
  return rows.map(withTotals);
}

export async function adaForParty(db: Db, partyId: string): Promise<AdaView[]> {
  const rows = await db.all<AdaRow>(`${selectAda} WHERE a.party_id = ? AND a.deleted_at IS NULL ORDER BY a.entry_date DESC`, [partyId]);
  return rows.map(withTotals);
}

export function listReceipts(db: Db, adaId: string) {
  return db.all<Receipt>('SELECT * FROM ada_receipts WHERE ada_id = ? AND deleted_at IS NULL ORDER BY receipt_date, created_at', [adaId]);
}

export async function listAllReceipts(db: Db, filter: { search?: string; range?: DateRange } = {}): Promise<ReceiptWithAda[]> {
  const rows = await db.all<ReceiptWithAda>(
    `SELECT r.*, c.case_no, p.name AS party_name, a.direction, a.entry_date
     FROM ada_receipts r
     JOIN ada_entries a ON a.id = r.ada_id
     JOIN cases c ON c.id = a.case_id
     LEFT JOIN parties p ON p.id = a.party_id
     WHERE r.deleted_at IS NULL AND a.deleted_at IS NULL
     ORDER BY r.receipt_date DESC, r.created_at DESC`
  );
  const term = filter.search?.trim().toLowerCase();
  const key = referenceKey(filter.search);
  return rows.filter((r) => {
    if (filter.range && !inRange(r.receipt_date, filter.range)) return false;
    if (!term) return true;
    return (key !== '' && (referenceKey(r.case_no).includes(key))) || (r.party_name ?? '').toLowerCase().includes(term);
  });
}

/** The Ada entries already on this Case # and trip direction, used for the duplicate warning. */
export async function existingAdaForCaseNo(db: Db, caseNo: string, direction: Direction, exceptId?: string): Promise<AdaView[]> {
  const found = await findCaseByNo(db, caseNo);
  if (!found) return [];
  return (await adaForCase(db, found.id)).filter((a) => a.id !== exceptId && a.direction === direction);
}

function validate(input: AdaInput) {
  if (!referenceKey(input.caseNo)) throw new AppError('errors.caseRequired');
  const commission = commissionAmount(input.freightRate, input.commissionType, input.commissionValue);
  if (commission > input.freightRate) throw new AppError('errors.commissionTooHigh');
  if (input.dihariDays !== null && (!Number.isInteger(input.dihariDays) || input.dihariDays < 0)) throw new AppError('errors.invalidDays');
  if (input.received !== undefined && input.received < 0) throw new AppError('errors.invalidAmount');
}

function toRow(input: AdaInput, caseId: string, partyId: string | null) {
  return {
    case_id: caseId, party_id: partyId, direction: input.direction, entry_date: input.entryDate,
    // Market is no longer asked for; older entries keep what they had.
    ...(input.market === undefined ? {} : { market: input.market.trim() || null }),
    vehicle: input.vehicle?.trim() || null,
    vehicle_key: referenceKey(input.vehicle) || null,
    weight: input.weight?.trim() || null,
    from_place: input.fromPlace?.trim() || null,
    to_place: input.toPlace?.trim() || null,
    empty: input.empty?.trim() || null,
    freight_rate: input.freightRate,
    commission_type: input.commissionType,
    commission_value: input.commissionValue,
    mt_amount: input.mtAmount,
    mt_mode: input.mtMode,
    dihari_days: input.dihariDays,
    dihari_rate: input.dihariRate,
    dihari_mode: input.dihariMode,
  };
}

export async function createAda(db: Db, input: AdaInput): Promise<string> {
  validate(input);
  return db.tx(async () => {
    const caseRow = await findOrCreateCase(db, input.caseNo);
    const party = input.partyName?.trim() ? await findOrCreateParty(db, input.partyName) : null;
    const id = await insert(db, 'ada_entries', toRow(input, caseRow.id, party));
    if (input.received) {
      await insert(db, 'ada_receipts', { ada_id: id, receipt_date: input.entryDate, amount: input.received, note: null });
    }
    return id;
  });
}

export async function updateAda(db: Db, id: string, input: AdaInput): Promise<void> {
  validate(input);
  await db.tx(async () => {
    const caseRow = await findOrCreateCase(db, input.caseNo);
    const party = input.partyName?.trim() ? await findOrCreateParty(db, input.partyName) : null;
    await update(db, 'ada_entries', id, toRow(input, caseRow.id, party));
    if (input.received !== undefined) await setSingleReceipt(db, id, input.received, input.entryDate);
  });
}

/**
 * Lets the edit form change Received directly while an entry has no more than one receipt.
 * With several receipts each one has its own date, so they are changed one by one instead.
 */
async function setSingleReceipt(db: Db, adaId: string, amount: number, date: string) {
  const receipts = await listReceipts(db, adaId);
  if (receipts.length > 1) {
    if (amount !== sum(receipts.map((r) => r.amount))) throw new AppError('errors.severalReceipts');
    return;
  }
  const [only] = receipts;
  if (!only) {
    if (amount > 0) await insert(db, 'ada_receipts', { ada_id: adaId, receipt_date: date, amount, note: null });
  } else if (amount > 0) {
    await update(db, 'ada_receipts', only.id, { amount });
  } else {
    // Same as the Recycle Bin's delete, so the receipt can still be restored from there.
    await db.run('UPDATE ada_receipts SET deleted_at = ?, updated_at = ? WHERE id = ?', [nowStamp(), nowStamp(), only.id]);
    await logChange(db, 'ada_receipts', only.id, 'deleted');
  }
}

export async function addReceipt(db: Db, adaId: string, amount: number, date: string = today(), note?: string) {
  if (amount <= 0) throw new AppError('errors.amountRequired');
  return db.tx(() => insert(db, 'ada_receipts', { ada_id: adaId, receipt_date: date, amount, note: note?.trim() || null }));
}

export async function updateReceipt(db: Db, id: string, amount: number, date: string, note?: string) {
  if (amount <= 0) throw new AppError('errors.amountRequired');
  await db.tx(() => update(db, 'ada_receipts', id, { amount, receipt_date: date, note: note?.trim() || null }));
}

export const adaTotals = (rows: readonly AdaView[]) => ({
  freight: sum(rows.map((r) => r.freight_rate)),
  commission: sum(rows.map((r) => r.commission)),
  net: sum(rows.map((r) => r.net)),
  due: sum(rows.map((r) => r.due)),
  received: sum(rows.map((r) => r.received)),
  balance: sum(rows.map((r) => r.balance)),
});
