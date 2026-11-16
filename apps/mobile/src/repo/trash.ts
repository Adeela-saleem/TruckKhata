import { nowStamp, logChange, AppError, type Db } from '../db/core';
import { referenceKey } from '../domain/keys';

export type TrashTable = 'ada_entries' | 'ada_receipts' | 'parties' | 'party_adjustments' | 'trip_legs' | 'expenses' | 'bills' | 'insurance';

export type TrashItem = { table: TrashTable; id: string; title: string; subtitle: string | null; amount: number | null; deletedAt: string };

const sources: Record<TrashTable, string> = {
  ada_entries: `SELECT a.id, c.case_no AS title, a.vehicle AS subtitle, a.freight_rate AS amount, a.deleted_at AS deletedAt
    FROM ada_entries a JOIN cases c ON c.id = a.case_id WHERE a.deleted_at IS NOT NULL`,
  ada_receipts: `SELECT r.id, c.case_no AS title, r.note AS subtitle, r.amount, r.deleted_at AS deletedAt
    FROM ada_receipts r JOIN ada_entries a ON a.id = r.ada_id JOIN cases c ON c.id = a.case_id WHERE r.deleted_at IS NOT NULL`,
  parties: `SELECT id, name AS title, phone AS subtitle, NULL AS amount, deleted_at AS deletedAt FROM parties WHERE deleted_at IS NOT NULL`,
  party_adjustments: `SELECT j.id, p.name AS title, j.note AS subtitle, j.amount, j.deleted_at AS deletedAt
    FROM party_adjustments j JOIN parties p ON p.id = j.party_id WHERE j.deleted_at IS NOT NULL`,
  trip_legs: `SELECT l.id, c.case_no AS title, l.direction AS subtitle, NULL AS amount, l.deleted_at AS deletedAt
    FROM trip_legs l JOIN cases c ON c.id = l.case_id WHERE l.deleted_at IS NOT NULL`,
  expenses: `SELECT e.id, c.case_no AS title, e.category AS subtitle, e.amount, e.deleted_at AS deletedAt
    FROM expenses e JOIN cases c ON c.id = e.case_id WHERE e.deleted_at IS NOT NULL`,
  bills: `SELECT id, vendor AS title, vehicle AS subtitle, NULL AS amount, deleted_at AS deletedAt FROM bills WHERE deleted_at IS NOT NULL`,
  insurance: `SELECT id, vehicle AS title, category AS subtitle, NULL AS amount, deleted_at AS deletedAt FROM insurance WHERE deleted_at IS NOT NULL`,
};

