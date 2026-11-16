import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { getInsurance, saveInsurance } from '../../repo/insurance';
import { pickFile, storeAttachment } from '../../services/files';
import { syncReminders } from '../../services/reminders';
import { useApp } from '../../ui/context';
import { Banner, Button, DateField, Field, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';

export default function InsuranceForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({
    vehicle: '', category: '', policyNo: '', start: null as string | null, expiry: null as string | null, notes: '', attachment: null as string | null,
  });

  useEffect(() => {
    if (!id) return;
    getInsurance(db, id).then((i) => i && setValues({
      vehicle: i.vehicle, category: i.category ?? '', policyNo: i.policy_no ?? '', start: i.start_date, expiry: i.expiry_date, notes: i.notes ?? '', attachment: i.attachment_uri,
    }));
  }, [db, id, setValues]);

  const attach = () => run(async () => {
    const picked = await pickFile(['image/*', 'application/pdf']);
    if (picked) set('attachment')(await storeAttachment(picked));
  });

  const save = () => run(async () => {
    const saved = await saveInsurance(db, {
      vehicle: f.vehicle, category: f.category, policyNo: f.policyNo, startDate: f.start, expiryDate: f.expiry ?? '', notes: f.notes, attachmentUri: f.attachment,
    }, id);
    await syncReminders(db, t, true);
    toast(t('settings.saved'));
    if (id) goBack();
    else router.replace(`/insurance/${saved}`);
  });

  return (
    <Screen title={id ? t('actions.edit') : `${t('actions.add')}: ${t('add.insurance')}`} subtitle={t('modules.insurance')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      {id && <Banner tone="info" icon="information-outline" text={t('insurance.renewHint')} />}
      <Field required caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
      <DateField required label={t('fields.expiry')} value={f.expiry} onChange={set('expiry')} />
      <Field label={t('fields.insuranceType')} value={f.category} onChange={set('category')} />
      <Field label={t('fields.policyNo')} value={f.policyNo} onChange={set('policyNo')} />
      <DateField allowClear label={t('fields.startDate')} value={f.start} onChange={set('start')} />
      <Field multiline label={t('fields.notes')} value={f.notes} onChange={set('notes')} />
      {f.attachment
        ? <Button tone="plain" icon="paperclip-off" label={t('actions.removeFile')} onPress={() => set('attachment')(null)} />
        : <Button tone="plain" icon="paperclip" label={t('actions.chooseFile')} onPress={attach} />}
    </Screen>
  );
}
