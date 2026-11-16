import { beforeAll, describe, expect, it } from 'vitest';

// Must be set before any Date is read: this is the timezone the app runs in.
beforeAll(() => { process.env.TZ = 'Asia/Karachi'; });

describe('timestamps in Pakistan time', async () => {
  const { formatDate, inRange, localDay, monthRange } = await import('../src/core/domain/dates');
  const justAfterMidnight = '2026-10-31T19:30:00.000Z'; // 00:30 on 1 November in Karachi

  it('belongs to the local day, not the UTC day', () => {
    expect(localDay(justAfterMidnight)).toBe('2026-11-01');
    expect(formatDate(justAfterMidnight)).toBe('01/11/2026');
  });
  it('counts in the correct month', () => {
    expect(inRange(justAfterMidnight, monthRange('2026-11-15'))).toBe(true);
    expect(inRange(justAfterMidnight, monthRange('2026-10-15'))).toBe(false);
  });
  it('leaves plain dates alone', () => {
    expect(localDay('2026-11-01')).toBe('2026-11-01');
    expect(formatDate('2026-11-01')).toBe('01/11/2026');
  });
});
