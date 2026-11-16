import { router, useLocalSearchParams } from 'expo-router';
import { formatDate } from '../../domain/dates';
import { listCycles } from '../../repo/cases';
import { getInsurance, setInsuranceArchived } from '../../repo/insurance';
import { shareAttachment } from '../../services/files';
import { syncReminders } from '../../services/reminders';
import { useApp, useData } from '../../ui/context';
import { Button, Card, Empty, Line, SectionTitle, goBack } from '../../ui/controls';
import { insuranceDocument } from '../../print/documents';
import { useAction } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { DeleteButton, History, InsuranceBadge, StatusBadge } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export default function InsuranceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, t } = useApp();
  const { run } = useAction();
  const { data, reload } = useData(async (d) => {
    const policy = await getInsurance(d, id);
    return { policy, trips: policy ? await listCycles(d, { vehicle: policy.vehicle }) : [] };
  }, [id]);
  const i = data?.policy;
  if (!data) return <Screen title={t('modules.insurance')}>{null}</Screen>;
  if (!i) return <Screen title={t('modules.insurance')}><Empty title={t('errors.notFound')} /></Screen>;
  return (
    <Screen
      title={i.vehicle}
      subtitle={t('modules.insurance')}
      actions={[{ icon: 'pencil-outline', label: t('actions.edit'), onPress: () => router.push({ pathname: '/insurance/form', params: { id } }) }]}
    >
      <InsuranceBadge status={i.status} />
      <Card>
        <Line label={t('fields.expiry')} value={formatDate(i.expiry_date)} strong />
        {i.start_date && <Line label={t('fields.startDate')} value={formatDate(i.start_date)} />}
        {i.category && <Line label={t('fields.insuranceType')} value={i.category} />}
        {i.policy_no && <Line label={t('fields.policyNo')} value={i.policy_no} />}
        {i.notes && <T variant="small" color={colors.muted}>{i.notes}</T>}
      </Card>
      <Button icon="pencil-outline" label={t('actions.edit')} onPress={() => router.push({ pathname: '/insurance/form', params: { id } })} />
      {i.attachment_uri && <Button tone="plain" icon="paperclip" label={t('actions.viewFile')} onPress={() => run(() => shareAttachment(i.attachment_uri as string))} />}

      {data.trips.length > 0 && <SectionTitle title={t('insurance.relatedTrips')} />}
      {data.trips.map((c) => (
        <Card key={c.caseId} onPress={() => router.push(`/case/${c.caseId}`)}>
          <T variant="bodyStrong">{c.caseNo}</T>
          <T variant="small" color={colors.muted}>{c.route}</T>
          <StatusBadge status={c.summary.status} />
        </Card>
      ))}

      <Button
        tone="plain" icon="archive-outline" label={i.archived_at ? t('actions.unarchive') : t('actions.archive')}
        onPress={() => run(async () => { await setInsuranceArchived(db, id, !i.archived_at); await syncReminders(db, t); await reload(); })}
      />
      <DeleteButton table="insurance" id={id} after={async () => { await syncReminders(db, t); goBack(); }} />
      <History recordId={id} record={() => insuranceDocument(i, t)} />
    </Screen>
  );
}
