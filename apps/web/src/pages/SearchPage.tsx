import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, SearchX } from 'lucide-react';
import { formatDate } from '../core/domain/dates';
import { referenceKey } from '../core/domain/keys';
import { listAda } from '../core/repo/ada';
import { listBills } from '../core/repo/bills';
import { searchCases } from '../core/repo/trash';
import { useApp, useData } from '../app/context';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { Skeleton } from '../components/shared/Skeleton';
import { Btn, CaseChip, DirectionBadge, Money, PaidBadge } from '../ui/bits';
import { Page } from '../ui/Page';

const LIMIT = 50;

async function find(db: Parameters<typeof searchCases>[0], term: string) {
  if (!term) return { cases: [], ada: [], bills: [] };
  const [cases, ada, bills] = await Promise.all([searchCases(db, term), listAda(db, { search: term }), listBills(db, { search: term })]);
  return { cases, ada: ada.slice(0, LIMIT), bills: bills.slice(0, LIMIT), adaCount: ada.length, billCount: bills.length };
}

export default function SearchPage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const term = (params.get('q') ?? '').trim();
  const { data } = useData((db) => find(db, term), [term]);
  const key = referenceKey(term);
  const hit = (value: string | null | undefined) => !!key && referenceKey(value).includes(key);
  const nothing = data && data.cases.length + data.ada.length + data.bills.length === 0;

  return (
    <Page title={t('web.reports.search.title')} subtitle={term ? t('web.reports.search.resultsFor', { term }) : undefined}>
      {!term ? (
        <EmptyCard title={t('search.title')} hint={t('web.reports.search.start')} />
      ) : nothing ? (
        <EmptyCard title={t('search.noResults')} hint={t('search.noResultsHint')}>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Btn icon={<Plus size={16} />} onClick={() => navigate(`/ada/new?caseNo=${encodeURIComponent(term)}`)}>{t('add.ada')}</Btn>
            <Btn icon={<Plus size={16} />} onClick={() => navigate(`/trips/new?caseNo=${encodeURIComponent(term)}`)}>{t('add.trip')}</Btn>
          </div>
        </EmptyCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
          <Panel title={t('web.reports.search.cases')} count={data?.cases.length} className="xl:col-span-4">
            {!data ? <Loading /> : data.cases.length === 0 ? <None text={t('web.reports.search.casesNone')} /> : (
              <ul className="divide-y divide-line">
                {data.cases.map((c) => (
                  <li key={c.caseId}>
                    <Link to={`/trips/${c.caseId}`} className="noir-row flex items-center gap-3 min-h-[56px] px-6 py-2">
                      <CaseChip caseNo={c.caseNo} highlight={hit(c.caseNo)} />
                      <span className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                        {c.hasAda && <Badge tone="info">{t('search.hasAda')}</Badge>}
                        {c.hasTrip && <Badge tone="violet">{t('search.hasTrip')}</Badge>}
                        {!c.hasAda && !c.hasTrip && <Badge>{t('search.onlyBills')}</Badge>}
                      </span>
                      <ChevronRight size={16} className="text-content-subtle rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
            <Panel title={t('web.reports.search.ada')} count={data?.adaCount}>
              {!data ? <Loading /> : data.ada.length === 0 ? <None text={t('web.reports.search.adaNone')} /> : (
                <Table head={[t('fields.caseNo'), t('fields.direction'), t('fields.date'), t('fields.vehicle'), t('fields.broker'), t('fields.balance')]} endFrom={5}>
                  {data.ada.map((a) => (
                    <Row key={a.id} endFrom={5} onOpen={() => navigate(`/ada/${a.id}`)} cells={[
                      <CaseChip key="c" caseNo={a.case_no} highlight={hit(a.case_no)} />,
                      <DirectionBadge key="d" direction={a.direction} />,
                      <span key="t" className="tabular-nums text-content-muted">{formatDate(a.entry_date)}</span>,
                      <span key="v" dir="ltr" className={cn('font-mono text-[14px]', hit(a.vehicle) && 'font-semibold')}>{a.vehicle ?? '–'}</span>,
                      <span key="p" className="block max-w-[200px] truncate">{a.party_name ?? '–'}</span>,
                      <Money key="b" value={a.balance} tone={a.balance > 0 ? 'bad' : 'muted'} className="font-semibold" />,
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title={t('web.reports.search.bills')} count={data?.billCount}>
              {!data ? <Loading /> : data.bills.length === 0 ? <None text={t('web.reports.search.billsNone')} /> : (
                <Table head={[t('fields.date'), t('fields.vendor'), t('fields.vehicle'), t('fields.caseNo'), t('fields.total'), t('fields.status')]} endFrom={4}>
                  {data.bills.map((b) => (
                    <Row key={b.id} endFrom={4} onOpen={() => navigate(`/bills/${b.id}`)} cells={[
                      <span key="t" className="tabular-nums text-content-muted">{formatDate(b.bill_date)}</span>,
                      <span key="n" className="block max-w-[220px] truncate">{b.vendor}</span>,
                      <span key="v" dir="ltr" className={cn('font-mono text-[14px]', hit(b.vehicle) && 'font-semibold')}>{b.vehicle ?? '–'}</span>,
                      <CaseChip key="c" caseNo={b.case_no} highlight={hit(b.case_no)} />,
                      <Money key="m" value={b.total} />,
                      <PaidBadge key="s" balance={b.balance} />,
                    ]} />
                  ))}
                </Table>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Page>
  );
}

function Panel({ title, count, className, children }: { title: string; count?: number; className?: string; children: ReactNode }) {
  return (
    <section className={cn('card min-w-0 overflow-hidden', className)}>
      <div className="flex items-baseline gap-2 px-6 py-4 card-head">
        <h2 className="card-title font-display text-[16px] text-content">{title}</h2>
        {count !== undefined && <span className="text-[13px] text-content-subtle tabular-nums">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, endFrom, children }: { head: string[]; endFrom: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full border-collapse">
        <thead>
          <tr className="noir-thead">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn('h-[48px] px-4 first:ps-6 last:pe-6 text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line', i >= endFrom ? 'text-end' : 'text-start')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ cells, onOpen, endFrom }: { cells: ReactNode[]; onOpen: () => void; endFrom: number }) {
  return (
    <tr onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }} tabIndex={0}
      className="noir-row h-[52px] border-b border-line last:border-b-0 cursor-pointer">
      {cells.map((c, i) => (
        <td key={i} className={cn('px-4 first:ps-6 last:pe-6 text-[14px] text-content whitespace-nowrap', i >= endFrom ? 'text-end' : 'text-start')}>{c}</td>
      ))}
    </tr>
  );
}

function Loading() {
  return <div className="p-6 flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}

function None({ text }: { text: string }) {
  return <p className="px-6 py-8 text-center text-[13px] text-content-subtle">{text}</p>;
}

function EmptyCard({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <section className="card max-w-[1800px] min-h-[320px] flex flex-col items-center justify-center gap-3 text-center px-6 py-10">
      <span className="grid place-items-center w-12 h-12 rounded-xl bg-surface-2 border border-line text-content-subtle"><SearchX size={22} /></span>
      <div>
        <p className="text-[14px] font-medium text-content">{title}</p>
        {hint && <p className="text-[13px] text-content-subtle mt-1 max-w-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
