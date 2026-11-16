import { daysBetween } from './dates';
import type { Paisa } from './money';
import { rules } from './rules';

/** Every money formula in the app lives in this file. */
export type CommissionType = 'fixed' | 'percent';

export type Direction = 'outward' | 'return';

export function commissionAmount(freight: Paisa, type: CommissionType, value: number): Paisa {
  return type === 'percent' ? Math.round((freight * value) / 10000) : value;
}

export function freightAfterCommission(freight: Paisa, type: CommissionType, value: number): Paisa {
  return freight - commissionAmount(freight, type, value);
}

/** M.T. and Dihari can be money the broker pays on top (add) or money taken off (deduct). */
export type AdjustMode = 'add' | 'deduct';

export const signed = (amount: Paisa, mode: AdjustMode): Paisa => (mode === 'deduct' ? -amount : amount);

/**
 * Dihari is days of unloading delay times the agreed amount per day.
 * With the days left blank, the amount is taken as the whole Dihari, so it is never silently dropped.
 */
export function dihariAmount(days: number | null, perDay: Paisa | null): Paisa {
  if (days === null) return perDay ?? 0;
  return days * (perDay ?? 0);
}

export type AdaAmounts = {
  freight: Paisa; commissionType: CommissionType; commissionValue: number;
  mt: Paisa; mtMode: AdjustMode; dihari: Paisa; dihariMode: AdjustMode; received: Paisa;
};

/** Freight after commission, then M.T. and Dihari in their chosen direction, then what is still owed. */
export function adaAmounts(a: AdaAmounts) {
  const commission = commissionAmount(a.freight, a.commissionType, a.commissionValue);
  const net = a.freight - commission;
  const due = net + signed(a.mt, a.mtMode) + signed(a.dihari, a.dihariMode);
  return { commission, net, due, balance: balance(due, a.received) };
}

export function balance(amount: Paisa, paid: Paisa): Paisa {
  return amount - paid;
}

export const sum = (values: readonly (Paisa | null | undefined)[]): Paisa =>
  values.reduce<Paisa>((total, v) => total + (v ?? 0), 0);

/** A manual payment reduces what a party owes; a charge increases it. */
export function partyOutstanding(adaBalances: readonly Paisa[], manualPayments: Paisa, manualCharges: Paisa): Paisa {
  return sum(adaBalances) - manualPayments + manualCharges;
}

export type CycleStatus = 'outward_pending' | 'return_pending' | 'ready' | 'complete';

export function cycleStatus(hasOutward: boolean, hasReturn: boolean, completedAt: string | null): CycleStatus {
  if (!hasOutward) return 'outward_pending';
  if (!hasReturn) return 'return_pending';
  return completedAt ? 'complete' : 'ready';
}

export type CycleInput = {
  /** net is the full amount due on the entry: after commission, with M.T. and Dihari. */
  adaEntries: readonly { freight: Paisa; net: Paisa }[];
  cycleFreight: Paisa | null;
  expenses: readonly Paisa[];
  countedBills: readonly Paisa[];
  hasOutward: boolean;
  hasReturn: boolean;
  completedAt: string | null;
};

export type CycleSummary = {
  freight: Paisa;
  freightMismatch: boolean;
  totalExpenses: Paisa;
  profit: Paisa;
  status: CycleStatus;
  confirmed: boolean;
};

/** Freight comes from Ada when an entry exists, otherwise from the trip. */
export function cycleSummary(input: CycleInput): CycleSummary {
  const hasAda = input.adaEntries.length > 0;
  const adaFreight = sum(input.adaEntries.map((e) => (rules.profitFreightBasis === 'net' ? e.net : e.freight)));
  const adaGross = sum(input.adaEntries.map((e) => e.freight));
  const freight = hasAda ? adaFreight : input.cycleFreight ?? 0;
  const totalExpenses = sum(input.expenses) + sum(input.countedBills);
  const status = cycleStatus(input.hasOutward, input.hasReturn, input.completedAt);
  return {
    freight,
    freightMismatch: hasAda && input.cycleFreight !== null && input.cycleFreight !== adaGross,
    totalExpenses,
    profit: freight - totalExpenses,
    status,
    confirmed: status === 'complete',
  };
}

export type InsuranceStatus = 'active' | 'expiring' | 'expired';

export function insuranceStatus(expiry: string, onDay: string, reminderDays: number): InsuranceStatus {
  const left = daysBetween(onDay, expiry);
  if (left < 0) return 'expired';
  return left <= reminderDays ? 'expiring' : 'active';
}
