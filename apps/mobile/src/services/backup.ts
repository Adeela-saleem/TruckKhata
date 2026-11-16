import { nowStamp, type Db } from '../db/core';
import { today } from '../domain/dates';
import { exportTables, parseBackup, restoreTables, type BackupFile } from '../repo/backup';
import { setSetting } from '../repo/settings';
import { pickFile, readAttachmentsBase64, readPickedText, shareTextFile, writeAttachmentsBase64 } from './files';

export async function createBackup(db: Db): Promise<void> {
  const backup = await exportTables(db);
  const names = backup.tables.insurance.map((r) => r.attachment_uri).filter((n): n is string => typeof n === 'string');
  backup.attachments = await readAttachmentsBase64(names);
  await shareTextFile(`truck-khata-backup-${today()}.json`, JSON.stringify(backup), 'application/json');
  await setSetting(db, 'last_backup_at', nowStamp());
}

export async function pickBackup(): Promise<BackupFile | null> {
  const picked = await pickFile(['application/json', 'text/plain', '*/*']);
  return picked ? parseBackup(await readPickedText(picked)) : null;
}

export async function applyBackup(db: Db, backup: BackupFile): Promise<void> {
  await restoreTables(db, backup);
  if (backup.attachments) await writeAttachmentsBase64(backup.attachments);
}
