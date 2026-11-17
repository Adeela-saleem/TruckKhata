import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import type { CycleSummary, Direction } from '../../core/domain/calc';
import { today } from '../../core/domain/dates';
import { moneyToInput, parseMoney } from '../../core/domain/money';
import { findCaseByNo, getCaseView, getLeg, saveLeg } from '../../core/repo/cases';
import { partyNames } from '../../core/repo/parties';
import { useApp, useData } from '../../app/context';
import { useDialog } from '../../app/dialog';
import { moneyOrNull, useAction, useForm } from '../../app/hooks';
import { Btn, CaseChip, DirectionBadge, Money, Note, StatusBadge } from '../../ui/bits';
import { Choice, DateField, Field, FormSection, MoneyField, SuggestField, TextArea } from '../../ui/fields';
import { Page } from '../../ui/Page';

/** What is already known about the typed Case #, shown beside the form. */
type Known = { caseId: string; summary: CycleSummary; hasAda: boolean; legDirections: Direction[] } | null;

export default function TripForm() {
  const { db, t } = useApp();
  const navigate = useNavigate();
  const { toast } = useDialog();
  const { busy, run } = useAction();
  const { legId } = useParams();
  const [params] = useSearchParams();
  const { values: f, set, setValues } = useForm({
    caseNo: params.get('caseNo') ?? '', direction: (params.get('direction') === 'return' ? 'return' : 'outward') as Direction, date: today(),
    vehicle: '', from: '', to: '', party: '', freight: '', driver: '', advance: '', weight: '', items: '',
  });
  const [loaded, setLoaded] = useState(!legId);
  const [known, setKnown] = useState<Known>(null);
  const { data: parties } = useData(partyNames);

  useEffect(() => {
    if (!legId) return;
    getLeg(db, legId).then(async (l) => {
      if (!l) return;
      const view = await getCaseView(db, l.case_id);
      setValues({
        caseNo: l.case_no, direction: l.direction, date: l.trip_date, vehicle: l.vehicle ?? '', from: l.from_place ?? '', to: l.to_place ?? '',
        party: l.party_name ?? '', freight: moneyToInput(view?.caseRow.cycle_freight), driver: l.driver ?? '', advance: moneyToInput(l.advance),
        weight: l.weight ?? '', items: l.item_details ?? '',
      });
      setLoaded(true);
    });
  }, [db, legId, setValues]);

  // A known Case # fills in what is already recorded, so the same details are not typed twice.
  useEffect(() => {
    if (!f.caseNo.trim()) { setKnown(null); return; }
    let current = true;
    (async () => {
      const found = await findCaseByNo(db, f.caseNo);
      const view = found ? await getCaseView(db, found.id) : null;
      if (!current) return;
      setKnown(view ? { caseId: view.caseRow.id, summary: view.summary, hasAda: view.ada.length > 0, legDirections: view.legs.map((l) => l.direction) } : null);
      if (legId || !view) return;
      const ada = view.adaOutward[0] ?? view.ada[0];
      const outward = view.outward;
      const swap = f.direction === 'return';
      const start = outward?.from_place ?? ada?.from_place ?? '';
      const end = outward?.to_place ?? ada?.to_place ?? '';
      const adaFreight = view.ada.reduce((n, a) => n + a.freight_rate, 0);
      setValues((v) => ({
        ...v,
        vehicle: v.vehicle || (outward?.vehicle ?? ada?.vehicle ?? ''),
        party: v.party || (outward?.party_name ?? ada?.party_name ?? ''),
        from: v.from || (swap ? end : start),
        to: v.to || (swap ? start : end),
        driver: v.driver || (outward?.driver ?? ''),
        freight: v.freight || moneyToInput(view.caseRow.cycle_freight ?? (adaFreight || null)),
      }));
    })();
    return () => { current = false; };
  }, [db, f.caseNo, f.direction, legId, setValues]);

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const caseId = await saveLeg(db, {
        caseNo: f.caseNo, direction: f.direction, date: f.date, vehicle: f.vehicle, fromPlace: f.from, toPlace: f.to, partyName: f.party,
        driver: f.driver, advance: moneyOrNull(f.advance), weight: f.weight, itemDetails: f.items, cycleFreight: moneyOrNull(f.freight),
      }, legId);
      toast.success(t('web.saved'));
      navigate(`/trips/${caseId}`, { replace: true });
    });
  };

  const clash = !legId && known?.legDirections.includes(f.direction);

  return (
    <Page title={legId ? t('web.trips.editTrip') : t('web.trips.newTrip')} subtitle={t('modules.trips')}>
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start max-w-[1800px]">
        <div className="xl:col-span-8 flex flex-col gap-5">
          {known?.summary.confirmed && <Note tone="warn">{t('trip.editAfterComplete')}</Note>}
          <FormSection title={t('form.trip')}>
            <Field required caps label={t('fields.caseNo')} value={f.caseNo} onChange={set('caseNo')} autoFocus={!legId} />
            <Choice label={t('fields.adaDirection')} value={f.direction} onChange={set('direction')}
              options={[{ value: 'outward', label: t('direction.outward') }, { value: 'return', label: t('direction.return') }]} />
            <DateField required label={t('fields.date')} value={f.date} onChange={(d) => d && set('date')(d)} />
            <Field caps label={t('fields.vehicle')} value={f.vehicle} onChange={set('vehicle')} />
            <Field label={t('fields.from')} value={f.from} onChange={set('from')} />
            <Field label={t('fields.to')} value={f.to} onChange={set('to')} />
            <SuggestField label={t('fields.broker')} value={f.party} onChange={set('party')} suggestions={parties ?? []} />
            <Field label={t('fields.driver')} value={f.driver} onChange={set('driver')} />
            <MoneyField label={t('fields.advance')} value={f.advance} onChange={set('advance')} />
          </FormSection>

          <FormSection title={t('web.trips.loadSection')}>
            <MoneyField label={t('fields.cycleFreight')} value={f.freight} onChange={set('freight')}
              hint={known?.hasAda ? t('trip.freightFromAda') : t('web.trips.freightHint')} />
            <Field label={t('fields.weight')} value={f.weight} onChange={set('weight')} />
            <TextArea label={t('fields.itemDetails')} value={f.items} onChange={set('items')} className="sm:col-span-2" />
          </FormSection>
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-5 flex flex-col gap-4">
          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between gap-3 card-head -mx-6 -mt-5 mb-4 px-6 py-4">
              <h2 className="card-title font-display text-[16px] text-content">{t('web.trips.summaryTitle')}</h2>
              <span className="text-[13px] text-content-subtle">{t('web.trips.summaryNote')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {f.caseNo.trim() ? <CaseChip caseNo={f.caseNo.trim()} className="h-8 px-2.5 text-[16px]" /> : <span className="text-[14px] text-content-subtle">{t('fields.caseNo')}</span>}
              <DirectionBadge direction={f.direction} />
              {known && <StatusBadge status={known.summary.status} />}
            </div>
            {(f.from || f.to) && <p className="mt-3 text-[14px] text-content-muted">{[f.from, f.to].filter(Boolean).join(' → ')}</p>}
            <div className="mt-4 flex items-baseline justify-between gap-4 rounded-xl bg-surface-2 border border-line px-4 py-3">
              <span className="text-[14px] font-semibold text-content">{t('fields.cycleFreight')}</span>
              <Money value={parseMoney(f.freight) ?? 0} className="font-display text-[20px] font-semibold tracking-[-0.02em]" />
            </div>
            {f.caseNo.trim() && (
              <div className="mt-4">
                {clash ? <Note tone="warn">{t('web.trips.hasLeg')}</Note>
                  : <Note>{known ? t('web.trips.knownCase') : t('web.trips.newCase')}</Note>}
              </div>
            )}
            {known && (
              <Btn tone="quiet" className="mt-3 -ms-3" onClick={() => navigate(`/trips/${known.caseId}`)}>{t('web.trips.openSheet')}</Btn>
            )}
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
