import { AppError, type Db, type Param } from '../db/core';
import { schemaVersion, userTables } from '../db/schema';

export type BackupFile = {
  app: 'truck-khata'; schema: number; createdAt: string;
  tables: Record<string, Record<string, Param>[]>;
  attachments?: Record<string, string>;
};

export async function exportTables(db: Db): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const table of userTables) tables[table] = await db.all(`SELECT * FROM ${table}`);
  return { app: 'truck-khata', schema: schemaVersion, createdAt: new Date().toISOString(), tables };
}

export function parseBackup(text: string): BackupFile {
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError('errors.backupInvalid');
  }
  if (data?.app !== 'truck-khata' || !data.tables || typeof data.tables !== 'object') throw new AppError('errors.backupInvalid');
  if (typeof data.schema !== 'number' || data.schema > schemaVersion) throw new AppError('errors.backupNewer');
  for (const table of userTables) if (!Array.isArray(data.tables[table])) throw new AppError('errors.backupInvalid');
  return data;
}

/** Replaces everything, all or nothing: a bad file leaves the current data untouched. */
export async function restoreTables(db: Db, backup: BackupFile): Promise<void> {
  await db.tx(async () => {
    await db.exec('PRAGMA defer_foreign_keys = ON');
    for (const table of [...userTables].reverse()) await db.run(`DELETE FROM ${table}`);
    for (const table of userTables) {
      for (const row of backup.tables[table]) {
        const keys = Object.keys(row);
        await db.run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map((k) => row[k]));
      }
    }
  });
}
