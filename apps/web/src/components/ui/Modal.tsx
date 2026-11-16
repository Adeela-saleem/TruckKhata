import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Portal } from '../shared/Portal'
import { cn } from './cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}

const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/** A dialog card over a dimmed page. Escape and the backdrop close it. */
export function Modal({ open, onClose, title, description, children, footer, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])
  if (!open) return null
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div className="modal-backdrop absolute inset-0 bg-[rgb(17_19_24/0.35)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
        <div role="dialog" aria-modal="true" aria-label={title}
          className={cn('modal-panel card relative w-full flex flex-col shadow-[0_24px_60px_-20px_rgb(var(--shadow)/0.35)] max-h-[calc(min(90vh,100vh-2rem)/var(--ui-zoom))]', widths[size])}>
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 flex-shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-[19px] font-medium text-content">{title}</h2>
              {description && <p className="text-[14px] text-content-subtle mt-1">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full grid place-items-center text-content-subtle hover:text-content hover:bg-surface-2 transition-colors">
              <X size={17} />
            </button>
          </div>
          <div className="overflow-y-auto scroll-thin px-6 pb-5 flex-1">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-line flex-shrink-0">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
