import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/core';
import { addReceipt, createAda, existingAdaForCaseNo, getAda, listAda, listReceipts, updateAda, type AdaInput } from '../src/repo/ada';
import { exportTables, parseBackup, restoreTables } from '../src/repo/backup';
import { getBill, listBills, saveBill } from '../src/repo/bills';
import { findCaseByNo, getCaseView, listCycles, markCaseComplete, ratePerUnit, reopenCase, saveExpense, saveLeg, sheetHeader, sheetTotals } from '../src/repo/cases';
import { caseSheetCsv } from '../src/print/csv';
import { translator } from '../src/i18n';
import { loadDashboard } from '../src/repo/dashboard';
import { listInsurance, saveInsurance } from '../src/repo/insurance';
import { findPossibleDoublePayment, listParties, partyAccount, recordPartyPayment, saveAdjustment, saveParty } from '../src/repo/parties';
import { buildReport } from '../src/repo/reports';
import { deleteImpact, historyFor, listTrash, purge, restore, searchCases, softDelete } from '../src/repo/trash';
import { addDays, today } from '../src/domain/dates';
import { testDb } from './helpers';

const ada = (over: Partial<AdaInput> = {}): AdaInput => ({
  caseNo: 'C-1', entryDate: '2026-10-05', vehicle: 'TLP-1234', fromPlace: 'Karachi', toPlace: 'Lahore',
  partyName: 'Ali Traders', freightRate: 10000000, commissionType: 'percent', commissionValue: 500, received: 2000000,
  direction: 'outward', mtAmount: 0, mtMode: 'add', dihariDays: null, dihariRate: null, dihariMode: 'add', ...over,
});

const leg = (direction: 'outward' | 'return', caseNo = 'C-1') =>
  ({ caseNo, direction, date: '2026-10-05', vehicle: 'TLP-1234', fromPlace: 'Karachi', toPlace: 'Lahore', partyName: 'Ali Traders' });

let db: Db;
beforeEach(async () => { db = await testDb(); });

describe('Ada Register', () => {
  it('calculates net and balance, and saves the first receipt', async () => {
    const id = await createAda(db, ada());
    const row = await getAda(db, id);
    expect(row).toMatchObject({ commission: 500000, net: 9500000, received: 2000000, balance: 7500000, case_no: 'C-1' });
  });
  it('requires a Case # and rejects commission above freight', async () => {
    await expect(createAda(db, ada({ caseNo: ' - ' }))).rejects.toMatchObject({ key: 'errors.caseRequired' });
    await expect(createAda(db, ada({ commissionType: 'fixed', commissionValue: 20000000 }))).rejects.toMatchObject({ key: 'errors.commissionTooHigh' });
  });
  it('finds an existing entry whichever way the Case # is typed', async () => {
    await createAda(db, ada({ caseNo: 'C-1' }));
    expect(await existingAdaForCaseNo(db, 'c 1', 'outward')).toHaveLength(1);
    expect(await existingAdaForCaseNo(db, 'c 1', 'return')).toHaveLength(0);
    expect(await existingAdaForCaseNo(db, 'C-2', 'outward')).toHaveLength(0);
  });
  it('searches by case, vehicle and party, and filters by date', async () => {
    await createAda(db, ada());
    await createAda(db, ada({ caseNo: 'C-2', vehicle: 'ABC-9', partyName: 'Bilal', entryDate: '2026-09-01' }));
    expect((await listAda(db, { search: 'c1' })).map((a) => a.case_no)).toEqual(['C-1']);
    expect((await listAda(db, { search: 'abc 9' })).map((a) => a.case_no)).toEqual(['C-2']);
    expect((await listAda(db, { search: 'bila' })).map((a) => a.case_no)).toEqual(['C-2']);
    expect((await listAda(db, { range: { from: '2026-10-01', to: '2026-10-31' } })).map((a) => a.case_no)).toEqual(['C-1']);
  });
  it('records edits in the history', async () => {
    const id = await createAda(db, ada());
    await updateAda(db, id, ada({ freightRate: 9000000 }));
    const edits = (await historyFor(db, id)).filter((h) => h.action === 'edited');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ field: 'freight_rate', old_value: '10000000', new_value: '9000000' });
  });
});

