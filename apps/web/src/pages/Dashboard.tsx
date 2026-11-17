import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, BookOpenText, Fuel, ShieldAlert, Users, Wallet } from 'lucide-react';
import { parseISODate, today } from '../core/domain/dates';
import { formatPKR } from '../core/domain/money';
import { useApp, useData } from '../app/context';
import { KpiStrip, useRolling } from '../components/shared/DataViz';
import { Segmented } from '../components/shared/Segmented';
import { Skeleton } from '../components/shared/Skeleton';
import { CaseChip, Note, StatusBadge } from '../ui/bits';
import { Page } from '../ui/Page';
import { SampleButton } from '../ui/sample';
import { loadDashboard, type DashboardData, type ExpenseGroup, type Period } from './dashboard/data';

/** Each expense type keeps one colour everywhere on the dashboard. */
const groupColor: Record<ExpenseGroup, string> = {
  diesel: 'var(--accent-ink)', oil: '#F2B705', toll: '#3B82F6', loading: '#14B8A6', peshgi: '#9BC70E', bills: '#F2994A', other: '#A3A8B6',
};
const statusColor = { complete: '#16A34A', ready: 'var(--accent-ink)', return_pending: '#F2B705', outward_pending: '#F2994A' } as const;

/** Lakh and crore, the way the company reads money. */
function short(paisa: number) {
  const rs = paisa / 100;
  const abs = Math.abs(rs);
  const sign = rs < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1)} Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)} L`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${Math.round(abs)}`;
}

