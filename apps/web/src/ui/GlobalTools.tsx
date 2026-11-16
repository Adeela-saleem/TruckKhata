import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../app/context';

const addItems = [
  { key: 'ada', to: '/ada/new' },
  { key: 'trip', to: '/trips/new' },
  { key: 'bill', to: '/bills/new' },
  { key: 'party', to: '/parties/new' },
  { key: 'insurance', to: '/insurance/new' },
] as const;

/** Case # search, the Add menu and the language switch, in the top bar. */
export function GlobalTools() {
  const { t, lang, setLang } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  // "/" jumps to Case # search and "N" opens the Add menu, unless the person is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (term.trim()) navigate(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <form onSubmit={submit} role="search" className="relative hidden md:block">
        <Search size={16} strokeWidth={1.8} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-content-subtle pointer-events-none" />
        <input ref={search} value={term} onChange={(e) => setTerm(e.target.value.toUpperCase())} placeholder={t('home.searchPlaceholder')} aria-label={t('home.searchPlaceholder')}
          className="peer noir-search !bg-surface h-10 w-56 2xl:w-72 ps-10 pe-10 rounded-full text-[14px] font-mono tracking-wide text-content placeholder:font-sans placeholder:tracking-normal placeholder:text-content-subtle focus:outline-none" />
        <kbd className="keycap absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:opacity-0 transition-opacity">/</kbd>
      </form>
      <button type="button" onClick={() => navigate('/search')} aria-label={t('actions.search')}
        className="md:hidden w-10 h-10 rounded-full grid place-items-center bg-surface text-content-muted shrink-0"><Search size={18} strokeWidth={1.8} /></button>
      <div ref={menu} className="relative">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
          title="N" className="btn-press noir-cta h-10 ps-3.5 pe-4 rounded-full inline-flex items-center gap-1.5 text-[14px] font-medium shrink-0">
          <Plus size={17} strokeWidth={2.2} className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`} /><span className="hidden sm:inline">{t('web.shell.addNew')}</span>
        </button>
        {open && (
          <div role="menu" className="menu-pop card absolute end-0 top-12 z-50 w-60 p-1.5 shadow-[0_16px_40px_-16px_rgb(var(--shadow)/0.25)]">
            {addItems.map((item) => (
              <button key={item.key} role="menuitem" type="button" onClick={() => { setOpen(false); navigate(item.to); }}
                className="w-full h-11 px-3.5 rounded-2xl text-start text-[14.5px] text-content hover:bg-surface-2 transition-colors">
                {t(`add.${item.key}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setLang(lang === 'en' ? 'ur' : 'en')} title={t('home.language')}
        className="h-10 px-3.5 rounded-full text-[14px] font-medium text-content-muted hover:text-content hover:bg-surface transition-colors shrink-0 whitespace-nowrap">
        {lang === 'en' ? 'اردو' : 'English'}
      </button>
    </div>
  );
}