export async function listTrash(db: Db): Promise<TrashItem[]> {
  const groups = await Promise.all(
    (Object.keys(sources) as TrashTable[]).map(async (table) =>
      (await db.all<Omit<TrashItem, 'table'>>(sources[table])).map((row) => ({ ...row, table }))),
  );
  return groups.flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export type DeleteImpact = { key: string; count?: number };

/** What the user should know before deleting a linked record (SRS 10 FR-06). */
export async function deleteImpact(db: Db, table: TrashTable, id: string): Promise<DeleteImpact[]> {
  const count = async (sql: string) => (await db.get<{ n: number }>(sql, [id]))?.n ?? 0;
  const impacts: DeleteImpact[] = [];
  if (table === 'ada_entries') {
    impacts.push({ key: 'impact.adaParty' });
    const receipts = await count('SELECT COUNT(*) AS n FROM ada_receipts WHERE ada_id = ? AND deleted_at IS NULL');
    if (receipts) impacts.push({ key: 'impact.adaReceipts', count: receipts });
    impacts.push({ key: 'impact.adaProfit' });
  }
  if (table === 'ada_receipts') impacts.push({ key: 'impact.receipt' });
  if (table === 'parties') {
    const entries = await count('SELECT COUNT(*) AS n FROM ada_entries WHERE party_id = ? AND deleted_at IS NULL');
    if (entries) impacts.push({ key: 'impact.partyEntries', count: entries });
  }
  if (table === 'party_adjustments') impacts.push({ key: 'impact.adjustment' });
  if (table === 'trip_legs') {
    const completed = await db.get('SELECT 1 FROM trip_legs l JOIN cases c ON c.id = l.case_id WHERE l.id = ? AND c.completed_at IS NOT NULL', [id]);
    if (completed) impacts.push({ key: 'impact.legComplete' });
    impacts.push({ key: 'impact.leg' });
  }
  if (table === 'expenses') impacts.push({ key: 'impact.expense' });
  if (table === 'bills') {
    const counted = await db.get('SELECT 1 FROM bills WHERE id = ? AND count_in_profit = 1 AND case_id IS NOT NULL', [id]);
    if (counted) impacts.push({ key: 'impact.billProfit' });
  }
  return impacts;
}

export async function softDelete(db: Db, table: TrashTable, id: string): Promise<void> {
  await db.tx(async () => {
    await db.run(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [nowStamp(), nowStamp(), id]);
    await logChange(db, table, id, 'deleted');
    if (table === 'trip_legs') {
      // A cycle missing a leg cannot stay complete: its profit returns to provisional.
      await db.run(`UPDATE cases SET completed_at = NULL WHERE id = (SELECT case_id FROM trip_legs WHERE id = ?)`, [id]);
    }
  });
}

/** Restoring a leg can collide with one added since; a party can collide on name. */
export async function restore(db: Db, table: TrashTable, id: string): Promise<void> {
  await db.tx(async () => {
    if (table === 'trip_legs') {
      const clash = await db.get(
        `SELECT other.id FROM trip_legs me JOIN trip_legs other
           ON other.case_id = me.case_id AND other.direction = me.direction AND other.id <> me.id
         WHERE me.id = ? AND other.deleted_at IS NULL`, [id]);
      if (clash) throw new AppError('errors.restoreLegClash');
    }
    if (table === 'parties') {
      const clash = await db.get(
        `SELECT other.id FROM parties me JOIN parties other ON other.name_key = me.name_key AND other.id <> me.id
         WHERE me.id = ? AND other.deleted_at IS NULL`, [id]);
      if (clash) throw new AppError('errors.restorePartyClash');
    }
    await db.run(`UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [nowStamp(), id]);
    await logChange(db, table, id, 'restored');
  });
}

export async function purge(db: Db, table: TrashTable, id: string): Promise<void> {
  await db.tx(async () => {
    await db.run(`DELETE FROM ${table} WHERE id = ? AND deleted_at IS NOT NULL`, [id]);
    await logChange(db, table, id, 'purged');
  });
}

export type LogEntry = { id: string; table_name: string; action: string; field: string | null; old_value: string | null; new_value: string | null; at: string };

export function historyFor(db: Db, recordId: string) {
  return db.all<LogEntry>('SELECT * FROM change_log WHERE record_id = ? ORDER BY at DESC, rowid DESC', [recordId]);
}

export type SearchHit = { caseId: string; caseNo: string; hasAda: boolean; hasTrip: boolean };

/** Home search: matching Case #s, each opening the screen that links all its records. */
export async function searchCases(db: Db, term: string): Promise<SearchHit[]> {
  const key = referenceKey(term);
  if (!key) return [];
  const rows = await db.all<{ id: string; case_no: string; ada: number; legs: number; other: number }>(
    `SELECT c.id, c.case_no,
       (SELECT COUNT(*) FROM ada_entries a WHERE a.case_id = c.id AND a.deleted_at IS NULL) AS ada,
       (SELECT COUNT(*) FROM trip_legs l WHERE l.case_id = c.id AND l.deleted_at IS NULL) AS legs,
       (SELECT COUNT(*) FROM bills b WHERE b.case_id = c.id AND b.deleted_at IS NULL) AS other
     FROM cases c WHERE c.case_key LIKE ? ORDER BY (c.case_key = ?) DESC, c.case_key LIMIT 30`,
    [`%${key}%`, key],
  );
  return rows
    .filter((r) => r.ada + r.legs + r.other > 0)
    .map((r) => ({ caseId: r.id, caseNo: r.case_no, hasAda: r.ada > 0, hasTrip: r.legs > 0 }));
}
