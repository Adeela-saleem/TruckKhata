import type { Database } from 'sql.js';
import type { Param, RawDb } from './core';

/** Adapts a sql.js database to the small interface the repositories use. */
export function sqljsRaw(sqlite: Database, onWrite: () => void = () => {}): RawDb {
  return {
    async exec(sql) {
      sqlite.exec(sql);
      onWrite();
    },
    async run(sql, params: Param[]) {
      sqlite.run(sql, params);
      onWrite();
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
}
