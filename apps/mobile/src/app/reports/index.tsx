import { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '../../domain/dates';
import { formatPKR } from '../../domain/money';
import { reportToCsv } from '../../print/csv';
import { reportToDocument } from '../../print/html';
import { buildReport, type ReportColumn, type ReportKind, type ReportRow } from '../../repo/reports';
import { shareTextFile } from '../../services/files';
import { useApp, useData } from '../../ui/context';
import { Banner, Button, Card, Chips, Empty, Field, Line, SummaryCard } from '../../ui/controls';
import { useAction } from '../../ui/hooks';
import { FilterPanel, ListScreen, RangePicker, rangeFor, type RangeChoice } from '../../ui/screen';
import { usePrint } from '../../ui/shared';
import { T } from '../../ui/text';
import { colors, space } from '../../ui/theme';

const kinds: ReportKind[] = ['vehicle', 'cycles', 'confirmed', 'provisional', 'ada', 'party', 'bills', 'insurance'];

/** Filters shown for each report: only those that apply (SRS 08 FR-04). */
const filtersFor: Record<ReportKind, ('caseNo' | 'vehicle' | 'party' | 'route')[]> = {
  vehicle: ['vehicle'], cycles: ['caseNo', 'vehicle', 'party', 'route'], confirmed: ['caseNo', 'vehicle', 'party', 'route'], provisional: ['caseNo', 'vehicle', 'party', 'route'],
  ada: ['caseNo', 'vehicle', 'party', 'route'], party: ['party', 'caseNo'], bills: ['caseNo', 'vehicle', 'party'], insurance: ['vehicle'],
};

export default function Reports() {
  const { t } = useApp();
  const print = usePrint();
  const { run } = useAction();
  const [kind, setKind] = useState<ReportKind>('vehicle');
  const [choice, setChoice] = useState<RangeChoice>('month');
  const [custom, setCustom] = useState({ from: null as string | null, to: null as string | null });
  const [filters, setFilters] = useState({ caseNo: '', vehicle: '', party: '', route: '' });
  const range = rangeFor(choice, custom);
  const applied = Object.fromEntries(filtersFor[kind].map((k) => [k, filters[k]]));
  const request = { range, ...applied };
  const { data: report } = useData((d) => buildReport(d, kind, request), [kind, range.from, range.to, JSON.stringify(applied)]);
  const active = Object.values(applied).filter(Boolean).length;

  const title = t(`report.${kind}`);
  const period = range.from || range.to ? `${t('report.period')}: ${formatDate(range.from) || '...'} - ${formatDate(range.to) || '...'}` : t('range.all');
  const show = (col: ReportColumn, row: ReportRow) => {
    const value = row[col.key];
    if (col.type === 'money') return formatPKR(Number(value ?? 0));
    if (col.type === 'date') return formatDate(value as string);
    if (col.type === 'status') return t(String(value));
    return value === null || value === undefined ? '' : String(value);
  };

  return (
    <ListScreen
      title={t('modules.reports')}
      data={report?.rows ?? []}
      keyExtractor={(row) => JSON.stringify(row)}
      renderItem={({ item: row }) => (
        <Card>
          {report?.columns.map((col, i) => {
            const text = show(col, row);
            if (!text) return null;
            return i === 0 ? <T key={col.key} variant="heading">{text}</T> : <Line key={col.key} label={t(col.label)} value={text} strong={col.key === 'profit' || col.key === 'balance'} />;
          })}
        </Card>
      )}
      empty={<Empty icon="chart-box-outline" title={t('empty.report')} hint={t('empty.reportHint')} />}
    >
      <Chips label={t('report.kind')} value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t(`report.${k}`) }))} />
      <RangePicker choice={choice} onChoice={setChoice} custom={custom} onCustom={setCustom} />
      {kind === 'vehicle' && <Banner tone="info" icon="information-outline" text={t('report.vehicleHint')} />}
      {kind === 'vehicle' && <Field caps label={t('fields.vehicle')} value={filters.vehicle} onChange={(vehicle) => setFilters({ ...filters, vehicle })} />}
      {kind !== 'vehicle' && <FilterPanel activeCount={active}>
        {filtersFor[kind].includes('caseNo') && <Field caps label={t('fields.caseNo')} value={filters.caseNo} onChange={(caseNo) => setFilters({ ...filters, caseNo })} />}
        {filtersFor[kind].includes('vehicle') && <Field caps label={t('fields.vehicle')} value={filters.vehicle} onChange={(vehicle) => setFilters({ ...filters, vehicle })} />}
        {filtersFor[kind].includes('party') && <Field label={t(kind === 'bills' ? 'fields.vendor' : 'fields.party')} value={filters.party} onChange={(party) => setFilters({ ...filters, party })} />}
        {filtersFor[kind].includes('route') && <Field label={t('fields.route')} value={filters.route} onChange={(route) => setFilters({ ...filters, route })} />}
      </FilterPanel>}
      {report && report.totals.length > 0 && (
        // The last total is the one the report exists for (profit, balance or bachat).
        <SummaryCard
          rows={report.totals.slice(0, -1).map((x) => ({ label: x.text ?? t(x.label), value: formatPKR(x.value), tone: x.tone }))}
          headline={(() => { const x = report.totals[report.totals.length - 1]; return { label: x.text ?? t(x.label), value: formatPKR(x.value), tone: x.tone }; })()}
        />
      )}
      {report && report.rows.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T variant="small" color={colors.muted}>{t('report.records')}: {report.rows.length}  |  {period}</T>
          <Button icon="printer-outline" label={t('actions.print')} onPress={() => print(() => reportToDocument(report, title, period, t))} />
          <Button tone="plain" icon="microsoft-excel" label={t('actions.shareCsv')} onPress={() => run(() => shareTextFile(`${kind}-report.csv`, reportToCsv(report, t), 'text/csv'))} />
        </View>
      )}
    </ListScreen>
  );
}