describe('Party account follows Ada Register', () => {
  it('updates when a linked entry is edited or a receipt is added', async () => {
    const id = await createAda(db, ada());
    const partyId = (await getAda(db, id))!.party_id!;
    expect((await partyAccount(db, partyId))!.party).toMatchObject({ received: 2000000, outstanding: 7500000 });
    await updateAda(db, id, ada({ freightRate: 20000000 }));
    expect((await partyAccount(db, partyId))!.party.outstanding).toBe(17000000);
    await addReceipt(db, id, 1000000, '2026-10-10');
    expect((await partyAccount(db, partyId))!.party).toMatchObject({ received: 3000000, outstanding: 16000000 });
  });
  it('reuses a party whatever the spacing or capitals', async () => {
    await createAda(db, ada({ partyName: 'Ali Traders' }));
    await createAda(db, ada({ caseNo: 'C-2', partyName: '  ali   TRADERS ' }));
    const parties = await listParties(db);
    expect(parties).toHaveLength(1);
    expect(parties[0].caseCount).toBe(2);
  });
  it('keeps manual entries separate from Ada values', async () => {
    const id = await createAda(db, ada());
    const row = (await getAda(db, id))!;
    await saveAdjustment(db, { partyId: row.party_id!, kind: 'payment', amount: 1000000, date: '2026-10-11', caseNo: 'C-1' });
    const account = (await partyAccount(db, row.party_id!))!;
    expect(account.party.outstanding).toBe(6500000);
    expect(account.manualPayments).toBe(1000000);
    expect((await getAda(db, id))!.balance).toBe(7500000);
    expect(account.ledger.find((e) => e.kind === 'payment')?.source).toBe('manual');
    expect(account.ledger.find((e) => e.kind === 'receipt')?.source).toBe('ada');
  });
  it('spots a likely double payment', async () => {
    await createAda(db, ada());
    expect(await findPossibleDoublePayment(db, 'C-1', 2000000)).toBe(true);
    expect(await findPossibleDoublePayment(db, 'C-1', 111)).toBe(false);
    expect(await findPossibleDoublePayment(db, undefined, 2000000)).toBe(false);
  });
  it('filters the ledger by entry type and Case #', async () => {
    const row = (await getAda(db, await createAda(db, ada())))!;
    await createAda(db, ada({ caseNo: 'C-2' }));
    const byCase = (await partyAccount(db, row.party_id!, { caseNo: 'C-2' }))!;
    expect(byCase.ledger.every((e) => e.caseNo === 'C-2')).toBe(true);
    const byKind = (await partyAccount(db, row.party_id!, { kind: 'receipt' }))!;
    expect(byKind.ledger.every((e) => e.kind === 'receipt')).toBe(true);
    expect(byKind.party.outstanding).toBe(15000000);
  });
  it('blocks a second party with the same name', async () => {
    await saveParty(db, { name: 'Ali' });
    await expect(saveParty(db, { name: ' ALI ' })).rejects.toMatchObject({ key: 'errors.partyExists' });
  });
});

