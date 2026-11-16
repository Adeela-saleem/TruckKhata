import { partyOutstanding, sum } from '../domain/calc';
import { inRange, today, type DateRange } from '../domain/dates';
import { nameKey, referenceKey } from '../domain/keys';
import { AppError, insert, nowStamp, update, type Db } from '../db/core';
import { adaForParty, listAda, type AdaView } from './ada';
import { findOrCreateCase } from './lookups';

export type Party = {
  id: string; name: string; name_key: string; phone: string | null; address: string | null;
  archived_at: string | null; deleted_at: string | null;
};
export type PartyTotals = Party & { freight: number; received: number; outstanding: number; caseCount: number };

export type Adjustment = {
  id: string; party_id: string; case_id: string | null; case_no: string | null;
  adj_date: string; kind: 'payment' | 'charge'; amount: number; note: string | null;
};

export type PartyInput = { name: string; phone?: string; address?: string };

export async function saveParty(db: Db, input: PartyInput, id?: string): Promise<string> {
  const key = nameKey(input.name);
  if (!key) throw new AppError('errors.nameRequired');
  return db.tx(async () => {
    const same = await db.get<{ id: string }>('SELECT id FROM parties WHERE name_key = ? AND deleted_at IS NULL', [key]);
    if (same && same.id !== id) throw new AppError('errors.partyExists');
    const row = { name: input.name.trim().replace(/\s+/g, ' '), name_key: key, phone: input.phone?.trim() || null, address: input.address?.trim() || null };
    if (id) {
      await update(db, 'parties', id, row);
      return id;
    }
    return insert(db, 'parties', row);
  });
}

export const getParty = (db: Db, id: string) => db.get<Party>('SELECT * FROM parties WHERE id = ?', [id]);

export function setPartyArchived(db: Db, id: string, archived: boolean) {
  return db.tx(() => update(db, 'parties', id, { archived_at: archived ? nowStamp() : null }));
}

export function listAdjustments(db: Db, partyId: string) {
  return db.all<Adjustment>(
    `SELECT j.*, c.case_no FROM party_adjustments j LEFT JOIN cases c ON c.id = j.case_id
     WHERE j.party_id = ? AND j.deleted_at IS NULL ORDER BY j.adj_date DESC, j.created_at DESC`,
    [partyId],
  );
}

export function adjustmentsForCase(db: Db, caseId: string) {
  return db.all<Adjustment & { party_name: string }>(
    `SELECT j.*, p.name AS party_name FROM party_adjustments j JOIN parties p ON p.id = j.party_id
     WHERE j.case_id = ? AND j.deleted_at IS NULL ORDER BY j.adj_date`,
    [caseId],
  );
}

function totalsOf(party: Party, ada: readonly AdaView[], adjustments: readonly Pick<Adjustment, 'kind' | 'amount'>[]): PartyTotals {
  const of = (kind: Adjustment['kind']) => sum(adjustments.filter((j) => j.kind === kind).map((j) => j.amount));
  return {
    ...party,
    freight: sum(ada.map((a) => a.due)),
    received: sum(ada.map((a) => a.received)),
    outstanding: partyOutstanding(ada.map((a) => a.balance), of('payment'), of('charge')),
    caseCount: new Set(ada.map((a) => a.case_id)).size,
  };
}

export async function listParties(db: Db, opts: { search?: string; archived?: boolean } = {}): Promise<PartyTotals[]> {
  const parties = await db.all<Party>(
    `SELECT * FROM parties WHERE deleted_at IS NULL AND archived_at IS ${opts.archived ? 'NOT NULL' : 'NULL'} ORDER BY name_key`,
  );
  const ada = await listAda(db);
  const adjustments = await db.all<Adjustment>('SELECT party_id, kind, amount FROM party_adjustments WHERE deleted_at IS NULL');
  const term = nameKey(opts.search);
  return parties
    .filter((p) => !term || p.name_key.includes(term) || (p.phone ?? '').includes(term))
    .map((p) => totalsOf(p, ada.filter((a) => a.party_id === p.id), adjustments.filter((j) => j.party_id === p.id)));
}

export type LedgerEntry = {
  key: string; date: string; source: 'ada' | 'manual'; kind: 'freight' | 'receipt' | 'payment' | 'charge';
  caseNo: string | null; amount: number; note: string | null; refId: string;
};

export type PartyAccount = { party: PartyTotals; ada: AdaView[]; ledger: LedgerEntry[]; manualPayments: number; manualCharges: number };

export type LedgerFilter = { range?: DateRange; caseNo?: string; kind?: LedgerEntry['kind'] };

