import { useEffect } from 'react';
import { getSetting, setSetting } from '../../repo/settings';
import { useApp } from '../../ui/context';
import { Button, Field, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';

export default function Profile() {
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ name: '', phone: '' });

  useEffect(() => {
    Promise.all([getSetting(db, 'profile_name'), getSetting(db, 'profile_phone')]).then(([name, phone]) => setValues({ name: name ?? '', phone: phone ?? '' }));
  }, [db, setValues]);

  const save = () => run(async () => {
    await setSetting(db, 'profile_name', f.name.trim() || null);
    await setSetting(db, 'profile_phone', f.phone.trim() || null);
    toast(t('settings.saved'));
    goBack();
  });

  return (
    <Screen title={t('settings.profile')} footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <Field label={t('fields.name')} value={f.name} onChange={set('name')} />
      <Field label={t('fields.phone')} value={f.phone} onChange={set('phone')} keyboard="phone-pad" />
    </Screen>
  );
}
