/**
 * Business decisions still waiting on the company owner (see plan section 6).
 * Each default lives here so an answer changes one line, not every screen.
 */
export const rules = {
  /**
   * Q9: the Revision Addendum sets cycle freight to outward net + return net, where net is
   * after commission with M.T. and Dihari applied. 'gross' uses the freight rate alone.
   */
  profitFreightBasis: 'net' as 'gross' | 'net',
  /** Q4: starting value for "Expiring soon"; the user can change it in Settings. */
  defaultReminderDays: 30,
  /** Q10: driver advance is shown on the trip but is not treated as an expense. */
  advanceCountsAsExpense: false,
};
