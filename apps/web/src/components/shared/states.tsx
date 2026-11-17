import type { ReactNode } from 'react'
import { Inbox, WifiOff, RotateCw } from 'lucide-react'

interface EmptyProps {
  title?: string
  message?: string
  icon?: ReactNode
}

export function EmptyState({ title = 'Nothing here yet', message, icon }: EmptyProps) {
  return (
    <div className="py-14 flex flex-col items-center gap-3 text-center">
      <span className="grid place-items-center w-12 h-12 rounded-xl bg-surface-2 border border-line text-content-subtle">
        {icon ?? <Inbox size={22} />}
      </span>
      <div>
        <p className="text-sm font-medium text-content">{title}</p>
        {message && <p className="text-xs text-content-subtle mt-1 max-w-xs">{message}</p>}
      </div>
    </div>
  )
}

interface ErrorProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Could not reach the server.', onRetry }: ErrorProps) {
  return (
    <div className="py-14 flex flex-col items-center gap-3 text-center">
      <span className="grid place-items-center w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/20">
        <WifiOff size={22} />
      </span>
      <div>
        <p className="text-sm font-medium text-content">Something went wrong</p>
        <p className="text-xs text-content-subtle mt-1 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-content hover:border-line-strong transition-colors"
        >
          <RotateCw size={12} /> Retry
        </button>
      )}
    </div>
  )
}
