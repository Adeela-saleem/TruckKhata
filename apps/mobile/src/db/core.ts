export type Param = string | number | null;

export interface RawDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params: Param[]): Promise<void>;
  all<T>(sql: string, params: Param[]): Promise<T[]>;
}

export class Db {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private raw: RawDb) {}

  exec(sql: string) {
    return this.raw.exec(sql);
  }
  run(sql: string, params: Param[] = []) {
    return this.raw.run(sql, params);
  }
  all<T>(sql: string, params: Param[] = []) {
    return this.raw.all<T>(sql, params);
  }
  async get<T>(sql: string, params: Param[] = []): Promise<T | null> {
    return (await this.raw.all<T>(sql, params))[0] ?? null;
  }

  /** Runs one transaction at a time. Do not call tx from inside tx. */
  tx<T>(work: () => Promise<T>): Promise<T> {
    const run = async () => {
      await this.raw.exec('BEGIN');
      try {
        const result = await work();
        await this.raw.exec('COMMIT');
        return result;
      } catch (error) {
        await this.raw.exec('ROLLBACK');
        throw error;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** Error with a translation key, so the UI can always explain what happened. */
export class AppError extends Error {
  constructor(public key: string, public detail?: string) {
    super(key);
  }
}

export function newId(): string {
  const random = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${Date.now().toString(36)}-${random()}${random()}`;
}

export const nowStamp = () => new Date().toISOString();

export type Row = Record<string, Param>;

/** The log column is TEXT; binding a number directly can store "900.0". */
const asText = (value: Param) => (value === null ? null : String(value));

export async function logChange(
  db: Db, table: string, recordId: string, action: string,
  field: string | null = null, oldValue: Param = null, newValue: Param = null,
) {
  await db.run(
    'INSERT INTO change_log (id, table_name, record_id, action, field, old_value, new_value, at) VALUES (?,?,?,?,?,?,?,?)',
    [newId(), table, recordId, action, field, asText(oldValue), asText(newValue), nowStamp()],
  );
}

export async function insert(db: Db, table: string, values: Row): Promise<string> {
  const id = (values.id as string) ?? newId();
  const stamp = nowStamp();
  const row: Row = { ...values, id, created_at: stamp, updated_at: stamp };
  const keys = Object.keys(row);
  await db.run(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    keys.map((k) => row[k]),
  );
  await logChange(db, table, id, 'created');
  return id;
}

/** Updates only what changed, and records each change for the history view. */
export async function update(db: Db, table: string, id: string, values: Row): Promise<void> {
  const current = await db.get<Row>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!current) throw new AppError('errors.notFound');
  const changed = Object.keys(values).filter((k) => (current[k] ?? null) !== (values[k] ?? null));
  if (changed.length === 0) return;
  await db.run(
    `UPDATE ${table} SET ${changed.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...changed.map((k) => values[k] ?? null), nowStamp(), id],
  );
  for (const field of changed) await logChange(db, table, id, 'edited', field, current[field] ?? null, values[field] ?? null);
}