describe('Trip cycle', () => {
  it('keeps profit provisional until both legs exist and the cycle is marked complete', async () => {
    const caseId = await saveLeg(db, { ...leg('outward'), cycleFreight: 5000000 });
    await saveExpense(db, { caseId, category: 'Diesel', amount: 1000000, date: '2026-10-06' });
    let view = (await getCaseView(db, caseId))!;
    expect(view.summary).toMatchObject({ status: 'return_pending', profit: 4000000, confirmed: false });
    await expect(markCaseComplete(db, caseId)).rejects.toMatchObject({ key: 'errors.needBothLegs' });
    await saveLeg(db, { ...leg('return') });
    expect((await getCaseView(db, caseId))!.summary).toMatchObject({ status: 'ready', confirmed: false });
    await markCaseComplete(db, caseId);
    view = (await getCaseView(db, caseId))!;
    expect(view.summary).toMatchObject({ status: 'complete', confirmed: true, profit: 4000000 });
    await reopenCase(db, caseId);
    expect((await getCaseView(db, caseId))!.summary.confirmed).toBe(false);
  });
  it('allows one leg per direction', async () => {
    await saveLeg(db, leg('outward'));
    await expect(saveLeg(db, leg('outward'))).rejects.toMatchObject({ key: 'errors.legExists' });
  });
  it('takes freight from Ada and warns if the trip says otherwise', async () => {
    await createAda(db, ada());
    const caseId = await saveLeg(db, { ...leg('outward'), cycleFreight: 5000000 });
    const view = (await getCaseView(db, caseId))!;
    // Net freight: 1,00,000 less 5% commission.
    expect(view.summary).toMatchObject({ freight: 9500000, freightMismatch: true });
  });
  it('recalculates a complete cycle when an expense is edited later', async () => {
    const caseId = await saveLeg(db, { ...leg('outward'), cycleFreight: 5000000 });
    await saveLeg(db, leg('return'));
    const expense = await saveExpense(db, { caseId, category: 'Toll', amount: 100000, date: '2026-10-06' });
    await markCaseComplete(db, caseId);
    await saveExpense(db, { caseId, category: 'Toll', amount: 200000, date: '2026-10-06' }, expense);
    expect((await getCaseView(db, caseId))!.summary).toMatchObject({ profit: 4800000, confirmed: true });
  });
  it('filters cycles', async () => {
    await saveLeg(db, leg('outward', 'C-1'));
    await saveLeg(db, { ...leg('outward', 'C-2'), vehicle: 'XYZ-1', toPlace: 'Quetta' });
    expect((await listCycles(db, { search: 'quetta' })).map((c) => c.caseNo)).toEqual(['C-2']);
    expect((await listCycles(db, { vehicle: 'xyz 1' })).map((c) => c.caseNo)).toEqual(['C-2']);
    expect(await listCycles(db, { status: 'complete' })).toHaveLength(0);
    expect(await listCycles(db, { direction: 'return' })).toHaveLength(0);
  });
});

describe('Bill Book', () => {
  const bill = { date: '2026-10-07', vendor: 'Rana Tyres', vehicle: 'TLP-1234', paid: 100000, countInProfit: false,
    lines: [{ description: 'Tyre', amount: 300000 }, { description: 'Puncture', amount: 50000 }] };
  it('totals lines and calculates balance', async () => {
    const id = await saveBill(db, bill);
    expect(await getBill(db, id)).toMatchObject({ total: 350000, balance: 250000 });
  });
  it('rejects bad entries', async () => {
    await expect(saveBill(db, { ...bill, paid: 999999 })).rejects.toMatchObject({ key: 'errors.paidTooHigh' });
    await expect(saveBill(db, { ...bill, lines: [] })).rejects.toMatchObject({ key: 'errors.lineRequired' });
    await expect(saveBill(db, { ...bill, countInProfit: true })).rejects.toMatchObject({ key: 'errors.countNeedsCase' });
  });
  it('reaches trip profit only when linked and confirmed', async () => {
    const caseId = await saveLeg(db, { ...leg('outward'), cycleFreight: 1000000 });
    const id = await saveBill(db, { ...bill, caseNo: 'C-1' });
    expect((await getCaseView(db, caseId))!.summary.totalExpenses).toBe(0);
    await saveBill(db, { ...bill, caseNo: 'C-1', countInProfit: true }, id);
    expect((await getCaseView(db, caseId))!.summary.totalExpenses).toBe(350000);
  });
  it('replaces lines on edit and filters by paid status', async () => {
    const id = await saveBill(db, bill);
    await saveBill(db, { ...bill, paid: 100000, lines: [{ description: 'Oil', amount: 100000 }] }, id);
    const saved = (await getBill(db, id))!;
    expect(saved.lines).toHaveLength(1);
    expect(saved.balance).toBe(0);
    expect(await listBills(db, { paid: 'unpaid' })).toHaveLength(0);
    expect(await listBills(db, { paid: 'paid', vendor: 'rana' })).toHaveLength(1);
  });
});

