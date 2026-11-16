/**
 * Sample data for trying the app: six months of a small fleet, written through the real
 * repositories so every total, balance and history line is exactly what real use produces.
 */
import type { Db } from './db/core';
import { userTables } from './db/schema';
import { addDays, monthRange, parseISODate, toISODate, today } from './domain/dates';
import { addReceipt, createAda } from './repo/ada';
import { saveBill } from './repo/bills';
import { findCaseByNo, markCaseComplete, saveExpense, saveLeg } from './repo/cases';
import { saveInsurance } from './repo/insurance';
import { recordPartyPayment, saveParty } from './repo/parties';
import { getSetting, setSetting } from './repo/settings';

const rs = (n: number) => Math.round(n) * 100;

/** A small repeatable random generator, so the sample looks the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const trucks = ['LES-4521', 'TLR-882', 'LHR-7310', 'FDA-219', 'JT-7751'];
const brokers = ['Haji Rafiq Goods', 'Bismillah Cargo', 'Khan Brothers Adda', 'Sialkot Freight Co', 'Rehman Logistics', 'Faizan Goods Agency', 'Madni Transport Adda'];
const routes: [string, string][] = [
  ['Karachi', 'Gujranwala'], ['Lahore', 'Karachi'], ['Faisalabad', 'Peshawar'], ['Lahore', 'Quetta'],
  ['Multan', 'Islamabad'], ['Sialkot', 'Karachi'], ['Karachi', 'Lahore'], ['Hyderabad', 'Rawalpindi'],
];
const stations = ['PSO Ravi Toll', 'Syed Petroleum', 'Total Parco Sukkur', 'Shell Kamoke', 'Attock Pump Okara', 'PSO Moro'];

/** True when the khata has no records yet (settings alone do not count). */
export async function isEmpty(db: Db): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM ada_entries) + (SELECT COUNT(*) FROM trip_legs) + (SELECT COUNT(*) FROM bills) + (SELECT COUNT(*) FROM insurance) + (SELECT COUNT(*) FROM parties) AS n`,
  );
  return (row?.n ?? 0) === 0;
}

/** Removes every record but keeps the company details and preferences. */
export async function clearRecords(db: Db): Promise<void> {
  await db.tx(async () => {
    await db.exec('PRAGMA defer_foreign_keys = ON');
    for (const table of [...userTables].reverse()) if (table !== 'settings') await db.run(`DELETE FROM ${table}`);
  });
}

export async function loadSampleData(db: Db): Promise<void> {
  const rand = seeded(7751);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

  if (!(await getSetting(db, 'company_name'))) {
    await setSetting(db, 'company_name', 'Al Madina Goods Transport');
    await setSetting(db, 'company_phone', '0300 1234567');
    await setSetting(db, 'company_address', 'Truck Adda, Band Road, Lahore');
  }
  for (const [i, name] of brokers.entries()) await saveParty(db, { name, phone: `03${i}${i + 1} ${5500000 + i * 13579}`.slice(0, 12) });

  const start = addDays(today(), -175);
  let caseNo = 1101;
  let day = start;
  let n = 0;
  // Trips leave every few days, rotating through the trucks, up to a few days ago.
  while (day <= addDays(today(), -2)) {
    const truck = trucks[n % trucks.length];
    const [from, to] = pick(routes);
    const broker = pick(brokers);
    const no = `TK-${caseNo++}`;
    const back = addDays(day, Math.round(between(4, 8)));
    const outTons = Math.round(between(38, 60));
    const retTons = Math.round(between(20, 34));
    const market = rs(Math.round(between(380, 560)) * 1000);
    const returnFreight = rs(Math.round(between(70, 140)) * 1000);
    const commission = rand() < 0.6 ? rs(Math.round(between(2, 6)) * 1000) : 0;
    const paidAll = rand() < 0.55;
    const unloadDelay = rand() < 0.2 ? Math.round(between(1, 3)) : null;

    const net = market - commission;
    const advance = rand() < 0.6 ? rs(Math.round(between(80, 150)) * 1000) : 0;
    const outId = await createAda(db, {
      caseNo: no, direction: 'outward', entryDate: day, vehicle: truck, weight: `${outTons} ton`, fromPlace: from, toPlace: to, partyName: broker,
      freightRate: market, commissionType: 'fixed', commissionValue: commission,
      mtAmount: rand() < 0.15 ? rs(2500) : 0, mtMode: 'add', dihariDays: unloadDelay, dihariRate: unloadDelay ? rs(3000) : null, dihariMode: 'add',
      received: 0,
    });
    // Brokers pay in parts: an advance at loading, then the rest after delivery.
    if (advance) await addReceipt(db, outId, advance, day, 'Advance at loading, cash');
    const rest = net - advance;
    const paidOn = addDays(day, Math.round(between(5, 14)));
    if (paidOn <= today()) {
      if (paidAll) {
        await addReceipt(db, outId, rest, paidOn, pick(['Bank transfer, HBL', 'Cheque cleared, MCB', 'Cash at adda', 'Easypaisa transfer']));
      } else if (rand() < 0.5) {
        await addReceipt(db, outId, Math.round(rest * between(0.3, 0.6) / 100000) * 100000, paidOn, pick(['Part payment, cash', 'Part payment, bank transfer']));
      }
    }
    const complete = back <= addDays(today(), -4) && rand() < 0.88;
    const hasReturn = back <= today() && rand() < 0.94;
    if (hasReturn) {
      const retCommission = rand() < 0.3 ? rs(1500) : 0;
      const retId = await createAda(db, {
        caseNo: no, direction: 'return', entryDate: back, vehicle: truck, weight: `${retTons} ton`, fromPlace: to, toPlace: from,
        partyName: rand() < 0.7 ? broker : pick(brokers),
        freightRate: returnFreight, commissionType: 'fixed', commissionValue: retCommission,
        mtAmount: 0, mtMode: 'add', dihariDays: null, dihariRate: null, dihariMode: 'add',
        received: 0,
      });
      if (rand() < 0.6) await addReceipt(db, retId, returnFreight - retCommission, back, pick(['Cash on unloading', 'Paid by receiver, cash']));
    }
    const c = await findCaseByNo(db, no);
    if (c) {
      await saveLeg(db, { caseNo: no, direction: 'outward', date: day, vehicle: truck, fromPlace: from, toPlace: to, partyName: broker, weight: `${outTons} ton` });
      const litres = Math.round(between(850, 1250));
      const rate = Math.round(between(272, 292));
      await saveExpense(db, { caseId: c.id, category: 'Diesel', amount: rs(litres * 0.55 * rate), date: day, vendor: pick(stations), slipNo: String(4000 + n * 3), quantity: String(Math.round(litres * 0.55)) });
      await saveExpense(db, { caseId: c.id, category: 'Diesel', amount: rs(litres * 0.45 * rate), date: addDays(day, 2), vendor: pick(stations), slipNo: String(4001 + n * 3), quantity: String(Math.round(litres * 0.45)) });
      await saveExpense(db, { caseId: c.id, category: 'Peshgi', amount: rs(Math.round(between(60, 140)) * 1000), date: day, notes: 'Driver advance for the road' });
      await saveExpense(db, { caseId: c.id, category: 'Toll', amount: rs(Math.round(between(4, 9)) * 1000), date: day });
      await saveExpense(db, { caseId: c.id, category: 'Loading', amount: rs(Math.round(between(2, 5)) * 1000), date: day });
      if (rand() < 0.5) await saveExpense(db, { caseId: c.id, category: 'Unloading', amount: rs(Math.round(between(2, 4)) * 1000), date: addDays(day, 3) });
      if (rand() < 0.45) await saveExpense(db, { caseId: c.id, category: 'Oil', amount: rs(Math.round(between(12, 18)) * 1000), date: day, vendor: 'Shell Kamoke' });
      if (rand() < 0.4) await saveExpense(db, { caseId: c.id, category: 'Bilty', amount: rs(1500), date: day });
      if (rand() < 0.35) await saveExpense(db, { caseId: c.id, category: 'Broker', amount: rs(Math.round(between(3, 6)) * 1000), date: day });
      if (hasReturn) {
        await saveLeg(db, { caseNo: no, direction: 'return', date: back, vehicle: truck, fromPlace: to, toPlace: from, partyName: broker, weight: `${retTons} ton` });
        if (complete) {
          await markCaseComplete(db, c.id);
          // A confirmed profit belongs to the day the trip was closed.
          await db.run('UPDATE cases SET completed_at = ? WHERE id = ?', [`${addDays(back, 1)}T09:00:00.000Z`, c.id]);
        }
      }
    }
    day = addDays(day, Math.round(between(2, 5)));
    n++;
  }

  // Monthly running costs per truck, as the company writes them under its sheet.
  const now = parseISODate(today());
  for (let m = 5; m >= 0; m--) {
    const month = toISODate(new Date(now.getFullYear(), now.getMonth() - m, 1));
    const range = monthRange(month);
    const billDay = m === 0 ? addDays(today(), -1) : addDays(range.to as string, -1);
    for (const [i, truck] of trucks.entries()) {
      const lines = [{ description: 'Salary', amount: rs(60000) }, { description: 'Munshiyana', amount: rs(20000) }];
      if (i % 2 === 0) lines.push({ description: 'Trolley rent', amount: rs(35000) });
      await saveBill(db, { date: billDay, vendor: 'Monthly costs', vehicle: truck, paid: m === 0 ? 0 : lines.reduce((s, l) => s + l.amount, 0), countInProfit: false, lines });
    }
    if (rand() < 0.7) {
      await saveBill(db, { date: addDays(month, 9), vendor: 'Ittefaq Tyre House', vehicle: pick(trucks), paid: rs(24000), countInProfit: false,
        lines: [{ description: 'Tyre change, front', quantity: '2', unit: 'pcs', amount: rs(48000) }] });
    }
    if (rand() < 0.6) {
      await saveBill(db, { date: addDays(month, 15), vendor: 'Usman Auto Workshop', vehicle: pick(trucks), paid: 0, countInProfit: false,
        lines: [{ description: 'Spare parts, clutch plate', amount: rs(18500) }, { description: 'Labour', amount: rs(5000) }] });
    }
  }

  // Part payments from brokers, recorded the way the office does it.
  const parties = await db.all<{ id: string }>('SELECT id FROM parties ORDER BY name_key');
  await recordPartyPayment(db, { partyId: parties[1].id, amount: rs(40000), date: addDays(today(), -6), note: 'Cash at adda' });
  await recordPartyPayment(db, { partyId: parties[4].id, amount: rs(75000), date: addDays(today(), -3), note: 'Bank transfer' });

  const policy = (vehicle: string, category: string, policyNo: string, expiresIn: number) =>
    saveInsurance(db, { vehicle, category, policyNo, startDate: addDays(today(), expiresIn - 365), expiryDate: addDays(today(), expiresIn) });
  await policy('LES-4521', 'Comprehensive', 'EFU-55120', 14);
  await policy('TLR-882', 'Third party', 'JUB-90213', -9);
  await policy('LHR-7310', 'Comprehensive', 'ADM-77310', 212);
  await policy('FDA-219', 'Comprehensive', 'EFU-60219', 96);
  await policy('JT-7751', 'Goods in transit', 'TPL-77510', 27);
}
