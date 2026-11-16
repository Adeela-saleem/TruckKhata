import { RotateCcw, Trash2 } from 'lucide-react';
import { formatDate } from '../../core/domain/dates';
import { listTrash, purge, restore, type TrashItem, type TrashTable } from '../../core/repo/trash';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction } from '../../app/hooks';
import { Badge } from '../../components/ui/Badge';
import { Btn, CaseChip, Money } from '../../ui/bits';
import { ListTable, type Column } from '../../ui/ListTable';
import { Page } from '../../ui/Page';

/** Records that belong to a case are titled by their Case #. */
const caseTitled = new Set<TrashTable>(['ada_entries', 'ada_receipts', 'trip_legs', 'expenses']);

export default function RecycleBin() {
  const { db, t } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const { data: rows, loading } = useData(listTrash);

  const bringBack = (item: TrashItem) => run(async () => {
    await restore(db, item.table, item.id);
    toast.success(t('history.restored'));
  });
  const remove = (item: TrashItem) => run(async () => {
    if (!(await confirm(t('bin.foreverTitle'), t('bin.foreverMessage'), t('actions.deleteForever'), 'danger'))) return;
    await purge(db, item.table, item.id);
    toast.success(t('web.settings.bin.purged'));
  });

  const columns: Column<TrashItem>[] = [
    { key: 'type', label: t('web.settings.bin.type'), render: (i) => <Badge tone={i.table === 'insurance' ? 'warning' : i.table === 'bills' ? 'violet' : 'info'}>{t(`bin.types.${i.table}`)}</Badge> },
    { key: 'title', label: t('web.settings.bin.record'), render: (i) => caseTitled.has(i.table)
      ? <CaseChip caseNo={i.title} />
      : <span dir={i.table === 'insurance' ? 'ltr' : undefined} className={i.table === 'insurance' ? 'font-mono text-[14px] font-semibold' : 'block max-w-[220px] truncate font-medium'}>{i.title}</span> },
    { key: 'detail', label: t('web.settings.bin.detail'), wide: true, render: (i) => (
      <span className="block max-w-[260px] truncate text-content-muted">
        {i.subtitle ? (i.table === 'trip_legs' ? t(`direction.${i.subtitle}`) : i.subtitle) : '–'}
      </span>
    ) },
    { key: 'amount', label: t('fields.amount'), align: 'end', wide: true, render: (i) => (i.amount === null ? <span className="text-content-subtle">–</span> : <Money value={i.amount} />) },
    { key: 'deleted', label: t('web.settings.bin.deletedOn'), wide: true, render: (i) => <span className="tabular-nums text-content-muted">{formatDate(i.deletedAt)}</span> },
    { key: 'actions', label: '', align: 'end', render: (i) => (
      <span className="inline-flex gap-1.5">
        <Btn tone="quiet" icon={<RotateCcw size={16} />} disabled={busy} onClick={() => bringBack(i)} className="h-9">{t('actions.restore')}</Btn>
        <Btn tone="danger" icon={<Trash2 size={16} />} disabled={busy} onClick={() => remove(i)} className="h-9" title={t('actions.deleteForever')}>
          <span className="hidden sm:inline">{t('actions.deleteForever')}</span>
        </Btn>
      </span>
    ) },
  ];

  return (
    <Page title={t('settings.bin')} subtitle={t('web.list.entries', { count: rows?.length ?? 0 })} fit>
      <div className="fit:h-full">
        <ListTable title={t('web.settings.bin.listTitle')} note={t('web.list.entries', { count: rows?.length ?? 0 })} columns={columns} rows={rows} loading={loading}
          rowKey={(i) => `${i.table}:${i.id}`} empty={{ title: t('bin.empty'), hint: t('bin.emptyHint') }} />
      </div>
    </Page>
  );
}