export async function partyAccount(db: Db, partyId: string, filter: LedgerFilter = {}): Promise<PartyAccount | null> {
  const party = await getParty(db, partyId);
  if (!party) return null;
  const ada = await adaForParty(db, partyId);
  const adjustments = await listAdjustments(db, partyId);
  const receipts = await db.all<{ id: string; ada_id: string; receipt_date: string; amount: number; note: string | null }>(
    `SELECT r.* FROM ada_receipts r JOIN ada_entries a ON a.id = r.ada_id
     WHERE a.party_id = ? AND a.deleted_at IS NULL AND r.deleted_at IS NULL`,
    [partyId],
  );
  const caseOf = new Map(ada.map((a) => [a.id, a.case_no]));
  const key = referenceKey(filter.caseNo);
  const ledger: LedgerEntry[] = [
    ...ada.map<LedgerEntry>((a) => ({ key: `f${a.id}`, date: a.entry_date, source: 'ada', kind: 'freight', caseNo: a.case_no, amount: a.due, note: null, refId: a.id })),
    ...receipts.map<LedgerEntry>((r) => ({ key: `r${r.id}`, date: r.receipt_date, source: 'ada', kind: 'receipt', caseNo: caseOf.get(r.ada_id) ?? null, amount: r.amount, note: r.note, refId: r.ada_id })),
    ...adjustments.map<LedgerEntry>((j) => ({ key: `j${j.id}`, date: j.adj_date, source: 'manual', kind: j.kind, caseNo: j.case_no, amount: j.amount, note: j.note, refId: j.id })),
  ]
    .filter((e) => {
      if (filter.range && !inRange(e.date, filter.range)) return false;
      if (filter.kind && e.kind !== filter.kind) return false;
      return !key || referenceKey(e.caseNo).includes(key);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    party: totalsOf(party, ada, adjustments),
    ada, ledger,
    manualPayments: sum(adjustments.filter((j) => j.kind === 'payment').map((j) => j.amount)),
    manualCharges: sum(adjustments.filter((j) => j.kind === 'charge').map((j) => j.amount)),
  };
}

export type AdjustmentInput = { partyId: string; kind: Adjustment['kind']; amount: number; date: string; note?: string; caseNo?: string };

/**
 * A payment already typed into Ada under the same Case # and amount is probably
 * the same money, so the form asks before saving it again.
 */
export async function findPossibleDoublePayment(db: Db, caseNo: string | undefined, amount: number): Promise<boolean> {
  const key = referenceKey(caseNo);
  if (!key) return false;
  const row = await db.get(
    `SELECT r.id FROM ada_receipts r JOIN ada_entries a ON a.id = r.ada_id JOIN cases c ON c.id = a.case_id
     WHERE c.case_key = ? AND r.amount = ? AND r.deleted_at IS NULL AND a.deleted_at IS NULL LIMIT 1`,
    [key, amount],
  );
  return row !== null;
}

/** The reverse check, for a receipt being added on an Ada entry. */
export async function findManualPaymentOnCase(db: Db, caseId: string, amount: number): Promise<boolean> {
  const row = await db.get(
    `SELECT id FROM party_adjustments WHERE case_id = ? AND amount = ? AND kind = 'payment' AND deleted_at IS NULL LIMIT 1`,
    [caseId, amount],
  );
  return row !== null;
}

export async function saveAdjustment(db: Db, input: AdjustmentInput, id?: string): Promise<string> {
  if (input.amount <= 0) throw new AppError('errors.amountRequired');
  return db.tx(async () => {
    const caseRow = referenceKey(input.caseNo) ? await findOrCreateCase(db, input.caseNo as string) : null;
    const row = { party_id: input.partyId, case_id: caseRow?.id ?? null, adj_date: input.date, kind: input.kind, amount: input.amount, note: input.note?.trim() || null };
    if (id) {
      await update(db, 'party_adjustments', id, row);
      return id;
    }
    return insert(db, 'party_adjustments', row);
  });
}

export const partyNames = async (db: Db) =>
  (await db.all<{ name: string }>('SELECT name FROM parties WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY name_key')).map((p) => p.name);

export type PaymentResult = { linked: true; caseNo: string } | { linked: false; id: string };

/**
 * A payment from a party for a Case # that has their Ada entry is the same money as Ada "Received",
 * so it is saved there as a receipt: Ada balance and party balance both change, and nothing is counted twice.
 * It fills the entries that still have a balance first; anything extra goes on the last entry.
 * Without a matching Ada entry it is kept as a manual payment.
 */
export async function recordPartyPayment(db: Db, input: Omit<AdjustmentInput, 'kind'>): Promise<PaymentResult> {
  if (input.amount <= 0) throw new AppError('errors.amountRequired');
  const key = referenceKey(input.caseNo);
  const entries = key
    ? (await adaForParty(db, input.partyId)).filter((a) => referenceKey(a.case_no) === key).sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    : [];
  if (entries.length === 0) {
    return { linked: false, id: await saveAdjustment(db, { ...input, kind: 'payment' }) };
  }
  await db.tx(async () => {
    let left = input.amount;
    for (const [i, entry] of entries.entries()) {
      const last = i === entries.length - 1;
      const share = last ? left : Math.min(left, Math.max(entry.balance, 0));
      if (share <= 0) continue;
      await insert(db, 'ada_receipts', { ada_id: entry.id, receipt_date: input.date || today(), amount: share, note: input.note?.trim() || null });
      left -= share;
    }
  });
  return { linked: true, caseNo: entries[0].case_no };
}