describe('Insurance', () => {
  it('derives status from the reminder setting', async () => {
    await saveInsurance(db, { vehicle: 'A-1', expiryDate: addDays(today(), 400) });
    await saveInsurance(db, { vehicle: 'A-2', expiryDate: addDays(today(), 5) });
    await saveInsurance(db, { vehicle: 'A-3', expiryDate: addDays(today(), -1) });
    expect((await listInsurance(db)).map((i) => i.status).sort()).toEqual(['active', 'expired', 'expiring']);
    expect(await listInsurance(db, { search: 'a 2' })).toHaveLength(1);
    expect((await loadDashboard(db)).insuranceDue).toBe(2);
  });
  it('rejects a start date after expiry', async () => {
    await expect(saveInsurance(db, { vehicle: 'A', expiryDate: '2026-01-01', startDate: '2026-02-01' })).rejects.toMatchObject({ key: 'errors.startAfterExpiry' });
  });
});

describe('Recycle Bin', () => {
  it('removes a deleted Ada entry from party totals, and restore brings it back', async () => {
    const id = await createAda(db, ada());
    const partyId = (await getAda(db, id))!.party_id!;
    await softDelete(db, 'ada_entries', id);
    expect((await partyAccount(db, partyId))!.party.outstanding).toBe(0);
    expect(await listAda(db)).toHaveLength(0);
    expect(await listTrash(db)).toHaveLength(1);
    await restore(db, 'ada_entries', id);
    expect((await partyAccount(db, partyId))!.party.outstanding).toBe(7500000);
    expect(await listTrash(db)).toHaveLength(0);
  });
  it('explains the effect of deleting a linked record', async () => {
    const id = await createAda(db, ada());
    const keys = (await deleteImpact(db, 'ada_entries', id)).map((i) => i.key);
    expect(keys).toContain('impact.adaParty');
    expect(keys).toContain('impact.adaReceipts');
  });
  it('sends a complete cycle back to provisional when a leg is deleted', async () => {
    const caseId = await saveLeg(db, leg('outward'));
    await saveLeg(db, leg('return'));
    await markCaseComplete(db, caseId);
    const legId = (await getCaseView(db, caseId))!.returnLeg!.id;
    expect((await deleteImpact(db, 'trip_legs', legId)).map((i) => i.key)).toContain('impact.legComplete');
    await softDelete(db, 'trip_legs', legId);
    expect((await getCaseView(db, caseId))!.summary).toMatchObject({ status: 'return_pending', confirmed: false });
  });
  it('refuses to restore a leg when a new one replaced it', async () => {
    const caseId = await saveLeg(db, leg('outward'));
    const first = (await getCaseView(db, caseId))!.outward!.id;
    await softDelete(db, 'trip_legs', first);
    await saveLeg(db, leg('outward'));
    await expect(restore(db, 'trip_legs', first)).rejects.toMatchObject({ key: 'errors.restoreLegClash' });
  });
  it('permanently deletes only what is in the bin, with its child records', async () => {
    const id = await createAda(db, ada());
    await purge(db, 'ada_entries', id);
    expect(await getAda(db, id)).not.toBeNull();
    await softDelete(db, 'ada_entries', id);
    await purge(db, 'ada_entries', id);
    expect(await getAda(db, id)).toBeNull();
    expect(await db.all('SELECT * FROM ada_receipts')).toHaveLength(0);
  });
  it('keeps linked entries when a party is permanently deleted', async () => {
    const id = await createAda(db, ada());
    const partyId = (await getAda(db, id))!.party_id!;
    await softDelete(db, 'parties', partyId);
    await purge(db, 'parties', partyId);
    expect(await getAda(db, id)).toMatchObject({ party_id: null, net: 9500000 });
  });
});

