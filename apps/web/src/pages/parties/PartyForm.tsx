import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { AppError } from '../../core/db/core';
import { nameKey } from '../../core/domain/keys';
import { getParty, saveParty } from '../../core/repo/parties';
import { useApp } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction, useForm } from '../../app/hooks';
import { Btn, Note } from '../../ui/bits';
import { Field, FormSection, TextArea } from '../../ui/fields';
import { Page } from '../../ui/Page';

export default function PartyForm() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { id } = useParams();
  const { values: f, set, setValues } = useForm({ name: '', phone: '', address: '' });
  const [loaded, setLoaded] = useState(!id);
  // The party that already has this name, shown under the form when saving is refused.
  const [clash, setClash] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    getParty(db, id).then((p) => {
      if (p) setValues({ name: p.name, phone: p.phone ?? '', address: p.address ?? '' });
      setLoaded(true);
    });
  }, [db, id, setValues]);

  useEffect(() => { setClash(null); }, [f.name]);

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      try {
        const saved = await saveParty(db, f, id);
        toast.success(t('web.saved'));
        navigate(`/parties/${saved}`, { replace: true });
      } catch (error) {
        if (error instanceof AppError && error.key === 'errors.partyExists') {
          const same = await db.get<{ id: string; name: string }>('SELECT id, name FROM parties WHERE name_key = ? AND deleted_at IS NULL', [nameKey(f.name)]);
          setClash(same);
        }
        throw error;
      }
    });
  };

  return (
    <Page title={id ? t('web.parties.editParty') : t('web.parties.newParty')} subtitle={t('modules.parties')}>
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5">
          <FormSection title={t('web.parties.details')}>
            <Field required label={t('fields.partyName')} value={f.name} onChange={set('name')} autoFocus={!id} className="sm:col-span-2" />
            <Field label={t('fields.phone')} value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" />
            <div className="hidden sm:block" />
            <TextArea label={t('fields.address')} value={f.address} onChange={set('address')} className="sm:col-span-2" />
          </FormSection>
          {clash && clash.id !== id && (
            <Note tone="warn">
              {t('errors.partyExists')}{' '}
              <Link to={`/parties/${clash.id}`} className="font-medium underline underline-offset-4">{t('web.parties.openExisting', { name: clash.name })}</Link>
            </Note>
          )}
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-4">
          <section className="card px-6 py-5">
            <h2 className="card-title font-display text-[16px] text-content card-head -mx-6 -mt-5 mb-4 px-6 py-4">{t('modules.parties')}</h2>
            <p className="text-[13px] text-content-muted leading-relaxed">{t('web.parties.formNote')}</p>
          </section>
          <div className="flex gap-2 justify-end">
            <Btn onClick={() => navigate(-1)}>{t('actions.cancel')}</Btn>
            <Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy} disabled={!loaded}>{t('actions.save')}</Btn>
          </div>
        </aside>
      </form>
    </Page>
  );
}
