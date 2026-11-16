import { reloadAppAsync } from 'expo';
import { I18nManager, Platform } from 'react-native';
import { formatDate } from '../../domain/dates';
import { getSetting } from '../../repo/settings';
import { applyBackup, createBackup, pickBackup } from '../../services/backup';
import { useApp, useData } from '../../ui/context';
import { Button, Card, Line } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export default function BackupScreen() {
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const { data: last, reload } = useData((d) => getSetting(d, 'last_backup_at'));

  const create = () => run(async () => {
    await createBackup(db);
    toast(t('backup.done'));
    await reload();
  });

  const restore = () => run(async () => {
    const backup = await pickBackup();
    if (!backup) return;
    const ok = await confirm(t('backup.restoreTitle'), t('backup.restoreMessage', { date: formatDate(backup.createdAt) }), t('backup.restore'), 'danger');
    if (!ok) return;
    await applyBackup(db, backup);
    toast(t('backup.restored'));
    // The backup may hold a different language, company and reminder set.
    const lang = await getSetting(db, 'lang');
    if (Platform.OS === 'web') {
      window.location.assign('/');
      return;
    }
    I18nManager.forceRTL(lang === 'ur');
    await reloadAppAsync();
  });

  return (
    <Screen title={t('settings.backup')}>
      <T variant="heading">{t('backup.title')}</T>
      <T color={colors.muted}>{t('backup.hint')}</T>
      <Card><Line label={t('backup.last')} value={last ? formatDate(last) : t('backup.never')} strong /></Card>
      <Button icon="cloud-upload-outline" label={t('backup.create')} onPress={create} disabled={busy} />
      <Button tone="plain" icon="backup-restore" label={t('backup.restore')} onPress={restore} disabled={busy} />
    </Screen>
  );
}
