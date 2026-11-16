import { nameKey, referenceKey } from '../domain/keys';
import { AppError, insert, type Db } from '../db/core';

export type CaseRow = { id: string; case_no: string; case_key: string; cycle_freight: number | null; completed_at: string | null; created_at: string };

export const findCaseByNo = (db: Db, caseNo: string) =>
  db.get<CaseRow>('SELECT * FROM cases WHERE case_key = ?', [referenceKey(caseNo)]);

/** Must run inside a transaction. Cases are never deleted, so restored records relink themselves. */
export async function findOrCreateCase(db: Db, caseNo: string): Promise<CaseRow> {
  const key = referenceKey(caseNo);
  if (!key) throw new AppError('errors.caseRequired');
  const found = await findCaseByNo(db, caseNo);
  if (found) return found;
  const id = await insert(db, 'cases', { case_no: caseNo.trim(), case_key: key, cycle_freight: null, completed_at: null });
  return (await db.get<CaseRow>('SELECT * FROM cases WHERE id = ?', [id])) as CaseRow;
}

/** Must run inside a transaction: finds a party by name, or creates it. */
export async function findOrCreateParty(db: Db, name: string): Promise<string> {
  const key = nameKey(name);
  const found = await db.get<{ id: string }>('SELECT id FROM parties WHERE name_key = ? AND deleted_at IS NULL', [key]);
  if (found) return found.id;
  return insert(db, 'parties', { name: name.trim().replace(/\s+/g, ' '), name_key: key });
}