describe('Search and dashboard', () => {
  it('finds a case and which records it links', async () => {
    await createAda(db, ada({ caseNo: 'K-77' }));
    await saveLeg(db, leg('outward', 'K-77'));
    await createAda(db, ada({ caseNo: 'K-78' }));
    const hits = await searchCases(db, 'k 77');
    expect(hits).toEqual([expect.objectContaining({ caseNo: 'K-77', hasAda: true, hasTrip: true })]);
    expect(await searchCases(db, 'K-7')).toHaveLength(2);
    expect(await searchCases(db, '')).toHaveLength(0);
  });
  it('hides cases whose records are all deleted', async () => {
    const id = await createAda(db, ada({ caseNo: 'Z-1' }));
    await softDelete(db, 'ada_entries', id);
    expect(await searchCases(db, 'Z-1')).toHaveLength(0);
    expect(await findCaseByNo(db, 'Z-1')).not.toBeNull();
  });
});

describe('Reports', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  it('separates confirmed from provisional profit', async () => {
    const done = await saveLeg(db, { ...leg('outward', 'C-1'), cycleFreight: 1000000 });
    await saveLeg(db, leg('return', 'C-1'));
    await markCaseComplete(db, done);
    await saveLeg(db, { ...leg('outward', 'C-2'), cycleFreight: 500000 });
    const wide = { from: '2026-01-01', to: '2027-12-31' };
    const all = await buildReport(db, 'cycles', { range: wide });
    expect(all.totals.find((t) => t.label === 'report.confirmedProfit')?.value).toBe(1000000);
    expect(all.totals.find((t) => t.label === 'report.provisionalProfit')?.value).toBe(500000);
    expect((await buildReport(db, 'confirmed', { range: wide })).rows).toHaveLength(1);
    expect((await buildReport(db, 'provisional', { range: wide })).rows.map((r) => r.caseNo)).toEqual(['C-2']);
  });
  it('report totals match the rows after an edit', async () => {
    const id = await createAda(db, ada());
    await updateAda(db, id, ada({ freightRate: 20000000 }));
    const report = await buildReport(db, 'ada', { range });
    expect(report.totals.find((t) => t.label === 'fields.balance')?.value).toBe(report.rows[0].balance);
    expect(report.rows[0].balance).toBe(17000000);
  });
  it('applies filters to each report', async () => {
    await createAda(db, ada());
    await createAda(db, ada({ caseNo: 'C-2', vehicle: 'B-2' }));
    await saveBill(db, { date: '2026-10-07', vendor: 'V', vehicle: 'B-2', paid: 0, countInProfit: false, lines: [{ description: 'x', amount: 500 }] });
    expect((await buildReport(db, 'ada', { range, vehicle: 'B 2' })).rows).toHaveLength(1);
    expect((await buildReport(db, 'bills', { range, vehicle: 'B 2' })).rows).toHaveLength(1);
    expect((await buildReport(db, 'party', { range, caseNo: 'C-2' })).rows.every((r) => r.caseNo === 'C-2')).toBe(true);
    expect((await buildReport(db, 'ada', { range: { from: '2020-01-01', to: '2020-01-31' } })).rows).toHaveLength(0);
  });
});

