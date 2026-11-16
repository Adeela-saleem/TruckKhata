import { rules } from '../domain/rules';
import type { Db } from '../db/core';

export type SettingKey =
  | 'lang' | 'company_name' | 'company_phone' | 'company_address' | 'company_logo'
  | 'profile_name' | 'profile_phone' | 'reminder_days' | 'last_backup_at' | 'rtl_applied';

export async function getSetting(db: Db, key: SettingKey): Promise<string | null> {
  return (await db.get<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]))?.value ?? null;
}

export async function setSetting(db: Db, key: SettingKey, value: string | null): Promise<void> {
  await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function getReminderDays(db: Db): Promise<number> {
  const value = Number(await getSetting(db, 'reminder_days'));
  return Number.isInteger(value) && value > 0 ? value : rules.defaultReminderDays;
}

export async function getCompany(db: Db) {
  const [name, phone, address, logo] = await Promise.all([
    getSetting(db, 'company_name'), getSetting(db, 'company_phone'), getSetting(db, 'company_address'), getSetting(db, 'company_logo'),
  ]);
  return { name, phone, address, logo };
}
export type Company = Awaited<ReturnType<typeof getCompany>>;
