/** Dates are stored as local calendar days: YYYY-MM-DD. */
export function toISODate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export const today = () => toISODate(new Date());

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86400000);
}

/**
 * Calendar day of a stored value. Timestamps are UTC, so just after midnight in
 * Pakistan their first ten characters still name the previous day.
 */
export function localDay(value: string): string {
  return value.includes('T') ? toISODate(new Date(value)) : value.slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = localDay(value).split('-');
  return `${d}/${m}/${y}`;
}

export type DateRange = { from: string | null; to: string | null };

/** Week runs Monday to Sunday. */
export function weekRange(on: string): DateRange {
  const offset = (parseISODate(on).getDay() + 6) % 7;
  const from = addDays(on, -offset);
  return { from, to: addDays(from, 6) };
}

export function monthRange(on: string): DateRange {
  const date = parseISODate(on);
  return {
    from: toISODate(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function inRange(value: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!value) return false;
  const day = localDay(value);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}
