import { useCallback, useState } from 'react';
import { AppError } from '../core/db/core';
import { parseMoney } from '../core/domain/money';
import { useApp } from './context';
import { useDialog } from './dialog';

export function useForm<F extends Record<string, unknown>>(initial: F) {
  const [values, setValues] = useState<F>(initial);
  const set = useCallback(<K extends keyof F>(key: K) => (value: F[K]) => setValues((v) => ({ ...v, [key]: value })), []);
  return { values, set, setValues };
}

/** Runs a save or delete, refreshes every list, and shows a plain message if it fails. */
export function useAction() {
  const { showError } = useDialog();
  const { changed } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      changed();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }, [showError, changed]);
  return { busy, run };
}

/** Blank counts as zero; anything unreadable is an error rather than a silent zero. */
export function moneyOrZero(text: string): number {
  if (text.trim() === '') return 0;
  const value = parseMoney(text);
  if (value === null) throw new AppError('errors.invalidAmount');
  return value;
}

export function moneyOrNull(text: string): number | null {
  if (text.trim() === '') return null;
  return moneyOrZero(text);
}
