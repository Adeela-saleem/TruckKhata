import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useApp } from '../app/context';
import { useAuth } from '../app/auth';
import { cn } from '../components/ui/cn';
import { Wordmark } from './Brand';
import { GlobalTools } from './GlobalTools';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NavItem = { to: string; label: string; Icon: ComponentType<any>; badge?: number };
export type NavGroup = { heading: string; items: NavItem[] };

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} aria-label="Toggle theme" title="Toggle theme"
      className="w-10 h-10 rounded-full grid place-items-center text-content-muted hover:text-content hover:bg-surface transition-colors shrink-0">
      {theme === 'dark' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
    </button>
  );
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="rounded-full bg-brand-soft text-brand-strong grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{initials(name)}</span>
  );
}

function SideNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { t } = useApp();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-5 pb-4"><NavLink to="/" onClick={onNavigate} className="inline-flex rounded-xl"><Wordmark /></NavLink></div>
      <nav aria-label={t('web.shell.main')} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 pb-3">
        {groups.map((g) => (
          <div key={g.heading} className="mt-3 first:mt-0">
            <p className="px-4 h-8 flex items-center text-[12.5px] font-medium text-content-subtle">{g.heading}</p>
            <ul className="flex flex-col gap-1">
              {g.items.map((item) => {
                const active = isActive(pathname, item.to);
                return (
                  <li key={item.to}>
                    <NavLink to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                      className={cn('flex items-center gap-3 h-11 px-4 rounded-full text-[15px] font-medium transition-colors',
                        active ? 'bg-brand text-white shadow-[0_8px_20px_-12px_rgb(var(--brand)/0.9)]' : 'text-content-muted hover:text-content hover:bg-surface-2')}>
                      <item.Icon size={18} strokeWidth={1.8} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.badge && (
                        <span className={cn('min-w-[22px] h-[22px] px-1.5 rounded-full grid place-items-center text-[12px] font-semibold tabular-nums',
                          active ? 'bg-white/25 text-white' : 'bg-bad/10 text-bad')}>{item.badge}</span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {user && (
        <div className="p-3">
          <div className={cn('rounded-[20px] p-2 flex items-center gap-2 transition-colors', isActive(pathname, '/profile') ? 'bg-brand-soft' : 'bg-surface-2')}>
            <NavLink to="/profile" onClick={onNavigate} className="flex-1 min-w-0 flex items-center gap-3 rounded-2xl p-1">
              <Avatar name={user.name} />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium text-content truncate">{user.name}</span>
                <span className="block text-[12.5px] text-content-subtle truncate" dir="ltr">{user.email}</span>
              </span>
            </NavLink>
            <button type="button" onClick={() => { signOut(); navigate('/login'); }} title={t('web.auth.signOut')} aria-label={t('web.auth.signOut')}
              className="w-10 h-10 rounded-full grid place-items-center text-content-subtle hover:text-bad hover:bg-surface transition-colors shrink-0">
              <LogOut size={17} strokeWidth={1.8} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The frame: a white sidebar holding the modules and the signed-in person, and the page on
 * the grey desk with the global tools above it. On a phone the sidebar slides in as a drawer.
 */
export function Shell({ groups, children }: { groups: NavGroup[]; children: ReactNode }) {
  const { t } = useApp();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-viewport flex">
      <aside className="hidden lg:block w-[272px] shrink-0 p-3 pe-0">
        <div className="card sticky top-3 h-[calc(100vh/var(--ui-zoom)_-_1.5rem)]"><SideNav groups={groups} /></div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('web.shell.main')}>
          <div className="modal-backdrop absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="drawer-in card absolute inset-y-3 start-3 w-[min(300px,calc(100%-1.5rem))]">
            <button type="button" onClick={() => setOpen(false)} aria-label={t('actions.cancel')}
              className="absolute top-5 end-3 w-9 h-9 rounded-full grid place-items-center hover:bg-surface-2 z-10"><X size={18} /></button>
            <SideNav groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 shrink-0 flex items-center gap-2 px-3 sm:px-5 xl:px-8 pt-3">
          <button type="button" onClick={() => setOpen(true)} aria-label={t('web.shell.menu')}
            className="lg:hidden w-10 h-10 rounded-full grid place-items-center bg-surface text-content-muted shrink-0"><Menu size={19} strokeWidth={1.8} /></button>
          <div className="ms-auto flex items-center gap-1.5 min-w-0">
            <GlobalTools />
            <ThemeButton />
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </div>
    </div>
  );
}
