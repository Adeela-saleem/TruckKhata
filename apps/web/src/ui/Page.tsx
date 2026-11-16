import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Every screen: a small line of context above a large title, the page's actions on the
 * right, an optional row of tabs and filters, then the content. `fit` pages share one
 * desktop screen (lists page instead of scrolling); record and form pages scroll.
 */
export function Page({ title, subtitle, actions, bar, fit = false, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  bar?: ReactNode;
  fit?: boolean;
  children: ReactNode;
}) {
  // Keyed by route, so a page plays its entrance once when opened, not on every filter change.
  const { pathname } = useLocation();
  return (
    <div key={pathname} className={`page-enter flex flex-col flex-1 min-h-0 px-3 sm:px-5 xl:px-8 ${fit ? 'fit:h-[calc(100vh/var(--ui-zoom)_-_64px)]' : ''}`}>
      <div className="page-head pt-3 pb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {subtitle && <p className="text-[14px] text-content-muted truncate">{subtitle}</p>}
          <h1 className="font-display text-[30px] sm:text-[34px] leading-[1.15] tracking-[-0.025em] text-content truncate">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {bar && <div className="pb-4 flex flex-wrap items-center gap-x-3 gap-y-2.5">{bar}</div>}
      <main className={`flex-1 min-h-0 pb-8 ${fit ? 'fit:relative fit:pb-0 fit:overflow-hidden' : ''}`}>
        {/* Pinned on a desktop so every panel inside gets a definite height to share. */}
        <div className={fit ? 'fit:absolute fit:inset-x-0 fit:top-0 fit:bottom-6' : ''}>{children}</div>
      </main>
    </div>
  );
}
