import { formatDate } from '../domain/dates';
import { formatPKR } from '../domain/money';
import type { Translate } from '../i18n';
import type { AdaView, Receipt } from '../repo/ada';
import type { BillView } from '../repo/bills';
import { sheetExpenseRows, sheetHeader, sheetTotals, type CaseView, type SheetHeader } from '../repo/cases';
import type { InsuranceView } from '../repo/insurance';
import type { PartyAccount, PartyTotals } from '../repo/parties';
import type { PrintDocument, PrintSection } from './html';

export function adaDocument(a: AdaView, receipts: Receipt[], t: Translate): PrintDocument {
  const sign = (mode: AdaView['mt_mode']) => (mode === 'deduct' ? '- ' : '+ ');
  const totals: [string, string][] = [
    [t('fields.freightRate'), formatPKR(a.freight_rate)], [t('fields.commission'), `- ${formatPKR(a.commission)}`], [t('fields.net'), formatPKR(a.net)],
  ];
  if (a.mt_amount) totals.push([`${t('fields.mt')} (${t(`adjust.${a.mt_mode}`)})`, sign(a.mt_mode) + formatPKR(a.mt_amount)]);
  if (a.dihari_total) {
    const days = a.dihari_days === null ? '' : `: ${a.dihari_days} x ${formatPKR(a.dihari_rate)}`;
    totals.push([`${t('fields.dihariTotal')}${days}`, sign(a.dihari_mode) + formatPKR(a.dihari_total)]);
  }
  totals.push([t('fields.due'), formatPKR(a.due)], [t('fields.received'), formatPKR(a.received)], [t('fields.balance'), formatPKR(a.balance)]);
  const sections: PrintSection[] = [
    { type: 'pairs', pairs: [
      [t('fields.caseNo'), a.case_no], [t('fields.direction'), t(`direction.${a.direction}`)], [t('fields.date'), formatDate(a.entry_date)],
      [t('fields.vehicle'), a.vehicle], [t('fields.weight'), a.weight], [t('fields.from'), a.from_place], [t('fields.to'), a.to_place],
      [t('fields.empty'), a.empty], [t('fields.broker'), a.party_name], [t('fields.emptyMt'), a.empty_mt], [t('fields.dihari'), a.dihari],
    ] },
    { type: 'totals', totals },
  ];
  if (receipts.length) sections.push({
    type: 'table', title: t('ada.receipts'), numeric: [1],
    head: [t('fields.date'), t('fields.amount'), t('fields.note')],
    rows: receipts.map((r) => [formatDate(r.receipt_date), formatPKR(r.amount), r.note]),
  });
  return { title: t('modules.ada'), subtitle: `${t('fields.caseNo')}: ${a.case_no}  |  ${t(`direction.${a.direction}`)}`, sections };
}

/**
 * Laid out like the company's paper trip sheet: V# and Case #, from and to with dates, broker,
 * market and return with weight and freight, then every expense line, then total, freight and profit.
 */
export function caseDocument(v: CaseView, t: Translate): PrintDocument {
  const h = sheetHeader(v);
  const out = v.adaOutward[0];
  const ret = v.adaReturn[0];
  const returnBroker = v.returnLeg?.party_name ?? ret?.party_name ?? null;
  const load = (l: SheetHeader['market']) => (l ? [l.weight, formatPKR(l.freight)] : [t('trip.notAddedShort'), null]);
  const sections: PrintSection[] = [
    { type: 'grid', numeric: [2], rows: [
      [t('fields.caseNo'), v.caseRow.case_no, t(`status.${v.summary.status}`)],
      [t('fields.from'), h.from, formatDate(v.outward?.trip_date ?? out?.entry_date ?? null)],
      [t('fields.to'), h.to, formatDate(v.returnLeg?.trip_date ?? ret?.entry_date ?? null)],
      [t('fields.broker'), h.broker, returnBroker && returnBroker !== h.broker ? returnBroker : null],
      [t('trip.market'), ...load(h.market)],
      [t('trip.returnLoad'), ...load(h.returnLoad)],
    ] },
    { type: 'table', title: t('trip.expenses'), numeric: [3, 4, 5],
      head: [t('trip.expenses'), t('report.dieselStation'), t('fields.slipNo'), t('fields.litres'), t('fields.amount'), t('fields.rate')],
      rows: sheetExpenseRows(v, t('modules.bills')).map((r) => [
        r.category ?? t(`expenseType.${r.typeKey}`), r.station, r.slipNo, r.litres,
        r.amount === null ? null : formatPKR(r.amount), r.rate === null ? null : formatPKR(r.rate),
      ]),
    },
  ];
  const st = sheetTotals(v);
  const profitLabel = `${t('fields.profit')} (${t(v.summary.confirmed ? 'trip.confirmed' : 'trip.provisional')})`;
  const totals: [string, string][] = [
    [t('trip.outwardFreight'), formatPKR(st.outwardFreight)], [t('trip.returnFreight'), formatPKR(st.returnFreight)],
    [t('fields.total'), formatPKR(st.expenses)], [t('trip.cycleFreight'), formatPKR(st.freight)],
  ];
  if (v.ada.length) totals.push([t('trip.received'), formatPKR(st.received)], [t('trip.balance'), formatPKR(st.balance)]);
  totals.push([profitLabel, formatPKR(st.profit)]);
  sections.push({ type: 'totals', totals });
  return { title: t('trip.sheet'), subtitle: `${t('report.vehicleLabel')}: ${h.vehicle ?? '–'}`, sections };
}

