/** All money is held as whole paisa (integers) so totals never drift. */
export type Paisa = number;

export function parseMoney(input: string | number | null | undefined): Paisa | null {
  if (input === null || input === undefined) return null;
  const text = String(input).replace(/[,\s]/g, '').replace(/^(rs\.?|pkr)/i, '');
  if (text === '') return null;
  if (!/^\d*(\.\d{0,2})?$/.test(text) || text === '.') return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Plain number for an input box, e.g. 120050 -> "1200.50". */
export function moneyToInput(value: Paisa | null | undefined): string {
  if (value === null || value === undefined) return '';
  const whole = Math.trunc(value / 100);
  const fraction = Math.abs(value % 100);
  return fraction ? `${whole}.${String(fraction).padStart(2, '0')}` : String(whole);
}

export function formatPKR(value: Paisa | null | undefined): string {
  const amount = value ?? 0;
  const abs = Math.abs(amount);
  const fraction = abs % 100;
  const text = group(String(Math.trunc(abs / 100))) + (fraction ? `.${String(fraction).padStart(2, '0')}` : '');
  return `${amount < 0 ? '-' : ''}Rs ${text}`;
}

/** Percent held as hundredths of a percent: "2.5" -> 250. */
export function parsePercent(input: string): number | null {
  const paisa = parseMoney(input);
  return paisa === null || paisa > 10000 ? null : paisa;
}
