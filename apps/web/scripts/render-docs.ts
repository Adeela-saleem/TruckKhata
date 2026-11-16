/** Dev helper: renders sample print documents from a database file to HTML, for checking layouts. */
import { readFileSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { Db } from '../src/core/db/core';
import { sqljsRaw } from '../src/core/db/sqljs';
import { translator } from '../src/core/i18n';
import { caseDocument } from '../src/core/print/documents';
import { reportToDocument, renderDocument } from '../src/core/print/html';
import { findCaseByNo, getCaseView } from '../src/core/repo/cases';
import { buildReport } from '../src/core/repo/reports';
import { getCompany } from '../src/core/repo/settings';
import { monthRange, today } from '../src/core/domain/dates';

const [dbPath, outDir] = process.argv.slice(-2);
const SQL = await initSqlJs();
const db = new Db(sqljsRaw(new SQL.Database(readFileSync(dbPath))));
const t = translator('en');
const company = await getCompany(db);
const c = (await findCaseByNo(db, 'TK-1202'))!;
writeFileSync(`${outDir}/trip-sheet.html`, renderDocument(caseDocument((await getCaseView(db, c.id))!, t), company, 'en', t));
const range = monthRange('2026-10-15');
const report = await buildReport(db, 'vehicle', { range, vehicle: 'LES-4521' });
writeFileSync(`${outDir}/monthly.html`, renderDocument(reportToDocument(report, t('report.vehicle'), 'October 2026  |  V#: LES-4521', t), company, 'en', t));
console.log('rendered', today());