function Panel({ title, note, action, children, className = '' }: { title: string; note?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col min-w-0 ${className}`}>
      <div className="card-head flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-6 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] text-content">{title}</h2>
          {note && <p className="text-[13px] text-content-subtle mt-0.5">{note}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 min-h-0 px-6 pt-5 pb-6">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-full min-h-[180px] grid place-items-center text-[14px] text-content-subtle text-center">{text}</div>;
}

function OpenAll({ to }: { to: string }) {
  const { t } = useApp();
  return <Link to={to} className="shrink-0 text-[13px] font-medium text-content-muted hover:text-brand-strong transition-colors">{t('web.dash.openAll')}</Link>;
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2 text-[13px] text-content-muted">
          <span className={i.line ? 'w-4 h-[3px] rounded-full' : 'w-2.5 h-2.5 rounded-full'} style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

function ChartTip({ active, payload, label, names }: { active?: boolean; payload?: { dataKey: string; value: number; color: string; payload?: { fill?: string } }[]; label?: string; names: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-4 py-3 shadow-[0_12px_32px_-12px_rgb(var(--shadow)/0.3)] text-[13px] min-w-[180px]">
      {label && <p className="font-medium text-content mb-1.5">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-2 text-content-muted"><span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />{names[p.dataKey] ?? p.dataKey}</span>
          <span dir="ltr" className="font-medium tabular-nums text-content">{formatPKR(Math.round(p.value * 100))}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('month');
  const { data } = useData((db) => loadDashboard(db, period), [period]);
  const locale = lang === 'ur' ? 'ur-PK' : 'en-GB';
  const monthName = (key: string) => parseISODate(`${key}-01`).toLocaleDateString(locale, { month: 'short' });
  const subtitle = parseISODate(today()).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page title={t('web.dash.title')} subtitle={subtitle}
      actions={<Segmented ariaLabel={t('web.dash.periodLabel')} value={period} onChange={setPeriod}
        options={(['month', 'quarter', 'year'] as const).map((value) => ({ value, label: t(`web.dash.period.${value}`) }))} />}>
      <div className="flex flex-col gap-5">
        {data?.empty && (
          <section className="card relative overflow-hidden px-7 sm:px-9 py-8 flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="font-display text-[24px] tracking-[-0.02em] text-content">{t('web.sample.welcomeTitle')}</h2>
              <p className="mt-2 text-[14px] text-content-muted leading-relaxed">{t('web.sample.welcomeText')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SampleButton />
              <Link to="/ada/new" className="noir-cta h-10 px-4 rounded-[10px] inline-flex items-center gap-2 text-[14px] font-medium">
                <BookOpenText size={16} />{t('web.sample.addFirst')}
              </Link>
            </div>
          </section>
        )}
        {data?.companyMissing && <Note><Link to="/settings" className="font-medium underline underline-offset-4">{t('web.dash.noCompany')}</Link></Note>}
        {data?.backupDue && !data.companyMissing && <Note tone="warn"><Link to="/settings?tab=backup" className="font-medium underline underline-offset-4">{t('web.dash.backupDue')}</Link></Note>}

        {data?.empty ? null : data ? (
          <KpiStrip columns={4} kpis={[
            { label: t('web.dash.freightPeriod'), icon: Wallet, tone: 'var(--accent-olive)', value: data.totals.freight / 100, display: formatPKR(data.totals.freight), note: t('web.dash.freightNote'), onClick: () => navigate('/trips') },
            { label: t('web.dash.expensesPeriod'), icon: Fuel, tone: 'var(--c-negative)', value: data.totals.expenses / 100, display: formatPKR(data.totals.expenses), note: t('web.dash.expensesNote'), onClick: () => navigate('/reports') },
            { label: t('web.dash.brokersOwe'), icon: Users, tone: '#D9A300', value: data.outstanding / 100, display: formatPKR(data.outstanding), note: t('web.dash.brokersOweNote', { count: data.owingCount }), onClick: () => navigate('/parties') },
            { label: t('web.dash.insurance'), icon: ShieldAlert, tone: data.alerts ? 'var(--accent-red)' : 'var(--accent-slate)', value: data.alerts, display: String(data.alerts), alarm: data.alerts > 0, note: data.alerts ? t('web.dash.insuranceNote') : t('web.dash.insuranceNone'), onClick: () => navigate('/insurance') },
          ]} />
        ) : <Skeleton className="h-[148px] w-full rounded-2xl" />}

        {!data?.empty && <>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <Trend data={data} monthName={monthName} className="xl:col-span-8" />
          <ProfitHero data={data} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
          <ExpenseMix data={data} className="xl:col-span-4" />
          <StatusRing data={data} className="xl:col-span-3" />
          <Trucks data={data} className="md:col-span-2 xl:col-span-5" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5">
          <Collections data={data} className="xl:col-span-5" />
          <ToFinish data={data} className="xl:col-span-4" />
          <Countdown data={data} className="md:col-span-2 xl:col-span-3" />
        </div>
        </>}
      </div>
    </Page>
  );
}

/** The one bright card: profit for the period, with the confirmed share and the margin. */
function ProfitHero({ data }: { data?: DashboardData }) {
  const { t } = useApp();
  const totals = data?.totals;
  const shown = useRolling(Math.round((totals?.profit ?? 0) / 100), 520);
  const margin = totals && totals.freight ? Math.round((totals.profit / totals.freight) * 100) : 0;
  const confirmedShare = totals && totals.profit > 0 ? Math.min(100, Math.max(0, Math.round((totals.confirmed / totals.profit) * 100))) : 0;
  return (
    <section className="noir-hero relative overflow-hidden rounded-[20px] p-7 flex flex-col text-white xl:col-span-4 min-h-[380px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] text-white/85">{t('web.dash.profitPeriod')}</p>
          <p className="text-[13px] text-white/65 mt-0.5 tabular-nums">{t('web.dash.tripsPeriod', { count: totals?.trips ?? 0 })}</p>
        </div>
        <Link to="/trips" className="nudge-parent noir-hero-btn shrink-0 w-10 h-10 rounded-[10px] grid place-content-center" aria-label={t('modules.trips')}>
          <ArrowRight size={18} className="nudge rtl:rotate-180" />
        </Link>
      </div>
      <span dir="ltr" className="hero-accent mt-6 font-display text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums self-start">
        {(shown < 0 ? '-' : '') + 'Rs ' + Math.abs(shown).toLocaleString('en-US')}
      </span>
      <span className="mt-3 self-start h-8 px-3.5 rounded-[6px] bg-white/[0.08] ring-1 ring-white/10 grid place-items-center text-[13px] font-medium tabular-nums">
        {t('web.dash.margin')} {margin}%
      </span>
      <div className="mt-auto pt-8">
        <div className="flex h-3 rounded-full overflow-hidden bg-white/20">
          <span className="h-full bg-[#C1F11D]" style={{ width: `${confirmedShare}%` }} />
          <span className="h-full bg-[#FFD84D]" style={{ width: `${totals && totals.profit > 0 ? 100 - confirmedShare : 0}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {([['confirmedPart', totals?.confirmed ?? 0, '#C1F11D'], ['provisionalPart', totals?.provisional ?? 0, '#FFD84D']] as const).map(([key, value, dot]) => (
            <div key={key} className="rounded-xl bg-white/[0.06] ring-1 ring-white/10 px-4 py-3">
              <dt className="flex items-center gap-2 text-[13px] text-white/80"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{t(`web.dash.${key}`)}</dt>
              <dd dir="ltr" className="mt-1 text-[16px] font-medium tabular-nums text-start">{formatPKR(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Trend({ data, monthName, className }: { data?: DashboardData; monthName: (k: string) => string; className: string }) {
  const { t, lang } = useApp();
  const rtl = lang === 'ur';
  const rows = useMemo(() => (data?.trend ?? []).map((m) => ({ label: monthName(m.key), freight: m.freight / 100, expenses: m.expenses / 100, profit: m.profit / 100 })), [data, monthName]);
  const names = { freight: t('fields.freight'), expenses: t('fields.totalExpenses'), profit: t('fields.profit') };
  return (
    <Panel title={t('web.dash.trend')} note={t('web.dash.trendNote')} className={className}
      action={<Legend items={[{ label: names.freight, color: 'var(--accent-lime)' }, { label: names.expenses, color: 'var(--accent-ink)' }, { label: names.profit, color: '#F2994A', line: true }]} />}>
      {!data ? <Skeleton className="h-[300px] w-full" /> : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: rtl ? 0 : 8, left: rtl ? 8 : 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="label" reversed={rtl} tick={{ fontSize: 13 }} tickLine={false} axisLine={false} />
              <YAxis orientation={rtl ? 'right' : 'left'} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => short(v * 100)} />
              <Tooltip cursor={{ fill: 'rgb(var(--text-1))', fillOpacity: 0.04 }} content={<ChartTip names={names} />} />
              <Bar dataKey="freight" fill="var(--accent-lime)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--accent-ink)" radius={[4, 4, 0, 0]} />
              <Line dataKey="profit" type="monotone" stroke="#F2994A" strokeWidth={3} dot={{ r: 4, fill: '#F2994A', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function ExpenseMix({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const total = (data?.expenses ?? []).reduce((n, e) => n + e.amount, 0);
  const name = (g: ExpenseGroup) => (g === 'bills' ? t('modules.bills') : g === 'other' ? t('web.dash.other') : t(`expenseType.${g}`));
  return (
    <Panel title={t('web.dash.expenseMix')} note={t('web.dash.expenseMixNote')} className={className}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : total === 0 ? <Empty text={t('web.dash.noData')} /> : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-[190px] h-[190px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expenses} dataKey="amount" nameKey="group" innerRadius={64} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
                  {data.expenses.map((e) => <Cell key={e.group} fill={groupColor[e.group]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
              <div>
                <p className="text-[12px] text-content-subtle">{t('fields.total')}</p>
                <p dir="ltr" className="font-display text-[20px] tabular-nums text-content">{short(total)}</p>
              </div>
            </div>
          </div>
          <ul className="flex-1 w-full flex flex-col gap-2.5">
            {data.expenses.map((e) => (
              <li key={e.group} className="flex items-center gap-3 text-[14px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: groupColor[e.group] }} />
                <span className="flex-1 text-content-muted truncate">{name(e.group)}</span>
                <span className="text-content-subtle tabular-nums text-[13px]">{Math.round((e.amount / total) * 100)}%</span>
                <span dir="ltr" className="w-[84px] text-end font-medium tabular-nums text-content">{short(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function StatusRing({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const navigate = useNavigate();
  const total = (data?.status ?? []).reduce((n, s) => n + s.count, 0);
  const complete = data?.status.find((s) => s.status === 'complete')?.count ?? 0;
  return (
    <Panel title={t('web.dash.statusMix')} note={t('web.dash.statusNote')} className={className}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : total === 0 ? <Empty text={t('web.dash.noData')} /> : (
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-[170px] h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status.filter((s) => s.count)} dataKey="count" nameKey="status" innerRadius={58} outerRadius={82} paddingAngle={2} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
                  {data.status.filter((s) => s.count).map((s) => <Cell key={s.status} fill={statusColor[s.status]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
              <div>
                <p className="font-display text-[28px] leading-none tabular-nums text-content">{Math.round((complete / total) * 100)}%</p>
                <p className="text-[12px] text-content-subtle mt-1">{t('status.complete')}</p>
              </div>
            </div>
          </div>
          <ul className="w-full grid grid-cols-2 gap-x-4 gap-y-2">
            {data.status.map((s) => (
              <li key={s.status}>
                <button type="button" onClick={() => navigate('/trips')} className="w-full flex items-center gap-2 text-[13px] text-start hover:text-content">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor[s.status] }} />
                  <span className="flex-1 truncate text-content-muted">{t(`status.${s.status}`)}</span>
                  <span className="font-medium tabular-nums text-content">{s.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Trucks({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const rows = (data?.trucks ?? []).slice(0, 6).map((r) => ({ ...r, rupees: r.profit / 100 }));
  return (
    <Panel title={t('web.dash.trucks')} note={t('web.dash.trucksNote', { count: data?.trucks.length ?? 0 })} className={className} action={<OpenAll to="/reports" />}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : rows.length === 0 ? <Empty text={t('web.dash.noData')} /> : (
        // Truck numbers read left to right, so this chart keeps its direction in Urdu too.
        <div dir="ltr" style={{ height: Math.max(rows.length * 46, 160) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="28%">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="vehicle" width={92} tickLine={false} axisLine={false}
                tick={{ fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fill: 'rgb(var(--text-1))' }} />
              <Tooltip cursor={{ fill: 'rgb(var(--text-1))', fillOpacity: 0.04 }} content={<ChartTip names={{ rupees: t('fields.profit') }} />} />
              <Bar dataKey="rupees" radius={[0, 4, 4, 0]} label={{ position: 'right', formatter: (v: number) => short(v * 100), fontSize: 13, fill: 'rgb(var(--text-2))' }}>
                {rows.map((r, i) => <Cell key={r.vehicle} fill={r.profit < 0 ? 'var(--accent-red)' : i === 0 ? 'var(--accent-lime)' : 'var(--accent-ink)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/** Each broker as one bar: what came in, then what is still owed. */
function Collections({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const rows = data?.collections ?? [];
  const top = Math.max(1, ...rows.map((r) => r.received + r.outstanding));
  return (
    <Panel title={t('web.dash.collections')} note={t('web.dash.collectionsNote')} className={className}
      action={<Legend items={[{ label: t('web.dash.receivedLegend'), color: '#16A34A' }, { label: t('web.dash.owedLegend'), color: '#F2B705' }]} />}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : rows.length === 0 ? <Empty text={t('web.dash.topOweNone')} /> : (
        <ul className="flex flex-col gap-4">
          {rows.map((p) => (
            <li key={p.id}>
              <Link to={`/parties/${p.id}`} className="block group">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="truncate text-content group-hover:text-brand-strong transition-colors">{p.name}</span>
                  <span dir="ltr" className="font-medium tabular-nums text-content">{formatPKR(p.outstanding)}</span>
                </div>
                <div className="mt-2 flex h-2.5 rounded-full bg-surface-2 overflow-hidden" style={{ width: `${Math.max(((p.received + p.outstanding) / top) * 100, 8)}%` }}>
                  <span className="h-full bg-[#16A34A]" style={{ width: `${(p.received / (p.received + p.outstanding)) * 100}%` }} />
                  <span className="h-full bg-[#F2B705] flex-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ToFinish({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const rows = data?.toFinish ?? [];
  return (
    <Panel title={t('web.dash.toFinish')} note={data ? String(rows.length) : undefined} className={className} action={<OpenAll to="/trips" />}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : rows.length === 0 ? <Empty text={t('web.dash.toFinishNone')} /> : (
        <ul className="-mx-3 flex flex-col">
          {rows.slice(0, 5).map((c) => (
            <li key={c.caseId}>
              <Link to={`/trips/${c.caseId}`} className="flex items-center gap-3 h-[52px] px-3 rounded-xl hover:bg-surface-2 transition-colors">
                <CaseChip caseNo={c.caseNo} />
                <span dir="ltr" className="flex-1 min-w-0 truncate font-mono text-[13px] text-content-muted">{c.vehicle ?? ''}</span>
                <StatusBadge status={c.summary.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Days left on each policy, as a bar that empties towards the expiry date. */
function Countdown({ data, className }: { data?: DashboardData; className: string }) {
  const { t } = useApp();
  const rows = data?.policies ?? [];
  return (
    <Panel title={t('web.dash.countdown')} className={className} action={<OpenAll to="/insurance" />}>
      {!data ? <Skeleton className="h-[240px] w-full" /> : rows.length === 0 ? <Empty text={t('web.dash.expiringNone')} /> : (
        <ul className="flex flex-col gap-4">
          {rows.slice(0, 5).map((p) => {
            const span = Math.max(1, (new Date(p.expiry).getTime() - new Date(p.start).getTime()) / 86400000);
            const left = Math.max(0, Math.min(100, (p.days / span) * 100));
            const color = p.status === 'expired' ? 'var(--accent-red)' : p.status === 'expiring' ? '#F2B705' : '#16A34A';
            return (
              <li key={p.id}>
                <Link to={`/insurance/${p.id}`} className="block">
                  <div className="flex items-baseline justify-between gap-2 text-[14px]">
                    <span dir="ltr" className="font-mono font-semibold text-content">{p.vehicle}</span>
                    <span className="tabular-nums" style={{ color: p.status === 'active' ? 'rgb(var(--text-2))' : color }}>
                      {p.days < 0 ? t('web.dash.daysOver', { count: -p.days }) : t('web.dash.daysLeft', { count: p.days })}
                    </span>
                  </div>
                  <span className="mt-2 block h-2 rounded-full bg-surface-2 overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${p.days < 0 ? 100 : Math.max(left, 3)}%`, background: color }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
