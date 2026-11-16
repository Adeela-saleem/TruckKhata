import { insuranceStatus, type InsuranceStatus } from '../domain/calc';
import { inRange, today, type DateRange } from '../domain/dates';
import { referenceKey } from '../domain/keys';
import { AppError, insert, nowStamp, update, type Db } from '../db/core';
import { getReminderDays } from './settings';

export type InsuranceRow = {
  id: string; vehicle: string; category: string | null; company: string | null; policy_no: string | null;
  start_date: string | null; expiry_date: string; notes: string | null; attachment_uri: string | null; archived_at: string | null;
};
export type InsuranceView = InsuranceRow & { status: InsuranceStatus };

export type InsuranceFilter = { search?: string; status?: InsuranceStatus; range?: DateRange; archived?: boolean };

export async function listInsurance(db: Db, filter: InsuranceFilter = {}): Promise<InsuranceView[]> {
  const rows = await db.all<InsuranceRow>(
    `SELECT * FROM insurance WHERE deleted_at IS NULL AND archived_at IS ${filter.archived ? 'NOT NULL' : 'NULL'} ORDER BY expiry_date`,
  );
  const days = await getReminderDays(db);
  const key = referenceKey(filter.search);
  return rows
    .map((r) => ({ ...r, status: insuranceStatus(r.expiry_date, today(), days) }))
    .filter((r) => (!key || referenceKey(r.vehicle).includes(key))
      && (!filter.status || r.status === filter.status)
      && (!filter.range || inRange(r.expiry_date, filter.range)));
}

export async function getInsurance(db: Db, id: string): Promise<InsuranceView | null> {
  const row = await db.get<InsuranceRow>('SELECT * FROM insurance WHERE id = ?', [id]);
  return row ? { ...row, status: insuranceStatus(row.expiry_date, today(), await getReminderDays(db)) } : null;
}

export type InsuranceInput = {
  vehicle: string; category?: string; company?: string; policyNo?: string; startDate?: string | null;
  expiryDate: string; notes?: string; attachmentUri?: string | null;
};

export async function saveInsurance(db: Db, input: InsuranceInput, id?: string): Promise<string> {
  if (!referenceKey(input.vehicle)) throw new AppError('errors.vehicleRequired');
  if (!input.expiryDate) throw new AppError('errors.expiryRequired');
  if (input.startDate && input.startDate > input.expiryDate) throw new AppError('errors.startAfterExpiry');
  const row = {
    vehicle: input.vehicle.trim(), vehicle_key: referenceKey(input.vehicle), category: input.category?.trim() || null,
    // Company is no longer asked for; older records keep what they had.
    ...(input.company === undefined ? {} : { company: input.company.trim() || null }),
    policy_no: input.policyNo?.trim() || null, start_date: input.startDate ?? null,
    expiry_date: input.expiryDate, notes: input.notes?.trim() || null, attachment_uri: input.attachmentUri ?? null,
  };
  return db.tx(async () => {
    if (id) {
      await update(db, 'insurance', id, row);
      return id;
    }
    return insert(db, 'insurance', row);
  });
}

export function setInsuranceArchived(db: Db, id: string, archived: boolean) {
  return db.tx(() => update(db, 'insurance', id, { archived_at: archived ? nowStamp() : null }));
}
