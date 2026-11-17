import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ImagePlus, Save, Upload, X } from 'lucide-react';
import { AppError, nowStamp } from '../../core/db/core';
import { formatDate, today } from '../../core/domain/dates';
import type { Lang } from '../../core/i18n';
import { exportTables, parseBackup, restoreTables } from '../../core/repo/backup';
import { getCompany, getReminderDays, getSetting, setSetting } from '../../core/repo/settings';
import { downloadText, pickFile, pickLogoDataUri, readAttachmentsBase64, writeAttachmentsBase64 } from '../../platform/files';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction, useForm } from '../../app/hooks';
import { Segmented } from '../../components/shared/Segmented';
import { Btn, Facts, Note, SectionCard } from '../../ui/bits';
import { Choice, Field, FormSection, TextArea } from '../../ui/fields';
import { SampleCard } from '../../ui/sample';
import { Page } from '../../ui/Page';
import { PrintPreview } from './PrintPreview';

const tabs = ['company', 'preferences', 'backup'] as const;
type Tab = (typeof tabs)[number];
const BACKUP_DAYS = 7;

export default function SettingsPage() {
  const { t } = useApp();
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked && tabs.includes(asked) ? asked : 'company';
  return (
    <Page title={t('modules.settings')} subtitle={t(`web.settings.tabs.${tab}`)}
      bar={<div className="max-w-full overflow-x-auto scroll-thin [&>div]:flex-nowrap [&_button]:whitespace-nowrap">
        <Segmented ariaLabel={t('modules.settings')} value={tab} onChange={(next) => setParams({ tab: next }, { replace: true })}
          options={tabs.map((value) => ({ value, label: t(`web.settings.tabs.${value}`) }))} />
      </div>}>
      {tab === 'company' && <CompanyTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'backup' && <div className="flex flex-col gap-5"><BackupTab /><div className="max-w-[860px]"><SampleCard /></div></div>}
    </Page>
  );
}

function CompanyTab() {
  const { db, t } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const [loaded, setLoaded] = useState(false);
  const { values: f, set, setValues } = useForm({ name: '', phone: '', address: '', logo: null as string | null });

  useEffect(() => {
    let live = true;
    getCompany(db).then((c) => {
      if (!live) return;
      setValues({ name: c.name ?? '', phone: c.phone ?? '', address: c.address ?? '', logo: c.logo });
      setLoaded(true);
    });
    return () => { live = false; };
  }, [db, setValues]);

  const pick = () => run(async () => {
    const logo = await pickLogoDataUri();
    if (logo) set('logo')(logo);
  });

  const save = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await setSetting(db, 'company_name', f.name.trim() || null);
      await setSetting(db, 'company_phone', f.phone.trim() || null);
      await setSetting(db, 'company_address', f.address.trim() || null);
      await setSetting(db, 'company_logo', f.logo);
      toast.success(t('settings.saved'));
    });
  };

  return (
    <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
      <div className="xl:col-span-7 flex flex-col gap-5">
        <FormSection title={t('web.settings.details')} note={t('settings.companyHint')}>
          <Field label={t('settings.companyName')} value={f.name} onChange={set('name')} className="sm:col-span-2" />
          <Field label={t('fields.phone')} value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" />
          <div className="hidden sm:block" />
          <TextArea label={t('fields.address')} value={f.address} onChange={set('address')} className="sm:col-span-2" />
        </FormSection>
        <FormSection title={t('settings.logo')} note={t('settings.logoHint')} columns={1}>
          <div className="flex flex-wrap items-center gap-5">
            <div className="grid place-items-center w-28 h-28 rounded-xl border border-line bg-surface-2 overflow-hidden shrink-0">
              {f.logo
                ? <img src={f.logo} alt={t('settings.logo')} className="max-w-full max-h-full object-contain p-2" />
                : <ImagePlus size={24} className="text-content-subtle" />}
            </div>
            <div className="flex flex-col gap-3 min-w-0 flex-1">
              <p className="text-[13px] text-content-muted">{f.logo ? t('web.settings.logoSize') : t('web.settings.logoNone')}</p>
              <div className="flex flex-wrap gap-2">
                <Btn icon={<ImagePlus size={16} />} onClick={pick} disabled={busy}>{f.logo ? t('web.settings.changeLogo') : t('actions.chooseLogo')}</Btn>
                {f.logo && <Btn tone="quiet" icon={<X size={16} />} onClick={() => set('logo')(null)}>{t('actions.removeFile')}</Btn>}
              </div>
            </div>
          </div>
        </FormSection>
      </div>
      <aside className="xl:col-span-5 xl:sticky xl:top-5 flex flex-col gap-4">
        <SectionCard title={t('web.settings.preview')} note={t('web.settings.previewNote')}>
          <PrintPreview name={f.name} phone={f.phone} address={f.address} logo={f.logo} />
        </SectionCard>
        <div className="flex justify-end">
          <Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy} disabled={!loaded}>{t('actions.save')}</Btn>
        </div>
      </aside>
    </form>
  );
}


