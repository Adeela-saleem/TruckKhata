/**
 * Builds a demo database file with the in-app sample data, for screenshots and manual testing.
 * Run: npx vite-node scripts/seed.ts -- out.db
 */
import { writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { Db } from '../src/core/db/core';
import { migrate } from '../src/core/db/schema';
import { sqljsRaw } from '../src/core/db/sqljs';
import { setSetting } from '../src/core/repo/settings';
import { loadSampleData } from '../src/core/sample';

const out = process.argv[process.argv.length - 1];
const SQL = await initSqlJs();
const sqlite = new SQL.Database();
const db = new Db(sqljsRaw(sqlite));
await migrate(db);
await loadSampleData(db);
await setSetting(db, 'last_backup_at', new Date().toISOString());
writeFileSync(out, sqlite.export());
console.log('seeded', out);
