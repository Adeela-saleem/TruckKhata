import type { Db } from './core';

const base = `id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT`;

/** Append new migrations to the end. Never edit one that has shipped. */
const migrations: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE parties (${base},
    name TEXT NOT NULL, name_key TEXT NOT NULL, phone TEXT, address TEXT, archived_at TEXT);
  CREATE INDEX parties_name ON parties(name_key);

  CREATE TABLE cases (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    case_no TEXT NOT NULL, case_key TEXT NOT NULL UNIQUE, cycle_freight INTEGER, completed_at TEXT);

  CREATE TABLE ada_entries (${base},
    case_id TEXT NOT NULL REFERENCES cases(id),
    party_id TEXT REFERENCES parties(id) ON DELETE SET NULL,
    entry_date TEXT NOT NULL, market TEXT, vehicle TEXT, vehicle_key TEXT, weight TEXT,
    from_place TEXT, to_place TEXT, empty TEXT,
    freight_rate INTEGER NOT NULL DEFAULT 0,
    commission_type TEXT NOT NULL DEFAULT 'fixed', commission_value INTEGER NOT NULL DEFAULT 0,
    empty_mt TEXT, dihari TEXT);
  CREATE INDEX ada_case ON ada_entries(case_id);
  CREATE INDEX ada_party ON ada_entries(party_id);

  CREATE TABLE ada_receipts (${base},
    ada_id TEXT NOT NULL REFERENCES ada_entries(id) ON DELETE CASCADE,
    receipt_date TEXT NOT NULL, amount INTEGER NOT NULL, note TEXT);
  CREATE INDEX receipts_ada ON ada_receipts(ada_id);

  CREATE TABLE party_adjustments (${base},
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    case_id TEXT REFERENCES cases(id),
    adj_date TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('payment','charge')),
    amount INTEGER NOT NULL, note TEXT);
  CREATE INDEX adjustments_party ON party_adjustments(party_id);

  CREATE TABLE trip_legs (${base},
    case_id TEXT NOT NULL REFERENCES cases(id),
    party_id TEXT REFERENCES parties(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('outward','return')),
    trip_date TEXT NOT NULL, vehicle TEXT, vehicle_key TEXT, from_place TEXT, to_place TEXT,
    driver TEXT, advance INTEGER, weight TEXT, item_details TEXT);
  CREATE INDEX legs_case ON trip_legs(case_id);

  CREATE TABLE expenses (${base},
    case_id TEXT NOT NULL REFERENCES cases(id),
    category TEXT NOT NULL, description TEXT, amount INTEGER NOT NULL,
    expense_date TEXT NOT NULL, vendor TEXT, notes TEXT);
  CREATE INDEX expenses_case ON expenses(case_id);

  CREATE TABLE bills (${base},
    case_id TEXT REFERENCES cases(id),
    bill_date TEXT NOT NULL, vendor TEXT NOT NULL, vendor_key TEXT NOT NULL,
    vehicle TEXT, vehicle_key TEXT, paid INTEGER NOT NULL DEFAULT 0, notes TEXT,
    count_in_profit INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX bills_case ON bills(case_id);

  CREATE TABLE bill_lines (id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, description TEXT NOT NULL, quantity TEXT, unit TEXT, amount INTEGER NOT NULL);
  CREATE INDEX lines_bill ON bill_lines(bill_id);

  CREATE TABLE insurance (${base},
    vehicle TEXT NOT NULL, vehicle_key TEXT NOT NULL, category TEXT, company TEXT, policy_no TEXT,
    start_date TEXT, expiry_date TEXT NOT NULL, notes TEXT, attachment_uri TEXT, archived_at TEXT);

  CREATE TABLE change_log (id TEXT PRIMARY KEY, table_name TEXT NOT NULL, record_id TEXT NOT NULL,
    action TEXT NOT NULL, field TEXT, old_value TEXT, new_value TEXT, at TEXT NOT NULL);
  CREATE INDEX log_record ON change_log(record_id);
  `,
  // Addendum: outward/return Ada files, M.T. and Dihari as signed amounts, trip-sheet expense columns.
  // The old free-text empty_mt and dihari columns stay; plain numbers in them are carried over.
  `
  ALTER TABLE ada_entries ADD COLUMN direction TEXT NOT NULL DEFAULT 'outward';
  ALTER TABLE ada_entries ADD COLUMN mt_amount INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ada_entries ADD COLUMN mt_mode TEXT NOT NULL DEFAULT 'add';
  ALTER TABLE ada_entries ADD COLUMN dihari_days INTEGER;
  ALTER TABLE ada_entries ADD COLUMN dihari_rate INTEGER;
  ALTER TABLE ada_entries ADD COLUMN dihari_mode TEXT NOT NULL DEFAULT 'add';
  UPDATE ada_entries SET mt_amount = CAST(trim(empty_mt) AS INTEGER) * 100, empty_mt = NULL
    WHERE trim(empty_mt) <> '' AND trim(empty_mt) NOT GLOB '*[^0-9]*';
  UPDATE ada_entries SET dihari_days = 1, dihari_rate = CAST(trim(dihari) AS INTEGER) * 100, dihari = NULL
    WHERE trim(dihari) <> '' AND trim(dihari) NOT GLOB '*[^0-9]*';

  ALTER TABLE expenses ADD COLUMN slip_no TEXT;
  ALTER TABLE expenses ADD COLUMN quantity TEXT;
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.exec('PRAGMA foreign_keys = ON');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  for (let i = version; i < migrations.length; i++) {
    await db.tx(async () => {
      await db.exec(migrations[i]);
      await db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}

export const userTables = [
  'settings', 'parties', 'cases', 'ada_entries', 'ada_receipts', 'party_adjustments',
  'trip_legs', 'expenses', 'bills', 'bill_lines', 'insurance', 'change_log',
] as const;

export const schemaVersion = migrations.length;
