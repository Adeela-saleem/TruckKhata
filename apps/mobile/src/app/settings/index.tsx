import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppError } from '../../db/core';
import { getReminderDays, setSetting } from '../../repo/settings';
import { syncReminders } from '../../services/reminders';
import { useApp } from '../../ui/context';
import { Button, Card, Chips, DirectionIcon, Field, SectionTitle, type IconName } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { T } from '../../ui/text';
import { colors, space, touch } from '../../ui/theme';
import type { Lang } from '../../i18n';

const links: { key: string; icon: IconName; href: Href }[] = [
  { key: 'company', icon: 'domain', href: '/settings/company' },
  { key: 'profile', icon: 'account-outline', href: '/settings/profile' },
  { key: 'backup', icon: 'cloud-upload-outline', href: '/settings/backup' },
  { key: 'bin', icon: 'delete-restore', href: '/settings/bin' },
];

export default function Settings() {
  const { db, t, lang, setLang } = useApp();
  const { toast } = useDialog();
  const { run } = useAction();
  const [days, setDays] = useState('');

  useEffect(() => { getReminderDays(db).then((n) => setDays(String(n))); }, [db]);

  const saveDays = () => run(async () => {
    const value = Number(days);
    if (!Number.isInteger(value) || value <= 0) throw new AppError('errors.invalidReminder');
    await setSetting(db, 'reminder_days', String(value));
    await syncReminders(db, t);
    toast(t('settings.saved'));
  });

  return (
    <Screen title={t('modules.settings')}>
      <Chips<Lang> label={t('settings.language')} value={lang} onChange={(next) => next !== lang && run(() => setLang(next))}
        options={[{ value: 'en', label: t('settings.english') }, { value: 'ur', label: t('settings.urdu') }]} />
      {links.map((l) => (
        <Pressable key={l.key} accessibilityRole="button" onPress={() => router.push(l.href)} style={styles.link}>
          <MaterialCommunityIcons name={l.icon} size={26} color={colors.brand} />
          <T variant="bodyStrong" style={{ flex: 1 }}>{t(`settings.${l.key}`)}</T>
          <DirectionIcon direction="forward" color={colors.muted} />
        </Pressable>
      ))}
      <SectionTitle title={t('settings.reminders')} />
      <Card>
        <Field label={t('fields.reminderDays')} value={days} onChange={setDays} keyboard="number-pad" />
        <Button tone="quiet" label={t('actions.save')} onPress={saveDays} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md },
});
