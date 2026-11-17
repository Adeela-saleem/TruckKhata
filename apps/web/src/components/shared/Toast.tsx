import { create } from 'zustand'
import { useEffect, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let seq = 0
const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq
    set(s => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

/** Hook used anywhere to raise a toast: const toast = useToast(); toast.success('Saved') */
export function useToast() {
  const push = useToastStore(s => s.push)
  return useMemo(() => ({
    success: (m: string) => push('success', m),
    error:   (m: string) => push('error', m),
    info:    (m: string) => push('info', m),
  }), [push])
}

const ICONS = {
  success: <CheckCircle2 size={16} className="text-emerald-500" />,
  error:   <AlertTriangle size={16} className="text-rose-500" />,
  info:    <Info size={16} className="text-brand-strong" />,
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="fixed bottom-5 end-5 z-[100] flex flex-col gap-2.5 w-[320px] max-w-[calc(100vw-2.5rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className="toast-in card !rounded-2xl flex items-start gap-3 px-4 py-3.5 shadow-[0_16px_40px_-16px_rgb(var(--shadow)/0.35)]"
        >
          <span className="mt-0.5 flex-shrink-0">{ICONS[t.kind]}</span>
          <p className="text-[13px] text-content leading-snug flex-1">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="text-content-subtle hover:text-content transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/** Bridges a window event so non-React code can raise toasts if needed. */
export function useToastBridge() {
  const push = useToastStore(s => s.push)
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { kind: ToastKind; message: string }
      if (d?.message) push(d.kind ?? 'info', d.message)
    }
    window.addEventListener('ep:toast', handler)
    return () => window.removeEventListener('ep:toast', handler)
  }, [push])
}
