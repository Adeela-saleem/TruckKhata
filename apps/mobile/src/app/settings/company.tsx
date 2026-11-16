import { useEffect } from 'react';
import { Image } from 'react-native';
import { getCompany, setSetting } from '../../repo/settings';
import { pickLogoDataUri } from '../../services/files';
import { useApp } from '../../ui/context';
import { Button, Field, goBack } from '../../ui/controls';
import { useDialog } from '../../ui/dialog';
import { useAction, useForm } from '../../ui/hooks';
import { Screen } from '../../ui/screen';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export default function CompanySettings() {
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { values: f, set, setValues } = useForm({ name: '', phone: '', address: '', logo: null as string | null });

  useEffect(() => {
    getCompany(db).then((c) => setValues({ name: c.name ?? '', phone: c.phone ?? '', address: c.address ?? '', logo: c.logo }));
  }, [db, setValues]);

  const pick = () => run(async () => {
    const logo = await pickLogoDataUri();
    if (logo) set('logo')(logo);
  });

  const save = () => run(async () => {
    await setSetting(db, 'company_name', f.name.trim() || null);
    await setSetting(db, 'company_phone', f.phone.trim() || null);
    await setSetting(db, 'company_address', f.address.trim() || null);
    await setSetting(db, 'company_logo', f.logo);
    toast(t('settings.saved'));
    goBack();
  });

  return (
    <Screen title={t('settings.company')} footer={<Button label={t('actions.save')} icon="content-save-outline" onPress={save} disabled={busy} />}>
      <T color={colors.muted}>{t('settings.companyHint')}</T>
      <Field label={t('settings.companyName')} value={f.name} onChange={set('name')} />
      <Field label={t('fields.phone')} value={f.phone} onChange={set('phone')} keyboard="phone-pad" />
      <Field multiline label={t('fields.address')} value={f.address} onChange={set('address')} />
      <T variant="label">{t('settings.logo')}</T>
      <T variant="small" color={colors.muted}>{t('settings.logoHint')}</T>
      {f.logo && <Image accessibilityIgnoresInvertColors source={{ uri: f.logo }} style={{ width: 120, height: 120, resizeMode: 'contain' }} />}
      <Button tone="plain" icon="image-outline" label={t('actions.chooseLogo')} onPress={pick} />
      {f.logo && <Button tone="plain" icon="close" label={t('actions.removeFile')} onPress={() => set('logo')(null)} />}
    </Screen>
  );
}