function PreferencesTab() {
  const { db, t, lang, setLang } = useApp();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const [days, setDays] = useState('');

  useEffect(() => {
    let live = true;
    getReminderDays(db).then((n) => { if (live) setDays(String(n)); });
    return () => { live = false; };
  }, [db]);

  const saveDays = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const text = days.trim();
      const value = Number(text);
      if (!/^\d+$/.test(text) || !Number.isInteger(value) || value <= 0) throw new AppError('errors.invalidReminder');
      await setSetting(db, 'reminder_days', String(value));
      toast.success(t('settings.saved'));
    });
  };

  return (
    <div className="max-w-[760px] flex flex-col gap-5">
      <SectionCard title={t('settings.language')} note={t('web.settings.languageHint')}>
        <Choice<Lang> label={t('settings.language')} value={lang} onChange={(next) => { if (next !== lang) void run(() => setLang(next)); }}
          options={[{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو' }]} />
      </SectionCard>
      <form onSubmit={saveDays}>
        <SectionCard title={t('settings.reminders')}>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('fields.reminderDays')} value={days} onChange={setDays} inputMode="numeric" className="w-full sm:w-80" />
            <Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy} disabled={!days} className="h-11">{t('actions.save')}</Btn>
          </div>
          <p className="mt-2 text-[12px] text-content-subtle">{t('web.settings.reminderHint')}</p>
        </SectionCard>
      </form>
    </div>
  );
}

function BackupTab() {
  const { db, t, lang, setLang } = useApp();
  const { confirm, toast } = useDialog();
  const { busy, run } = useAction();
  const { data: last } = useData((d) => getSetting(d, 'last_backup_at'));
  const stale = last !== undefined && (!last || Date.now() - new Date(last).getTime() > BACKUP_DAYS * 86400000);

  const create = () => run(async () => {
    const backup = await exportTables(db);
    const names = (backup.tables.insurance ?? []).map((r) => r.attachment_uri).filter((n): n is string => typeof n === 'string' && n !== '');
    backup.attachments = await readAttachmentsBase64(names);
    downloadText(`truck-khata-backup-${today()}.json`, JSON.stringify(backup), 'application/json');
    await setSetting(db, 'last_backup_at', nowStamp());
    toast.success(t('backup.done'));
  });

  const restoreFrom = () => run(async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    const backup = parseBackup(await file.text());
    const ok = await confirm(t('web.settings.restoreTitle'), t('web.settings.restoreMessage', { date: formatDate(backup.createdAt) }), t('backup.restore'), 'danger');
    if (!ok) return;
    await restoreTables(db, backup);
    if (backup.attachments) await writeAttachmentsBase64(backup.attachments);
    // The backup may have been saved in the other language.
    const saved = await getSetting(db, 'lang');
    if ((saved === 'en' || saved === 'ur') && saved !== lang) await setLang(saved);
    toast.success(t('backup.restored'));
  });

  return (
    <div className="max-w-[860px] flex flex-col gap-5">
        <SectionCard title={t('backup.title')}>
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-content">{t('web.settings.browserOnly')}</p>
            <p className="text-[14px] leading-relaxed text-content-muted">{t('web.settings.backupAdvice')}</p>
            {stale && <Note tone="warn">{last ? t('web.settings.stale') : t('backup.never')}</Note>}
          </div>
        </SectionCard>
        <SectionCard title={t('backup.create')} note={t('web.settings.backupFile')}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Facts columns={2} items={[{ label: t('backup.last'), value: last === undefined ? '…' : last ? <span className="tabular-nums">{formatDate(last)}</span> : t('web.settings.never') }]} />
            <Btn tone="primary" icon={<Download size={16} />} onClick={create} busy={busy}>{t('backup.create')}</Btn>
          </div>
        </SectionCard>
        <SectionCard title={t('backup.restore')}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[14px] text-content-muted">{t('web.settings.restoreHint')}</p>
            <Btn tone="danger" icon={<Upload size={16} />} onClick={restoreFrom} disabled={busy}>{t('backup.restore')}</Btn>
          </div>
        </SectionCard>
        <Note>
          <Link to="/bin" className="font-medium text-content underline underline-offset-4">{t('settings.bin')}</Link>
          <span className="block mt-1">{t('bin.emptyHint')}</span>
        </Note>
    </div>
  );
}
