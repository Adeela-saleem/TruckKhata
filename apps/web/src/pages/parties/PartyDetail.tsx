import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Briefcase, HandCoins, Pencil, Wallet, Scale } from 'lucide-react';
import { formatDate } from '../../core/domain/dates';
import { referenceKey } from '../../core/domain/keys';
import { formatPKR } from '../../core/domain/money';
import { partyDocument } from '../../core/print/documents';
import { listAdjustments, partyAccount, setPartyArchived, type Adjustment, type LedgerEntry } from '../../core/repo/parties';
import { useApp, useData } from '../../app/context';
import { useAction } from '../../app/hooks';
import { KpiStrip } from '../../components/shared/DataViz';
import { Segmented } from '../../components/shared/Segmented';
import { EmptyState } from '../../components/shared/states';
import { Badge } from '../../components/ui/Badge';
import { cn } from '../../components/ui/cn';
import { Btn, CaseChip, DirectionBadge, Facts, Money, SectionCard, SumLine } from '../../ui/bits';
import { Page } from '../../ui/Page';
import { periodText } from '../../ui/exports';
import { RangeFilter, SearchBox, rangeFor, type RangeChoice } from '../../ui/range';
import { DeleteButton, HistoryCard, PrintButton } from '../../ui/record';
import { RecordHeader } from '../../ui/RecordHeader';
import { EntryModal } from './EntryModal';

type Kind = 'all' | 'freight' | 'receipt';

const th = 'h-[48px] px-4 first:ps-6 last:pe-6 text-[13px] font-medium text-content-subtle whitespace-nowrap border-b border-line';
const td = 'px-4 first:ps-6 last:pe-6 text-[14px] text-content whitespace-nowrap';

