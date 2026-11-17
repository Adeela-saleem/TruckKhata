import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, KeyRound, LogOut, Save } from 'lucide-react';
import { AppError } from '../core/db/core';
import { formatDate } from '../core/domain/dates';
import { getCompany, getSetting } from '../core/repo/settings';
import { useAuth } from '../app/auth';
import { useApp, useData } from '../app/context';
import { useDialog } from '../app/dialog';
import { changePassword } from '../platform/auth';
import { Btn, SectionCard } from '../ui/bits';
import { Field } from '../ui/fields';
import { Page } from '../ui/Page';

async function loadOverview(db: Parameters<typeof getCompany>[0]) {
  const count = async (sql: string) => (await db.get<{ n: number }>(sql))?.n ?? 0;
  const [company, lastBackup, ada, cases, parties, bills, insurance] = await Promise.all([
    getCompany(db), getSetting(db, 'last_backup_at'),
    count('SELECT COUNT(*) AS n FROM ada_entries WHERE deleted_at IS NULL'),
    count('SELECT COUNT(*) AS n FROM cases c WHERE EXISTS (SELECT 1 FROM trip_legs l WHERE l.case_id = c.id AND l.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM ada_entries a WHERE a.case_id = c.id AND a.deleted_at IS NULL)'),
    count('SELECT COUNT(*) AS n FROM parties WHERE deleted_at IS NULL'),
    count('SELECT COUNT(*) AS n FROM bills WHERE deleted_at IS NULL'),
    count('SELECT COUNT(*) AS n FROM insurance WHERE deleted_at IS NULL'),
  ]);
  return { company, lastBackup, counts: { ada, cases, parties, bills, insurance } };
}

export default function ProfilePage() {
  const { t } = useApp();
  const { user, update, signOut } = useAuth();
  const { toast, showError } = useDialog();
  const navigate = useNavigate();
  const { data } = useData(loadOverview);
  const [f, setF] = useState({ name: '', email: '', phone: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) setF({ name: user.name, email: user.email, phone: user.phone ?? '' }); }, [user]);
  if (!user) return null;

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await update(f); toast.success(t('web.saved')); } catch (err) { showError(err); } finally { setBusy(false); }
  };
  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (pw.next !== pw.confirm) throw new AppError('web.auth.errors.mismatch');
      await changePassword(user.id, pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success(t('web.auth.profile.changed'));
    } catch (err) { showError(err); } finally { setBusy(false); }
  };
  const counts = data?.counts;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const rows = counts ? ([
    ['modules.ada', counts.ada], ['modules.trips', counts.cases], ['modules.parties', counts.parties], ['modules.bills', counts.bills], ['modules.insurance', counts.insurance],
  ] as const) : [];
  const top = Math.max(1, ...rows.map(([, n]) => n));

  return (
    <Page title={t('web.auth.profile.title')} subtitle={t('web.auth.profile.sub')}>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* The person, as the page's one bright moment. */}
          <section className="noir-hero relative overflow-hidden rounded-[20px] p-7 sm:p-8 text-white flex flex-wrap items-center gap-6">
            <span className="rounded-full bg-white/20 ring-4 ring-white/15 grid place-items-center font-display text-[32px] w-[92px] h-[92px] shrink-0">
              {user.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[28px] leading-tight tracking-[-0.02em] truncate">{user.name}</p>
              <p className="mt-1 text-[14px] text-white/80" dir="ltr">{user.email}{user.phone && ` · ${user.phone}`}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                <span className="h-8 px-3.5 rounded-full bg-white/20 grid place-items-center font-medium">{t('web.auth.profile.owner')}</span>
                <span className="h-8 px-3.5 rounded-full bg-white/10 grid place-items-center">{t('web.auth.profile.memberSince', { date: formatDate(user.createdAt) })}</span>
              </div>
            </div>
          </section>

          <form onSubmit={saveDetails}>
            <SectionCard title={t('web.auth.profile.details')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <Field label={t('web.auth.name')} value={f.name} onChange={(name) => setF({ ...f, name })} required />
                <Field label={t('web.auth.email')} type="email" value={f.email} onChange={(email) => setF({ ...f, email })} required />
                <Field label={t('web.auth.phone')} type="tel" value={f.phone} onChange={(phone) => setF({ ...f, phone })} />
                <div className="flex items-end justify-end"><Btn tone="primary" type="submit" icon={<Save size={16} />} busy={busy}>{t('actions.save')}</Btn></div>
              </div>
            </SectionCard>
          </form>

          <form onSubmit={savePassword}>
            <SectionCard title={t('web.auth.profile.security')}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
                <Field label={t('web.auth.profile.current')} type="password" value={pw.current} onChange={(current) => setPw({ ...pw, current })} />
                <Field label={t('web.auth.profile.next')} type="password" value={pw.next} onChange={(next) => setPw({ ...pw, next })} hint={t('web.auth.passwordHint')} />
                <Field label={t('web.auth.confirm')} type="password" value={pw.confirm} onChange={(confirm) => setPw({ ...pw, confirm })} />
              </div>
              <div className="mt-5 flex justify-end">
                <Btn type="submit" icon={<KeyRound size={16} />} disabled={busy || !pw.current || !pw.next}>{t('web.auth.profile.change')}</Btn>
              </div>
            </SectionCard>
          </form>
        </div>

        <aside className="xl:col-span-4 flex flex-col gap-5">
          <SectionCard title={t('web.auth.profile.company')}>
            <div className="flex items-center gap-4">
              {data?.company.logo
                ? <img src={data.company.logo} alt="" className="w-14 h-14 rounded-xl object-contain bg-surface-2 p-1.5" />
                : <span className="w-14 h-14 rounded-xl bg-surface-2 grid place-items-center text-content-subtle"><Building2 size={22} /></span>}
              <div className="min-w-0">
                <p className="text-[16px] font-medium text-content truncate">{data?.company.name || t('app.name')}</p>
                <p className="text-[13px] text-content-subtle truncate">{[data?.company.phone, data?.company.address].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <Link to="/settings" className="mt-4 inline-flex text-[14px] font-medium text-brand-strong hover:underline underline-offset-4">{t('web.auth.profile.companyEdit')}</Link>
          </SectionCard>

          <SectionCard title={t('web.auth.profile.activity')} note={`${total} ${t('web.auth.profile.records')}`}>
            <ul className="flex flex-col gap-3.5">
              {rows.map(([key, n]) => (
                <li key={key}>
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span className="text-content-muted">{t(key)}</span>
                    <span className="font-medium tabular-nums text-content">{n}</span>
                  </div>
                  <span className="mt-1.5 block h-2 rounded-full bg-surface-2 overflow-hidden">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max((n / top) * 100, n ? 4 : 0)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 pt-4 border-t border-line flex items-baseline justify-between text-[14px]">
              <span className="text-content-muted">{t('web.auth.profile.lastBackup')}</span>
              <Link to="/settings?tab=backup" className="font-medium text-content hover:text-brand-strong tabular-nums">
                {data?.lastBackup ? formatDate(data.lastBackup) : t('backup.never')}
              </Link>
            </div>
          </SectionCard>

          <section className="card px-6 sm:px-7 py-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-content-subtle max-w-[240px]">{t('web.auth.profile.signOutHint')}</p>
            <Btn tone="danger" icon={<LogOut size={16} className="rtl:rotate-180" />} onClick={() => { signOut(); navigate('/login'); }}>{t('web.auth.signOut')}</Btn>
          </section>
        </aside>
      </div>
    </Page>
  );
}