describe('Backup', () => {
  it('restores everything exactly', async () => {
    const id = await createAda(db, ada());
    await saveLeg(db, leg('outward'));
    await saveBill(db, { date: '2026-10-07', vendor: 'V', paid: 0, countInProfit: false, lines: [{ description: 'x', amount: 500 }] });
    await saveAdjustment(db, { partyId: (await getAda(db, id))!.party_id!, kind: 'payment', amount: 100, date: '2026-10-11' });
    const backup = JSON.stringify(await exportTables(db));

    const fresh = await testDb();
    await restoreTables(fresh, parseBackup(backup));
    expect((await exportTables(fresh)).tables).toEqual(JSON.parse(backup).tables);
  });
  it('replaces existing data on restore, and enforces links afterwards', async () => {
    const backup = parseBackup(JSON.stringify(await exportTables(db)));
    await createAda(db, ada());
    await restoreTables(db, backup);
    expect(await listAda(db)).toHaveLength(0);
    await expect(db.run(`INSERT INTO ada_receipts (id, created_at, updated_at, ada_id, receipt_date, amount) VALUES ('x','a','a','missing','d',1)`)).rejects.toThrow();
  });
  it('rejects a damaged or newer file and leaves data alone', async () => {
    expect(() => parseBackup('not json')).toThrow();
    expect(() => parseBackup('{"app":"other"}')).toThrow();
    const good = await exportTables(db);
    expect(() => parseBackup(JSON.stringify({ ...good, schema: 999 }))).toThrow();
    const missing = { ...good, tables: { ...good.tables, bills: undefined } };
    expect(() => parseBackup(JSON.stringify(missing))).toThrow();
  });
  it('rolls back when a restore fails partway', async () => {
    await createAda(db, ada());
    const bad = await exportTables(db);
    bad.tables.ada_entries = [{ id: 'broken' }];
    await expect(restoreTables(db, bad)).rejects.toThrow();
    expect(await listAda(db)).toHaveLength(1);
  });
});

