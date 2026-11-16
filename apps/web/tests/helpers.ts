import initSqlJs from 'sql.js';
import { Db } from '../src/core/db/core';
import { migrate } from '../src/core/db/schema';
import { sqljsRaw } from '../src/core/db/sqljs';

const SQL = initSqlJs();

export async function testDb(): Promise<Db> {
  const db = new Db(sqljsRaw(new (await SQL).Database()));
  await migrate(db);
  return db;
}
