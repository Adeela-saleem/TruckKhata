import { sum } from '../domain/calc';
import { monthRange, today } from '../domain/dates';
import type { Db } from '../db/core';
import { listCycles } from './cases';
import { listInsurance } from './insurance';
import { listParties } from './parties';

export type Dashboard = {
  insuranceDue: number;
  /** Profit of trips dated this month, confirmed and provisional together. */
  monthProfit: number;
  monthTrips: number;
  /** What all active brokers and parties still owe today. */
  outstanding: number;
};

export async function loadDashboard(db: Db): Promise<Dashboard> {
  const [insurance, cycles, parties] = await Promise.all([
    listInsurance(db),
    listCycles(db, { range: monthRange(today()) }),
    listParties(db),
  ]);
  return {
    insuranceDue: insurance.filter((i) => i.status !== 'active').length,
    monthProfit: sum(cycles.map((c) => c.summary.profit)),
    monthTrips: cycles.length,
    outstanding: sum(parties.map((p) => p.outstanding)),
  };
}