describe('Revision Addendum acceptance', () => {
  const partyId = async () => (await listParties(db))[0].id;

  it('shows a Rs 5,000 balance in Ada Register and the broker account for Rs 35,000 freight with Rs 30,000 received', async () => {
    const id = await createAda(db, ada({ caseNo: '1001', freightRate: 3500000, commissionValue: 0, received: 3000000 }));
    expect(await getAda(db, id)).toMatchObject({ due: 3500000, received: 3000000, balance: 500000 });
    const account = (await partyAccount(db, await partyId()))!;
    expect(account.party).toMatchObject({ freight: 3500000, received: 3000000, outstanding: 500000 });
    expect(account.ada.map((a) => [a.case_no, a.balance])).toEqual([['1001', 500000]]);
  });

  it('settles the balance once when the broker pays the rest against the Case #', async () => {
    const id = await createAda(db, ada({ caseNo: '1001', freightRate: 3500000, commissionValue: 0, received: 3000000 }));
    const result = await recordPartyPayment(db, { partyId: await partyId(), amount: 500000, date: '2026-10-10', caseNo: '1001' });
    expect(result).toEqual({ linked: true, caseNo: '1001' });
    expect(await getAda(db, id)).toMatchObject({ received: 3500000, balance: 0 });
    const account = (await partyAccount(db, await partyId()))!;
    expect(account.party.outstanding).toBe(0);
    expect(account.manualPayments).toBe(0);
  });

  it('keeps a payment without a matching Case # as a manual entry', async () => {
    await createAda(db, ada({ caseNo: '1001', freightRate: 3500000, commissionValue: 0, received: 3000000 }));
    const result = await recordPartyPayment(db, { partyId: await partyId(), amount: 100000, date: '2026-10-10' });
    expect(result.linked).toBe(false);
    expect((await partyAccount(db, await partyId()))!.party.outstanding).toBe(400000);
  });

  it('fills the outward and return files in order when one payment covers both', async () => {
    const out = await createAda(db, ada({ caseNo: '1001', freightRate: 3500000, commissionValue: 0, received: 0 }));
    const back = await createAda(db, ada({ caseNo: '1001', direction: 'return', entryDate: '2026-10-08', freightRate: 1000000, commissionValue: 0, received: 0 }));
    await recordPartyPayment(db, { partyId: await partyId(), amount: 4000000, date: '2026-10-10', caseNo: '1001' });
    expect((await getAda(db, out))!.balance).toBe(0);
    expect((await getAda(db, back))!.balance).toBe(500000);
  });

  it('saves edits to an existing entry and the broker balance follows', async () => {
    const id = await createAda(db, ada({ caseNo: '1001', freightRate: 3500000, commissionValue: 0, received: 3000000 }));
    await updateAda(db, id, ada({ caseNo: '1001', freightRate: 4000000, commissionValue: 0, mtAmount: 100000, dihariDays: 2, dihariRate: 50000, received: 3500000 }));
    expect(await getAda(db, id)).toMatchObject({ freight_rate: 4000000, due: 4200000, received: 3500000, balance: 700000 });
    expect(await listReceipts(db, id)).toHaveLength(1);
    expect((await partyAccount(db, await partyId()))!.party.outstanding).toBe(700000);
  });

  it('only edits Received directly while the entry has one receipt', async () => {
    const id = await createAda(db, ada({ received: 1000000 }));
    await updateAda(db, id, ada({ received: 0 }));
    expect(await getAda(db, id)).toMatchObject({ received: 0, receipt_count: 0 });
    await addReceipt(db, id, 1000000);
    await addReceipt(db, id, 500000);
    await updateAda(db, id, ada({ received: 1500000, freightRate: 9000000 }));
    await expect(updateAda(db, id, ada({ received: 100 }))).rejects.toMatchObject({ key: 'errors.severalReceipts' });
  });

  it('combines outward and return net freight, provisional until the cycle is completed', async () => {
    await createAda(db, ada({ caseNo: 'JT-7751', vehicle: 'JT-7751', weight: '46 ton', freightRate: 46000000, commissionValue: 0, received: 0 }));
    const found = (await findCaseByNo(db, 'JT-7751'))!;
    await saveExpense(db, { caseId: found.id, category: 'Diesel', amount: 27939000, date: '2026-10-06', vendor: 'Syed Petroleum', quantity: '1005', slipNo: '14' });
    let view = (await getCaseView(db, found.id))!;
    expect(view.summary).toMatchObject({ status: 'return_pending', confirmed: false, freight: 46000000 });
    await expect(markCaseComplete(db, found.id)).rejects.toMatchObject({ key: 'errors.needBothLegs' });

    await createAda(db, ada({ caseNo: 'JT-7751', direction: 'return', weight: '30 ton', freightRate: 13000000, commissionValue: 0, received: 0 }));
    view = (await getCaseView(db, found.id))!;
    expect(view.summary).toMatchObject({ status: 'ready', freight: 59000000, totalExpenses: 27939000, profit: 31061000, confirmed: false });
    expect(sheetHeader(view)).toMatchObject({ vehicle: 'JT-7751', market: { weight: '46 ton', freight: 46000000 }, returnLoad: { weight: '30 ton', freight: 13000000 } });
    expect(ratePerUnit(view.expenses[0].amount, view.expenses[0].quantity)).toBe(27800);
    expect(view.expenses[0]).toMatchObject({ slip_no: '14', quantity: '1005', vendor: 'Syed Petroleum' });

    await markCaseComplete(db, found.id);
    expect((await getCaseView(db, found.id))!.summary).toMatchObject({ status: 'complete', confirmed: true, profit: 31061000 });
    expect((await listCycles(db, { search: 'JT-7751' })).map((c) => c.caseNo)).toEqual(['JT-7751']);
  });

  it('filters Ada Register by trip direction', async () => {
    await createAda(db, ada({ caseNo: '1001' }));
    await createAda(db, ada({ caseNo: '1001', direction: 'return' }));
    expect((await listAda(db, { direction: 'return' })).map((a) => a.direction)).toEqual(['return']);
  });
});

