import { formatDate } from '../domain/dates';
import { formatPKR } from '../domain/money';
import type { Translate } from '../i18n';
import type { AdaView, Receipt } from '../repo/ada';
import type { BillView } from '../repo/bills';
import { sheetExpenseRows, sheetHeader, sheetTotals, type CaseView } from '../repo/cases';
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

/** Places joined in travel order, a place repeated back to back shown once. */
function routeLine(places: (string | null | undefined)[]): string | null {
  const out: string[] = [];
  for (const p of places) {
    const name = p?.trim();
    if (name && name.toLowerCase() !== out[out.length - 1]?.toLowerCase()) out.push(name);
  }
  return out.length ? out.join(' → ') : null;
}

/**
 * The trip sheet for the whole trip (going and return): V# and Case # once, the full route on one
 * line, each broker with its freight on the right, one two-column expense table with only the
 * expenses actually saved, then Total Freight, Total Expenses and Net Profit for the whole trip.
 */
export function caseDocument(v: CaseView, t: Translate): PrintDocument {
  const h = sheetHeader(v);
  const out = v.adaOutward[0];
  const ret = v.adaReturn[0];
  const st = sheetTotals(v);
  const outwardDate = v.outward?.trip_date ?? out?.entry_date ?? null;
  const returnDate = v.returnLeg?.trip_date ?? ret?.entry_date ?? null;
  const dates = [outwardDate, returnDate].filter((d): d is string => d !== null).map(formatDate);
  const route = routeLine([
    v.outward?.from_place ?? out?.from_place, v.outward?.to_place ?? out?.to_place,
    v.returnLeg?.from_place ?? ret?.from_place, v.returnLeg?.to_place ?? ret?.to_place,
  ]);
  const outwardBroker = v.outward?.party_name ?? out?.party_name ?? (v.returnLeg || ret ? null : h.broker);
  const returnBroker = v.returnLeg?.party_name ?? ret?.party_name ?? null;
  const hasReturn = v.returnLeg !== null || v.adaReturn.length > 0;

  const header: (string | null)[][] = [
    [t('report.vehicleLabel'), h.vehicle ?? '–', dates.length ? `\u2066${[...new Set(dates)].join(' – ')}\u2069` : null],
    [t('fields.caseNo'), v.caseRow.case_no, t(`status.${v.summary.status}`)],
    [t('fields.route'), route ?? '–', null],
    [t('trip.outwardBroker'), outwardBroker ?? '–', formatPKR(st.outwardFreight)],
  ];
  if (hasReturn || st.returnFreight) header.push([t('trip.returnBroker'), returnBroker ?? '–', formatPKR(st.returnFreight)]);

  // Only expenses actually saved; diesel and oil carry their slip details on a second line.
  const expenseRows = sheetExpenseRows(v, t('modules.bills')).filter((r) => r.amount !== null).map((r) => {
    const name = r.category ?? t(`expenseType.${r.typeKey}`);
    let label = name;
    if (r.typeKey === 'diesel' || r.typeKey === 'oil') {
      const details = [
        r.station && `${t('fields.station')}: ${r.station}`,
        r.slipNo && `${t('fields.slipNo')}: ${r.slipNo}`,
        r.litres && `${t('fields.litres')}: ${r.litres}`,
        r.rate !== null && `${t('fields.rate')}: ${formatPKR(r.rate)}`,
      ].filter(Boolean).join('  ·  ');
      if (details) label = `${name}\n${details}`;
    } else if (r.typeKey === null && r.category === t('modules.bills') && r.station) {
      label = `${name}: ${r.station}`;
    }
    return [label, formatPKR(r.amount ?? 0)];
  });

  const totalFreight = st.outwardFreight + st.returnFreight;
  const sections: PrintSection[] = [
    { type: 'grid', numeric: [2], rows: header },
    { type: 'table', title: t('trip.expenses'), numeric: [1], details: true,
      head: [t('trip.expenseDescription'), t('fields.amount')],
      rows: expenseRows.length ? expenseRows : [[t('trip.noExpenses'), null]],
      foot: [t('fields.totalExpenses'), formatPKR(st.expenses)],
    },
    { type: 'totals', totals: [
      [t('fields.totalFreight'), formatPKR(totalFreight)],
      [t('fields.totalExpenses'), formatPKR(st.expenses)],
      [t('trip.netProfit'), formatPKR(totalFreight - st.expenses)],
    ] },
  ];
  return { title: t('trip.sheet'), sections, fileName: `${t('trip.sheet')} - ${t('fields.caseNo')} ${v.caseRow.case_no}${h.vehicle ? ` - ${h.vehicle}` : ''}` };
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
