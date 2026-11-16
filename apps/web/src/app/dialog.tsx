import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import { AppError } from '../core/db/core';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/shared/Toast';
import { useApp } from './context';
import { useMemo } from 'react';

export type AskAction<V extends string> = { label: string; value: V; tone?: 'primary' | 'danger' | 'plain' };
type Request = { title: string; message?: string; lines?: string[]; actions: AskAction<string>[]; resolve: (value: string | null) => void };

const useAskStore = create<{ request: Request | null; set: (r: Request | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

/** Promise-based questions: `await ask({...})` resolves with the chosen value, or null when closed. */
export function useDialog() {
  const set = useAskStore((s) => s.set);
  const toast = useToast();
  const { t } = useApp();
  return useMemo(() => {
    const ask = <V extends string>(r: { title: string; message?: string; lines?: string[]; actions: AskAction<V>[] }) =>
      new Promise<V | null>((resolve) => set({ ...r, resolve: resolve as (value: string | null) => void }));
    const confirm = async (title: string, message: string | undefined, okLabel: string, tone: 'primary' | 'danger' = 'primary', lines?: string[]) =>
      (await ask({ title, message, lines, actions: [{ label: t('actions.cancel'), value: 'no', tone: 'plain' }, { label: okLabel, value: 'yes', tone }] })) === 'yes';
    const showError = (error: unknown) => {
      if (!(error instanceof AppError)) console.error(error);
      toast.error(error instanceof AppError ? t(error.key) : t('errors.unknown'));
    };
    return { ask, confirm, showError, toast };
  }, [set, toast, t]);
}

export function DialogHost() {
  const { request, set } = useAskStore();
  if (!request) return null;
  const close = (value: string | null) => {
    request.resolve(value);
    set(null);
  };
  const tones = {
    primary: 'noir-cta text-white',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    plain: 'border border-line bg-surface hover:bg-surface-2 text-content',
  };
  return (
    <Modal open title={request.title} onClose={() => close(null)} size="md"
      footer={request.actions.map((a) => (
        <button key={a.value} type="button" onClick={() => close(a.value)}
          className={`h-10 px-4 rounded-full text-[14px] font-medium transition-colors ${tones[a.tone ?? 'plain']}`}>
          {a.label}
        </button>
      ))}>
      {request.message && <p className="text-[14px] text-content-muted leading-relaxed">{request.message}</p>}
      {request.lines && request.lines.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {request.lines.map((line) => (
            <li key={line} className="flex items-start gap-2 text-[13.5px] text-content">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />{line}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
