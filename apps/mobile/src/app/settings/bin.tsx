import { View } from 'react-native';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { listTrash, purge, restore, type TrashItem } from '../../repo/trash';
import { syncReminders } from '../../services/reminders';
import { useApp, useData } from '../../ui/context';
import { Badge, Button, Card, Empty } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction } from '../../ui/hooks';
import { ListScreen } from '../../ui/screen';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

export default function RecycleBin() {
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { run } = useAction();
  const { data, reload } = useData(listTrash);

  const bringBack = (item: TrashItem) => run(async () => {
    await restore(db, item.table, item.id);
    if (item.table === 'insurance') await syncReminders(db, t);
    toast(t('history.restored'));
    await reload();
  });
  const remove = (item: TrashItem) => run(async () => {
    if (!(await confirm(t('bin.foreverTitle'), t('bin.foreverMessage'), t('actions.deleteForever'), 'danger'))) return;
    await purge(db, item.table, item.id);
    await reload();
  });

  return (
    <ListScreen
      title={t('settings.bin')}
      data={data ?? []}
      keyExtractor={(item) => `${item.table}${item.id}`}
      renderItem={({ item }) => (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
            <T variant="heading" style={{ flexShrink: 1 }}>{item.title}</T>
            <Badge tone="info" label={t(`bin.types.${item.table}`)} />
          </View>
          {item.subtitle && <T variant="small" color={colors.muted}>{item.table === 'trip_legs' ? t(`direction.${item.subtitle}`) : item.subtitle}</T>}
          {item.amount !== null && <T variant="bodyStrong">{formatPKR(item.amount)}</T>}
          <T variant="small" color={colors.muted}>{t('history.deleted')}: {formatDate(item.deletedAt)}</T>
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            <Button tone="quiet" icon="restore" label={t('actions.restore')} onPress={() => bringBack(item)} />
            <Button tone="plain" icon="delete-forever-outline" label={t('actions.deleteForever')} onPress={() => remove(item)} />
          </View>
        </Card>
      )}
      empty={<Empty icon="delete-empty-outline" title={t('bin.empty')} hint={t('bin.emptyHint')} />}
    >
      {null}
    </ListScreen>
  );
}
