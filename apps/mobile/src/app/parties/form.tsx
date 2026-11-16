import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { getParty, saveParty } from '../../repo/parties';
import { useApp } from '../../ui/context';
import { Button, Field, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';

export default function PartyForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ name: '', phone: '', address: '' });

  useEffect(() => {
    if (!id) return;
    getParty(db, id).then((p) => p && setValues({ name: p.name, phone: p.phone ?? '', address: p.address ?? '' }));
  }, [db, id, setValues]);

  const save = () => run(async () => {
    const saved = await saveParty(db, f, id);
    toast(t('settings.saved'));
    if (id) goBack();
    else router.replace(`/parties/${saved}`);
  });

  return (
    <Screen title={id ? t('actions.edit') : `${t('actions.add')}: ${t('add.party')}`} subtitle={t('modules.parties')}
      footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <Field required label={t('fields.partyName')} value={f.name} onChange={set('name')} />
      <Field label={t('fields.phone')} value={f.phone} onChange={set('phone')} keyboard="phone-pad" />
      <Field multiline label={t('fields.address')} value={f.address} onChange={set('address')} />
    </Screen>
  );
}
