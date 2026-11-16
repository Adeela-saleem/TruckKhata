import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, formatDate, parseISODate, today } from '../domain/dates';
import type { Db } from '../db/core';
import type { Translate } from '../i18n';
import { listInsurance } from '../repo/insurance';
import { getReminderDays } from '../repo/settings';

const channelId = 'insurance';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/**
 * Rebuilds all insurance reminders from the saved records. The dashboard shows
 * the same warnings, so a refused permission only loses the phone notification.
 */
export async function syncReminders(db: Db, t: Translate, askPermission = false): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      // The rule cannot follow the package's re-export of this enum.
      // eslint-disable-next-line import/namespace
      await Notifications.setNotificationChannelAsync(channelId, { name: t('settings.reminders'), importance: Notifications.AndroidImportance.DEFAULT });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (askPermission && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    const days = await getReminderDays(db);
    const now = today();
    const atNine = (day: string) => {
      const date = parseISODate(day);
      date.setHours(9, 0, 0, 0);
      return date;
    };
    for (const policy of await listInsurance(db)) {
      const schedule = async (day: string, body: string) => {
        if (day < now || atNine(day).getTime() <= Date.now()) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: t('insurance.remindTitle'), body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: atNine(day), channelId },
        });
      };
      await schedule(addDays(policy.expiry_date, -days), t('insurance.remindSoon', { vehicle: policy.vehicle, date: formatDate(policy.expiry_date) }));
      await schedule(policy.expiry_date, t('insurance.remindToday', { vehicle: policy.vehicle }));
    }
  } catch (error) {
    console.warn('Could not schedule insurance reminders', error);
  }
}