export default function PartyDetail() {
  const { id = '' } = useParams();
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { run } = useAction();
  const [choice, setChoice] = useState<RangeChoice>('all');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [caseNo, setCaseNo] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [entry, setEntry] = useState<Adjustment | 'new' | null>(null);
  const range = rangeFor(choice, custom);
  const { data } = useData(async (d) => {
    const account = await partyAccount(d, id, { range, caseNo, kind: kind === 'all' ? undefined : kind });
    const adjustments = account ? await listAdjustments(d, id) : [];
    return { account, adjustments };
  }, [id, range.from, range.to, caseNo, kind]);

  const account = data?.account;
  if (data && (!account || account.party.deleted_at)) {
    return <Page title={t('modules.parties')}><div className="card"><EmptyState title={t('web.notFound')} /></div></Page>;
  }
  if (!account || !data) return <Page title={t('modules.parties')}>{null}</Page>;
  const p = account.party;

  // With a Case # typed in the filter, the matching Case # stands out everywhere on the page.
  const searchKey = referenceKey(caseNo);
  const hit = (value: string | null) => searchKey !== '' && referenceKey(value).includes(searchKey);
  const filtered = choice !== 'all' || searchKey !== '' || kind !== 'all';
  const subtitle = filtered ? [choice !== 'all' && periodText(range, t), caseNo.trim() && `${t('fields.caseNo')}: ${caseNo.trim()}`, kind !== 'all' && t(`ledger.${kind}`)].filter(Boolean).join(' · ') : undefined;
  const doc = () => partyDocument(account, t, subtitle);

  const open = (e: LedgerEntry) => {
    if (e.source === 'ada') { navigate(`/ada/${e.refId}`); return; }
    const adj = data.adjustments.find((j) => j.id === e.refId);
    if (adj) setEntry(adj);
  };
  const owesUs = (e: LedgerEntry) => e.kind === 'freight' || e.kind === 'charge';

  return (
    <Page title={p.name} subtitle={t('party.statement')}
      actions={<>
        <PrintButton build={doc} label={t('web.parties.printStatement')} />
        <Btn icon={<Pencil size={16} />} onClick={() => navigate(`/parties/${id}/edit`)}>{t('actions.edit')}</Btn>
      </>}>
      <div className="max-w-[1800px] flex flex-col gap-5">
        <RecordHeader
          badges={p.archived_at ? <Badge tone="neutral">{t('party.archived')}</Badge> : undefined}
          meta={<>
            <span dir="ltr" className="tabular-nums">{p.phone ?? t('party.noPhone')}</span>
            {p.address && <> · {p.address}</>}
          </>}
          aside={
            <div className="flex flex-wrap gap-2">
              <Btn icon={p.archived_at ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                onClick={() => run(async () => { await setPartyArchived(db, id, !p.archived_at); })}>
                {p.archived_at ? t('actions.unarchive') : t('actions.archive')}
              </Btn>
              <Btn tone="primary" icon={<HandCoins size={16} />} onClick={() => setEntry('new')}>{t('web.parties.recordPayment')}</Btn>
            </div>
          } />

        <KpiStrip columns={4} kpis={[
          { label: t('fields.totalFreight'), icon: Wallet, tone: 'var(--accent-green)', value: p.freight / 100, display: formatPKR(p.freight), note: t('web.parties.freightNote') },
          { label: t('fields.received'), icon: HandCoins, tone: 'var(--accent-blue)', value: (p.received + account.manualPayments) / 100, display: formatPKR(p.received + account.manualPayments),
            note: account.manualPayments > 0 ? t('web.parties.receivedWithManual', { amount: formatPKR(account.manualPayments) }) : t('web.parties.receivedNote') },
          { label: t('fields.outstanding'), icon: Scale, tone: p.outstanding > 0 ? 'var(--accent-red)' : 'var(--accent-slate)', value: p.outstanding / 100, display: formatPKR(p.outstanding),
            alarm: p.outstanding > 0, note: p.outstanding > 0 ? t('web.parties.outstandingNote') : t('web.parties.settled') },
          { label: t('party.casesCount'), icon: Briefcase, tone: 'var(--accent-slate)', value: p.caseCount, display: String(p.caseCount), note: t('web.list.entries', { count: account.ada.length }) },
        ]} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
            <SectionCard title={t('party.cases')} note={String(account.ada.length)} padded={false}>
              {account.ada.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{t('web.parties.noCases')}</p>
                : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="noir-thead">
                          <th scope="col" className={cn(th, 'text-start')}>{t('fields.caseNo')}</th>
                          <th scope="col" className={cn(th, 'text-start')}>{t('fields.direction')}</th>
                          <th scope="col" className={cn(th, 'text-start hidden sm:table-cell')}>{t('fields.date')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.due')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.received')}</th>
                          <th scope="col" className={cn(th, 'text-end')}>{t('fields.balance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.ada.map((a) => (
                          <tr key={a.id} tabIndex={0} onClick={() => navigate(`/ada/${a.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/ada/${a.id}`); }}
                            className="noir-row h-[52px] border-b border-line last:border-b-0 cursor-pointer">
                            <td className={td}><CaseChip caseNo={a.case_no} highlight={hit(a.case_no)} /></td>
                            <td className={td}><DirectionBadge direction={a.direction} /></td>
                            <td className={cn(td, 'hidden sm:table-cell tabular-nums text-content-muted')}>{formatDate(a.entry_date)}</td>
                            <td className={cn(td, 'text-end')}><Money value={a.due} /></td>
                            <td className={cn(td, 'text-end')}><Money value={a.received} tone="good" /></td>
                            <td className={cn(td, 'text-end')}><Money value={a.balance} tone={a.balance > 0 ? 'bad' : 'muted'} className="font-semibold" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </SectionCard>

            <SectionCard title={t('party.ledger')} note={t('web.list.entries', { count: account.ledger.length })} padded={false}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-6 py-3 border-b border-line bg-surface-2/50">
                <Segmented<Kind> ariaLabel={t('fields.entryType')} value={kind} onChange={setKind}
                  options={[{ value: 'all', label: t('range.all') }, { value: 'freight', label: t('ledger.freight') }, { value: 'receipt', label: t('ledger.receipt') }]} />
                <RangeFilter choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
                <div className="ms-auto">
                  <SearchBox value={caseNo} onChange={(v) => setCaseNo(v.toUpperCase())} placeholder={t('web.parties.caseFilter')} className="w-44 font-mono tracking-wide placeholder:font-sans placeholder:tracking-normal" />
                </div>
              </div>
              {account.ledger.length === 0
                ? <p className="px-6 py-6 text-[14px] text-content-subtle">{filtered ? t('empty.noMatch') : t('empty.ledger')}</p>
                : (
                  <ul className="divide-y divide-line">
                    {account.ledger.map((e) => (
                      <li key={e.key}>
                        <button type="button" onClick={() => open(e)} className="noir-row w-full flex items-center gap-x-4 gap-y-1 px-6 min-h-[56px] py-2 text-start flex-wrap sm:flex-nowrap">
                          <span className="w-24 shrink-0 tabular-nums text-[14px] text-content-muted">{formatDate(e.date)}</span>
                          <span className="w-28 shrink-0"><CaseChip caseNo={e.caseNo} highlight={hit(e.caseNo)} /></span>
                          <span className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-[14px] font-medium text-content whitespace-nowrap">{t(`ledger.${e.kind}`)}</span>
                            {e.source === 'manual' && <Badge tone="warning">{t('ledger.source_manual')}</Badge>}
                            {e.note && <span className="min-w-0 truncate text-[13px] text-content-subtle">{e.note}</span>}
                          </span>
                          <Money value={e.amount} sign={owesUs(e) ? '+' : '-'} tone={owesUs(e) ? undefined : 'good'} className="ms-auto text-[14px] font-semibold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </SectionCard>

            <HistoryCard recordIds={[id, ...data.adjustments.map((j) => j.id)]} record={doc} />
            <div><DeleteButton table="parties" id={id} after={() => navigate('/parties', { replace: true })} /></div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-5">
            <SectionCard title={t('web.parties.account')}>
              <SumLine label={t('party.totalFreight')} value={p.freight} />
              <SumLine label={t('party.fromAda')} value={p.received} sign="-" tone="good" />
              {account.manualPayments > 0 && <SumLine label={t('party.manualPayments')} value={account.manualPayments} sign="-" tone="good" />}
              {account.manualCharges > 0 && <SumLine label={t('party.manualCharges')} value={account.manualCharges} sign="+" />}
              <div className="mt-3 rounded-xl bg-surface-2 border border-line px-4 py-3 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold text-content">{t('fields.outstanding')}</span>
                <Money value={p.outstanding} tone={p.outstanding > 0 ? 'bad' : undefined} className="font-display text-[28px] font-semibold tracking-[-0.02em]" />
              </div>
            </SectionCard>
            <SectionCard title={t('web.parties.details')}>
              <Facts columns={2} items={[
                { label: t('fields.phoneShort'), value: p.phone ? <span dir="ltr" className="tabular-nums">{p.phone}</span> : <span className="text-content-subtle">{t('party.noPhone')}</span> },
                { label: t('fields.addressShort'), value: p.address },
              ]} />
            </SectionCard>
          </aside>
        </div>
      </div>
      <EntryModal partyId={id} entry={entry} caseNo={caseNo.trim() || undefined} onClose={() => setEntry(null)} />
    </Page>
  );
}
