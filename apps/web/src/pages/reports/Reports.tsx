import { useId, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { sum } from '../../core/domain/calc';
import { monthRange, parseISODate, today } from '../../core/domain/dates';
import { referenceKey } from '../../core/domain/keys';
import { formatPKR } from '../../core/domain/money';
import { listBills } from '../../core/repo/bills';
import { listCycles } from '../../core/repo/cases';
import { listInsurance } from '../../core/repo/insurance';
import { reportToDocument } from '../../core/print/html';
import { buildReport, type ReportKind, type ReportResult, type ReportTotal } from '../../core/repo/reports';
import type { Db } from '../../core/db/core';
import { useApp, useData } from '../../app/context';
import { Segmented } from '../../components/shared/Segmented';
import { Btn, Money, SumLine } from '../../ui/bits';
import { downloadCsv, periodText } from '../../ui/exports';
import { Page } from '../../ui/Page';
import { RangeFilter, rangeFor, type RangeChoice } from '../../ui/range';
import { PrintButton } from '../../ui/record';
import { ReportTable } from './ReportTable';

const kinds: ReportKind[] = ['vehicle', 'cycles', 'confirmed', 'provisional', 'ada', 'party', 'bills', 'insurance'];

type FilterKey = 'caseNo' | 'vehicle' | 'party' | 'route';
/** Filters shown for each report: only those that apply (SRS 08 FR-04). */
const filtersFor: Record<ReportKind, FilterKey[]> = {
  vehicle: ['vehicle'], cycles: ['caseNo', 'vehicle', 'party', 'route'], confirmed: ['caseNo', 'vehicle', 'party', 'route'], provisional: ['caseNo', 'vehicle', 'party', 'route'],
  ada: ['caseNo', 'vehicle', 'party', 'route'], party: ['party', 'caseNo'], bills: ['caseNo', 'vehicle', 'party'], insurance: ['vehicle'],
};

const box = 'noir-input h-8 px-2.5 rounded-lg text-[13px] text-content placeholder:text-content-subtle focus:outline-none';

/** Every V# the app knows, for the suggestion list. */
async function knownVehicles(db: Db): Promise<string[]> {
  const [cycles, insurance, bills] = await Promise.all([listCycles(db), listInsurance(db), listBills(db)]);
  const seen = new Map<string, string>();
  for (const v of [...cycles.map((c) => c.vehicle), ...insurance.map((i) => i.vehicle), ...bills.map((b) => b.vehicle)]) {
    const key = referenceKey(v);
    if (key && !seen.has(key)) seen.set(key, (v as string).trim().toUpperCase());
  }
  return [...seen.values()].sort();
}

export default function Reports() {
  const { t, lang } = useApp();
  const listId = useId();
  const [kind, setKind] = useState<ReportKind>('vehicle');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [choice, setChoice] = useState<RangeChoice>('month');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [filters, setFilters] = useState<Record<FilterKey, string>>({ caseNo: '', vehicle: '', party: '', route: '' });
  const vehicleKind = kind === 'vehicle';
  const range = vehicleKind ? (month ? monthRange(`${month}-01`) : { from: null, to: null }) : rangeFor(choice, custom);
  const applied = Object.fromEntries(filtersFor[kind].map((k) => [k, filters[k].trim()]).filter(([, v]) => v)) as Partial<Record<FilterKey, string>>;
  const { data: report } = useData((db) => buildReport(db, kind, { range, ...applied }), [kind, range.from, range.to, JSON.stringify(applied)]);
  // A stale report from the previous tab would show the wrong columns for a moment.
  const shown = report?.kind === kind ? report : undefined;
  const { data: vehicles } = useData(knownVehicles);

  const monthName = month ? parseISODate(`${month}-01`).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric' }) : t('range.all');
  const title = t(`report.${kind}`);
  const period = vehicleKind
    ? `${monthName}  |  ${t('web.reports.vehicleBox')}: ${applied.vehicle ?? t('web.reports.allTrucks')}`
    : periodText(range, t);
  const setFilter = (key: FilterKey) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const caps = (key: FilterKey) => key === 'caseNo' || key === 'vehicle';
  const placeholder: Record<FilterKey, string> = {
    caseNo: t('web.reports.caseBox'), vehicle: t('web.reports.vehicleBox'),
    party: t(kind === 'bills' ? 'web.reports.vendorBox' : 'web.reports.partyBox'), route: t('web.reports.routeBox'),
  };

  const filterBox = (key: FilterKey) => (
    <input key={key} type="search" value={filters[key]} placeholder={placeholder[key]} aria-label={placeholder[key]}
      list={key === 'vehicle' ? listId : undefined} dir={caps(key) ? 'ltr' : undefined}
      onChange={(e) => setFilter(key)(caps(key) ? e.target.value.toUpperCase() : e.target.value)}
      className={`${box} ${caps(key) ? 'w-32 font-mono tracking-wide placeholder:font-sans placeholder:tracking-normal' : 'w-40'}`} />
  );

  return (
    <Page title={t('modules.reports')} subtitle={title} fit
      actions={<>
        <PrintButton build={() => reportToDocument(shown ?? { kind, columns: [], rows: [], totals: [] }, title, period, t)} />
        <Btn icon={<FileSpreadsheet size={16} />} disabled={!shown} onClick={() => shown && downloadCsv(shown, `${kind}-report`, t)}>{t('web.excel')}</Btn>
      </>}
      bar={<>
        <div className="max-w-full overflow-x-auto scroll-thin [&>div]:flex-nowrap [&_button]:whitespace-nowrap">
          <Segmented ariaLabel={t('report.kind')} value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t(`report.${k}`) }))} />
        </div>
        {vehicleKind ? (
          <label className="inline-flex items-center gap-2 text-[13px] text-content-muted">
            {t('web.reports.month')}
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${box} tabular-nums`} />
          </label>
        ) : <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />}
        <div className="ms-auto flex flex-wrap items-center gap-2">{filtersFor[kind].map(filterBox)}</div>
        <datalist id={listId}>{(vehicles ?? []).map((v) => <option key={v} value={v} />)}</datalist>
      </>}>
      <div className="flex flex-col gap-5 fit:h-full">
        {shown && shown.totals.length > 0 && <Figures report={shown} />}
        <div className="grid grid-cols-1 gap-5 fit:flex-1 fit:min-h-0 fit:grid-cols-12">
          <div className={`fit:min-h-0 ${vehicleKind ? 'fit:col-span-8 xl:col-span-9' : 'fit:col-span-12'}`}>
            <ReportTable title={title} note={shown ? `${t('web.reports.records', { count: shown.rows.length })}  |  ${period}` : undefined}
              report={shown} highlight={applied.caseNo} empty={{ title: t('empty.report'), hint: t('empty.reportHint') }} />
          </div>
          {vehicleKind && <div className="fit:col-span-4 xl:col-span-3 fit:min-h-0"><MonthlyCosts report={shown} /></div>}
        </div>
      </div>
    </Page>
  );
}

const label = (x: ReportTotal, t: (k: string) => string) => x.text ?? t(x.label);
/** Monthly costs come back as totals with a typed name and no label key. */
const isCost = (x: ReportTotal) => !!x.cost || x.label === '';

/** The report's totals in one strip; the last one (profit, balance or bachat) is the headline. */
function Figures({ report }: { report: ReportResult }) {
  const { t } = useApp();
  const head = report.totals[report.totals.length - 1];
  const costs = report.totals.filter(isCost);
  const rest = report.totals.slice(0, -1).filter((x) => !isCost(x));
  const items: ReportTotal[] = report.kind === 'vehicle'
    ? [...rest, { label: 'web.reports.monthlyCosts', value: sum(costs.map((c) => c.value)), tone: 'bad' }]
    : rest;
  return (
    <div className="shrink-0 flex flex-col sm:flex-row gap-4">
      {items.length > 0 && (
        <div className="card flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:divide-x lg:rtl:divide-x-reverse lg:divide-line px-2 py-4">
          {items.map((x) => (
            <div key={x.label + (x.text ?? '')} className="min-w-0 lg:flex-1 px-4 py-1.5">
              <p className="text-[13px] text-content-muted truncate">{label(x, t)}</p>
              <Money value={x.value} tone={x.value < 0 ? 'bad' : undefined}
                className="mt-1 block font-display text-[20px] leading-tight font-semibold tracking-[-0.02em] text-content" />
            </div>
          ))}
        </div>
      )}
      <div className="noir-hero relative overflow-hidden rounded-[20px] px-6 py-4 sm:min-w-[260px] flex flex-col justify-center text-white">
        <p className="text-[13px] text-white/85">{label(head, t)}</p>
        <span dir="ltr" className="hero-accent mt-1 font-display text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums self-start">
          {formatPKR(head.value)}
        </span>
      </div>
    </div>
  );
}

/** The monthly sheet's bottom half: trips profit, each Bill Book cost taken off, then the bachat. */
function MonthlyCosts({ report }: { report: ReportResult | undefined }) {
  const { t } = useApp();
  const totals = report?.totals ?? [];
  const gross = totals.find((x) => x.label === 'report.grossProfit');
  const bachat = totals.find((x) => x.label === 'report.bachat');
  const costs = totals.filter(isCost);
  return (
    <section className="card flex flex-col fit:max-h-full">
      <div className="shrink-0 flex items-baseline justify-between gap-3 px-6 py-4 card-head">
        <h2 className="card-title font-display text-[16px] text-content">{t('web.reports.monthlyCosts')}</h2>
        <span className="text-[13px] text-content-subtle">{t('web.reports.monthlyCostsNote')}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin px-6 py-3">
        <SumLine label={t('report.grossProfit')} value={gross?.value ?? 0} />
        {costs.length === 0
          ? <p className="py-3 text-[13px] text-content-subtle">{t('web.reports.monthlyCostsNone')}</p>
          : costs.map((c) => <SumLine key={c.label + (c.text ?? '')} label={c.text ?? t(c.label)} value={Math.abs(c.value)} sign="-" />)}
        <SumLine label={t('report.bachat')} value={bachat?.value ?? 0} total tone={(bachat?.value ?? 0) < 0 ? 'bad' : undefined} />
      </div>
      <p className="shrink-0 px-6 py-3.5 border-t border-line text-[12px] leading-relaxed text-content-subtle">{t('report.vehicleHint')}</p>
    </section>
  );
}
