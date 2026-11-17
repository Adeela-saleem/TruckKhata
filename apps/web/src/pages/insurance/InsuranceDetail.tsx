import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Eye, Paperclip, Pencil } from 'lucide-react';
import { formatDate } from '../../core/domain/dates';
import type { Translate } from '../../core/i18n';
import { insuranceDocument } from '../../core/print/documents';
import { listCycles } from '../../core/repo/cases';
import { getInsurance, setInsuranceArchived, type InsuranceView } from '../../core/repo/insurance';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { useAction } from '../../app/hooks';
import { EmptyState } from '../../components/shared/states';
import { Badge } from '../../components/ui/Badge';
import { openAttachment } from '../../platform/files';
import { Btn, CaseChip, Facts, InsuranceBadge, Money, Note, SectionCard, StatusBadge } from '../../ui/bits';
import { Page } from '../../ui/Page';
import { DeleteButton, HistoryCard, PrintButton } from '../../ui/record';
import { RecordHeader } from '../../ui/RecordHeader';
import { DaysBar, daysLeft, daysText, statusText } from './days';

/** The printed record, with an old insurance company still shown when one was saved. */
function policyDocument(i: InsuranceView, t: Translate) {
  const doc = insuranceDocument(i, t);
  if (!i.company) return doc;
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.type === 'pairs' ? { ...s, pairs: [...s.pairs, [t('fields.insuranceCompany'), i.company] as [string, string]] } : s)),
  };
}

export default function InsuranceDetail() {
  const { id = '' } = useParams();
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { toast, showError } = useDialog();
  const { busy, run } = useAction();
  const { data } = useData(async (d) => {
    const policy = await getInsurance(d, id);
    return { policy, trips: policy ? await listCycles(d, { vehicle: policy.vehicle }) : [] };
  }, [id]);
  const i = data?.policy;

  if (data && (!i || (i as InsuranceView & { deleted_at?: string | null }).deleted_at)) {
    return <Page title={t('modules.insurance')}><div className="card"><EmptyState title={t('web.notFound')} /></div></Page>;
  }
  if (!i || !data) return <Page title={t('modules.insurance')}>{null}</Page>;
  const doc = () => policyDocument(i, t);
  const left = daysLeft(i.expiry_date);
  const archive = () => run(async () => {
    await setInsuranceArchived(db, id, !i.archived_at);
    toast.success(t('web.saved'));
  });

  return (
    <Page title={i.vehicle} subtitle={t('modules.insurance')}
      actions={<>
        <PrintButton build={doc} />
        <Btn icon={<Pencil size={16} />} onClick={() => navigate(`/insurance/${id}/edit`)}>{t('actions.edit')}</Btn>
      </>}>
      <div className="max-w-[1800px]">
        <RecordHeader
          badges={<>
            <InsuranceBadge status={i.status} />
            {i.archived_at && <Badge>{t('party.archived')}</Badge>}
          </>}
          meta={<span className={statusText(i.status)}>{daysText(i.expiry_date, t, true)}</span>} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
            {i.archived_at && <Note>{t('web.insurance.archivedNote')}</Note>}
            <SectionCard title={t('web.insurance.policySection')}>
              <Facts columns={3} items={[
                { label: t('fields.vehicle'), value: <span dir="ltr" className="font-mono">{i.vehicle}</span> },
                { label: t('fields.insuranceType'), value: i.category },
                { label: t('fields.policyNo'), value: i.policy_no && <span dir="ltr" className="font-mono">{i.policy_no}</span> },
                { label: t('fields.startDate'), value: i.start_date && <span className="tabular-nums">{formatDate(i.start_date)}</span> },
                { label: t('fields.expiry'), value: <span className="tabular-nums">{formatDate(i.expiry_date)}</span> },
                { label: t('fields.insuranceCompany'), value: i.company },
              ]} />
              {i.notes && (
                <div className="mt-5 pt-4 border-t border-line">
                  <p className="text-[13px] text-content-subtle">{t('fields.notes')}</p>
                  <p className="mt-1 text-[14px] text-content whitespace-pre-line">{i.notes}</p>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t('web.insurance.attachmentSection')}>
              {i.attachment_uri ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Paperclip size={16} className="text-content-subtle shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[14px] text-content">{t('web.insurance.attached')}</span>
                  <Btn icon={<Eye size={16} />} onClick={() => openAttachment(i.attachment_uri as string).catch(showError)}>{t('web.insurance.view')}</Btn>
                </div>
              ) : <p className="text-[14px] text-content-subtle">{t('web.insurance.noFile')}</p>}
            </SectionCard>

            <SectionCard title={t('insurance.relatedTrips')} note={String(data.trips.length)} padded={false}>
              {data.trips.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{t('web.insurance.noTrips')}</p>
                : (
                  <ul className="divide-y divide-line">
                    {data.trips.map((c) => (
                      <li key={c.caseId}>
                        <Link to={`/trips/${c.caseId}`} className="noir-row flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 min-h-[56px]">
                          <CaseChip caseNo={c.caseNo} />
                          <span className="w-24 tabular-nums text-[14px] text-content-muted">{formatDate(c.date)}</span>
                          <span className="flex-1 min-w-[120px] truncate text-[14px] text-content-muted">{c.route || '–'}</span>
                          <StatusBadge status={c.summary.status} />
                          <Money value={c.summary.profit} tone="auto" className="w-28 text-end text-[14px] font-medium" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
            </SectionCard>

            <HistoryCard recordIds={[id]} record={doc} />
            <div><DeleteButton table="insurance" id={id} after={() => navigate('/insurance', { replace: true })} /></div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-5">
            <SectionCard title={t('web.insurance.summaryTitle')}>
              <div className="flex items-center justify-between gap-3">
                <InsuranceBadge status={i.status} />
                <span className="text-[13px] text-content-subtle tabular-nums">{formatDate(i.expiry_date)}</span>
              </div>
              <p className={`mt-4 font-display text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${statusText(i.status) || 'text-content'}`}>
                {left > 0 ? left : left === 0 ? t('web.insurance.today') : -left}
              </p>
              <p className="mt-1.5 text-[13px] text-content-muted">{left > 0 ? t('web.insurance.daysLeft') : daysText(i.expiry_date, t, true)}</p>
              <div className="mt-4"><DaysBar expiry={i.expiry_date} status={i.status} /></div>
              <div className="mt-5"><Note>{t('insurance.renewHint')}</Note></div>
            </SectionCard>
            <Btn icon={i.archived_at ? <ArchiveRestore size={16} /> : <Archive size={16} />} disabled={busy} onClick={archive} className="self-start">
              {i.archived_at ? t('actions.unarchive') : t('actions.archive')}
            </Btn>
          </aside>
        </div>
      </div>
    </Page>
  );
}
