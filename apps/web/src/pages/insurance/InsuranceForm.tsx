import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Paperclip, Save, X } from 'lucide-react';
import { insuranceStatus } from '../../core/domain/calc';
import { today } from '../../core/domain/dates';
import { getInsurance, saveInsurance } from '../../core/repo/insurance';
import { getReminderDays } from '../../core/repo/settings';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction, useForm } from '../../app/hooks';
import { openAttachment, pickFile, storeAttachment } from '../../platform/files';
import { Btn, InsuranceBadge, Note } from '../../ui/bits';
import { DateField, Field, FormSection, TextArea } from '../../ui/fields';
import { Page } from '../../ui/Page';
import { DaysBar, daysText, statusText } from './days';

export default function InsuranceForm() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { toast, showError } = useDialog();
  const { busy, run } = useAction();
  const { id } = useParams();
  const { values: f, set, setValues } = useForm({
    vehicle: '', category: '', policyNo: '', start: '', expiry: '', notes: '', attachment: null as string | null,
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const { data: reminderDays } = useData(getReminderDays);

  useEffect(() => {
    if (!id) return;
    getInsurance(db, id).then((i) => {
      if (!i) return;
      setValues({
        vehicle: i.vehicle, category: i.category ?? '', policyNo: i.policy_no ?? '', start: i.start_date ?? '', expiry: i.expiry_date,
        notes: i.notes ?? '', attachment: i.attachment_uri,
      });
      setFileName(i.attachment_uri);
      setLoaded(true);
    });
  }, [db, id, setValues]);

  const attach = async () => {
    try {
      const picked = await pickFile('image/*,application/pdf');
      if (!picked) return;
      set('attachment')(await storeAttachment(picked));
      setFileName(picked.name);
    } catch (error) {
      showError(error);
    }
  };
  const view = () => f.attachment && openAttachment(f.attachment).catch(showError);

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      // The insurance company is no longer asked for (client request); leaving it out keeps any old value.
      const saved = await saveInsurance(db, {
        vehicle: f.vehicle, category: f.category, policyNo: f.policyNo, startDate: f.start || null, expiryDate: f.expiry, notes: f.notes, attachmentUri: f.attachment,
      }, id);
      toast.success(t('web.saved'));
      navigate(`/insurance/${saved}`, { replace: true });
    });
  };

  const status = f.expiry && reminderDays !== undefined ? insuranceStatus(f.expiry, today(), reminderDays) : null;

  return (
    <Page title={id ? t('web.insurance.editPolicy') : t('web.insurance.newPolicy')} subtitle={t('modules.insurance')}>
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5">
          {id && <Note>{t('insurance.renewHint')}</Note>}
          <FormSection title={t('web.insurance.policySection')}>
            <Field required caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} autoFocus={!id} />
            <Field label={t('fields.insuranceType')} value={f.category} onChange={set('category')} />
            <Field label={t('fields.policyNo')} value={f.policyNo} onChange={set('policyNo')} />
          </FormSection>

          <FormSection title={t('web.insurance.datesSection')}>
            <DateField label={t('fields.startDate')} value={f.start} onChange={set('start')} />
            <DateField required label={t('fields.expiry')} value={f.expiry} onChange={set('expiry')} />
            <TextArea label={t('fields.notes')} value={f.notes} onChange={set('notes')} className="sm:col-span-2" />
          </FormSection>

          <FormSection title={t('web.insurance.attachmentSection')} note={t('web.insurance.fileHint')} columns={1}>
            {f.attachment ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
                <Paperclip size={16} className="text-content-subtle shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[14px] text-content" dir="ltr">{fileName ?? t('web.insurance.attached')}</span>
                <Btn tone="quiet" icon={<Eye size={16} />} onClick={view}>{t('web.insurance.view')}</Btn>
                <Btn tone="quiet" icon={<X size={16} />} onClick={() => { set('attachment')(null); setFileName(null); }}>{t('actions.remove')}</Btn>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Btn icon={<Paperclip size={16} />} onClick={attach}>{t('actions.chooseFile')}</Btn>
                <span className="text-[13px] text-content-subtle">{t('web.insurance.noFile')}</span>
              </div>
            )}
          </FormSection>
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-4">
          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between gap-3 card-head -mx-6 -mt-5 mb-4 px-6 py-4">
              <h2 className="card-title font-display text-[16px] text-content">{t('web.insurance.summaryTitle')}</h2>
              <span className="text-[13px] text-content-subtle">{t('web.insurance.summaryNote')}</span>
            </div>
            {f.vehicle.trim() && <p dir="ltr" className="font-mono text-[20px] font-semibold text-content mb-3 text-start">{f.vehicle.trim()}</p>}
            {status ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <InsuranceBadge status={status} />
                  <span className={`text-[14px] font-medium ${statusText(status)}`}>{daysText(f.expiry, t, true)}</span>
                </div>
                <DaysBar expiry={f.expiry} status={status} />
              </div>
            ) : <p className="text-[13px] text-content-subtle">{t('web.insurance.pickDates')}</p>}
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
