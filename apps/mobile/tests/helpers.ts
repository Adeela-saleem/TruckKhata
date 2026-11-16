import { DatabaseSync } from 'node:sqlite';
import { Db, type Param, type RawDb } from '../src/db/core';
import { migrate } from '../src/db/schema';

export async function testDb(): Promise<Db> {
  const sqlite = new DatabaseSync(':memory:');
  const raw: RawDb = {
    async exec(sql) { sqlite.exec(sql); },
    async run(sql, params: Param[]) { sqlite.prepare(sql).run(...params); },
    async all<T>(sql: string, params: Param[]) { return sqlite.prepare(sql).all(...params) as T[]; },
  };
  const db = new Db(raw);
  await migrate(db);
  return db;
}
