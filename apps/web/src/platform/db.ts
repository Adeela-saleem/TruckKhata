import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Db, type Param, type RawDb } from '../core/db/core';
import { migrate } from '../core/db/schema';
import { idbGet, idbSet } from './idb';

/**
 * The whole database lives in the browser: sql.js runs SQLite in memory and the file is
 * saved to IndexedDB shortly after every change. Other open tabs reload when one saves.
 */
const KEY = 'truckkhata.db';
const SAVE_DELAY = 300;

let SQL: SqlJsStatic;
let sqlite: Database;
let inTx = false;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('truck-khata');
const tabId = Math.random().toString(36).slice(2);
const listeners = new Set<() => void>();

/** sql.js resets pragmas when it exports, so they are set again each time. */
const pragmas = () => sqlite.exec('PRAGMA foreign_keys = ON');

function schedule() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => void save(), SAVE_DELAY);
}

/** Never export in the middle of a transaction: export closes and reopens the database. */
export function save(): Promise<void> {
  if (!dirty) return saving;
  if (inTx) {
    schedule();
    return saving;
  }
  dirty = false;
  const bytes = sqlite.export();
  pragmas();
  saving = saving.then(() => idbSet('db', KEY, bytes)).then(() => {
    channel?.postMessage({ type: 'saved', from: tabId });
  });
  return saving;
}

const raw: RawDb = {
  async exec(sql) {
    const head = sql.trim().slice(0, 8).toUpperCase();
    if (head.startsWith('BEGIN')) inTx = true;
    sqlite.exec(sql);
    if (head.startsWith('COMMIT') || head.startsWith('ROLLBACK')) inTx = false;
    if (!head.startsWith('BEGIN')) schedule();
  },
  async run(sql, params: Param[]) {
    sqlite.run(sql, params);
    schedule();
  },
  async all<T>(sql: string, params: Param[]) {
    const stmt = sqlite.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  },
};

async function load() {
  const bytes = await idbGet<Uint8Array>('db', KEY);
  sqlite?.close();
  sqlite = bytes ? new SQL.Database(bytes) : new SQL.Database();
  pragmas();
}

export async function openDb(): Promise<Db> {
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  await load();
  const db = new Db(raw);
  await migrate(db);
  await save();
  channel?.addEventListener('message', async (event) => {
    if (event.data?.type !== 'saved' || event.data.from === tabId || inTx) return;
    await load();
    listeners.forEach((fn) => fn());
  });
  // Save before the tab goes away, so the last change is never lost.
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void save(); });
  addEventListener('pagehide', () => void save());
  return db;
}

/** Called when another tab saved, so screens can reload what they show. */
export function onExternalChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Bytes of the current database, for a full backup. */
export function databaseBytes(): Uint8Array {
  const bytes = sqlite.export();
  pragmas();
  return bytes;
}
