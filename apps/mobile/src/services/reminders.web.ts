import type { Db } from '../db/core';
import type { Translate } from '../i18n';

/** Browsers have no scheduled notifications; the dashboard banner still warns. */
export function configureNotifications() {}

export async function syncReminders(_db: Db, _t: Translate, _askPermission = false): Promise<void> {}