export function partyDocument(account: PartyAccount, t: Translate, subtitle?: string): PrintDocument {
  const p = account.party;
  return {
    title: `${t('party.statement')}: ${p.name}`,
    subtitle,
    sections: [
      { type: 'pairs', pairs: [[t('fields.phoneShort'), p.phone], [t('fields.addressShort'), p.address]] },
      { type: 'totals', totals: [
        [t('party.totalFreight'), formatPKR(p.freight)], [t('party.fromAda'), formatPKR(p.received)], [t('party.manualPayments'), formatPKR(account.manualPayments)],
        [t('party.manualCharges'), formatPKR(account.manualCharges)], [t('fields.outstanding'), formatPKR(p.outstanding)],
      ] },
      { type: 'table', title: t('party.cases'), numeric: [2, 3, 4],
        head: [t('fields.caseNo'), t('fields.direction'), t('fields.freight'), t('fields.received'), t('fields.balance')],
        rows: account.ada.map((a) => [a.case_no, t(`direction.${a.direction}`), formatPKR(a.due), formatPKR(a.received), formatPKR(a.balance)]),
      },
      { type: 'table', title: t('party.ledger'), numeric: [4],
        head: [t('fields.date'), t('fields.caseNo'), t('fields.entryType'), t('fields.source'), t('fields.amount')],
        rows: account.ledger.map((e) => [formatDate(e.date), e.caseNo, t(`ledger.${e.kind}`), t(`ledger.source_${e.source}`), formatPKR(e.amount)]),
      },
    ],
  };
}

export function billDocument(b: BillView, t: Translate): PrintDocument {
  const sections: PrintSection[] = [
    { type: 'pairs', pairs: [
      [t('fields.date'), formatDate(b.bill_date)], [t('fields.vendor'), b.vendor], [t('fields.vehicle'), b.vehicle], [t('fields.caseNo'), b.case_no], [t('fields.notes'), b.notes],
    ] },
    { type: 'table', title: t('bill.lines'), numeric: [3],
      head: [t('fields.itemName'), t('fields.quantity'), t('fields.unit'), t('fields.amount')],
      rows: b.lines.map((l) => [l.description, l.quantity, l.unit, formatPKR(l.amount)]),
    },
    { type: 'totals', totals: [[t('fields.total'), formatPKR(b.total)], [t('fields.paid'), formatPKR(b.paid)], [t('fields.balance'), formatPKR(b.balance)]] },
  ];
  return { title: t('modules.bills'), subtitle: b.vendor, sections };
}

export function insuranceDocument(i: InsuranceView, t: Translate): PrintDocument {
  return {
    title: t('modules.insurance'),
    subtitle: i.vehicle,
    sections: [{ type: 'pairs', pairs: [
      [t('fields.vehicle'), i.vehicle], [t('fields.status'), t(`insurance.${i.status}`)], [t('fields.expiry'), formatDate(i.expiry_date)],
      [t('fields.startDate'), i.start_date ? formatDate(i.start_date) : null], [t('fields.insuranceType'), i.category],
      [t('fields.policyNo'), i.policy_no], [t('fields.notes'), i.notes],
    ] }],
  };
}

/** Every broker / party on the list with what they owe, as one report. */
export function partiesDocument(parties: PartyTotals[], t: Translate): PrintDocument {
  const total = (pick: (p: PartyTotals) => number) => formatPKR(parties.reduce((n, p) => n + pick(p), 0));
  return {
    title: t('report.partyBalances'),
    subtitle: `${t('report.records')}: ${parties.length}`,
    sections: [
      { type: 'totals', totals: [
        [t('party.totalFreight'), total((p) => p.freight)], [t('report.receivedAll'), total((p) => p.received)], [t('fields.outstanding'), total((p) => p.outstanding)],
      ] },
      { type: 'table', numeric: [2, 3, 4, 5],
        head: [t('fields.name'), t('fields.phoneShort'), t('party.casesCount'), t('fields.freight'), t('fields.received'), t('fields.outstanding')],
        rows: parties.map((p) => [p.name, p.phone, String(p.caseCount), formatPKR(p.freight), formatPKR(p.received), formatPKR(p.outstanding)]),
      },
    ],
  };
}