describe('Latest changes (owner feedback)', () => {
  const sheetCase = async () => {
    await createAda(db, ada({ caseNo: 'JT-7751', vehicle: 'JT-7751', weight: '46 ton', toPlace: 'Gujranwala', freightRate: 46000000, commissionValue: 0, received: 20000000 }));
    await createAda(db, ada({ caseNo: 'JT-7751', vehicle: 'JT-7751', direction: 'return', entryDate: '2026-10-09', weight: '30 ton', freightRate: 13000000, commissionType: 'fixed', commissionValue: 100000, received: 0 }));
    const found = (await findCaseByNo(db, 'JT-7751'))!;
    await saveExpense(db, { caseId: found.id, category: 'Diesel', amount: 27939000, date: '2026-10-06', quantity: '1005' });
    await saveExpense(db, { caseId: found.id, category: 'آئل', amount: 1450000, date: '2026-10-06' });
    await saveExpense(db, { caseId: found.id, category: 'Peshgi', amount: 13500000, date: '2026-10-06' });
    return found.id;
  };

  it('adds outward and return freight, takes off all expenses, and shows the broker balance', async () => {
    const view = (await getCaseView(db, await sheetCase()))!;
    expect(sheetTotals(view)).toEqual({
      outwardFreight: 46000000, returnFreight: 12900000, freight: 58900000, expenses: 42889000, profit: 16011000,
      received: 20000000, balance: 38900000,
    });
  });

  it('exports the trip sheet for Excel with expenses, freight and profit', async () => {
    const csv = caseSheetCsv((await getCaseView(db, await sheetCase()))!, translator('en'));
    expect(csv).toContain('Diesel,,,1005,279390.00,278.00');
    expect(csv).toContain('Freight (outward + return),,,,589000.00');
    expect(csv).toContain('Net profit,,,,160110.00');
  });

  it('builds the monthly vehicle report with diesel and oil apart, and Bill Book costs taken off', async () => {
    await sheetCase();
    await saveBill(db, { date: '2026-10-20', vendor: 'Office', vehicle: 'JT-7751', paid: 0, countInProfit: false,
      lines: [{ description: 'Salary', amount: 6000000 }, { description: 'Trali rent', amount: 3500000 }] });
    const report = await buildReport(db, 'vehicle', { range: { from: '2026-10-01', to: '2026-10-31' }, vehicle: 'JT 7751' });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ market: 46000000, returnFreight: 12900000, returnCommission: 100000, litres: '1005', diesel: 27939000, oil: 1450000, tripExp: 13500000, profit: 16011000 });
    expect(report.totals.find((x) => x.text === 'Salary')?.value).toBe(-6000000);
    expect(report.totals.at(-1)).toMatchObject({ label: 'report.bachat', value: 16011000 - 9500000 });
  });

  it('counts a Dihari amount even when the days are left blank', async () => {
    const id = await createAda(db, ada({ freightRate: 1000000, commissionValue: 0, received: 0, dihariDays: null, dihariRate: 50000 }));
    expect(await getAda(db, id)).toMatchObject({ dihari_total: 50000, due: 1050000 });
  });

  it('keeps the old Market and insurance company when an edit no longer sends them', async () => {
    const id = await createAda(db, ada({ market: 'Sabzi Mandi' }));
    await updateAda(db, id, ada({ freightRate: 9000000 }));
    expect((await getAda(db, id))!.market).toBe('Sabzi Mandi');
    const ins = await saveInsurance(db, { vehicle: 'JT-1', company: 'EFU', expiryDate: '2027-01-01' });
    await saveInsurance(db, { vehicle: 'JT-1', expiryDate: '2027-02-01' }, ins);
    expect((await listInsurance(db))[0]).toMatchObject({ company: 'EFU', expiry_date: '2027-02-01' });
  });
});
