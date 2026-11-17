import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApp } from '../app/context';

/** Case # search and the language switch, in the top bar. Each tab has its own add button. */
export function GlobalTools() {
  const { t, lang, setLang } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const search = useRef<HTMLInputElement>(null);

  // "/" jumps to Case # search, unless the person is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (term.trim()) navigate(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <form onSubmit={submit} role="search" className="relative hidden md:block">
        <Search size={16} strokeWidth={1.8} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-content-subtle pointer-events-none" />
        <input ref={search} value={term} onChange={(e) => setTerm(e.target.value.toUpperCase())} placeholder={t('home.searchPlaceholder')} aria-label={t('home.searchPlaceholder')}
          className="peer noir-search !bg-surface h-10 w-56 2xl:w-72 ps-10 pe-10 rounded-[10px] text-[14px] font-mono tracking-wide text-content placeholder:font-sans placeholder:tracking-normal placeholder:text-content-subtle focus:outline-none" />
        <kbd className="keycap absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:opacity-0 transition-opacity">/</kbd>
      </form>
      <button type="button" onClick={() => navigate('/search')} aria-label={t('actions.search')}
        className="md:hidden w-10 h-10 rounded-[10px] grid place-items-center bg-surface text-content-muted shrink-0"><Search size={18} strokeWidth={1.8} /></button>
      <button type="button" onClick={() => setLang(lang === 'en' ? 'ur' : 'en')} title={t('home.language')}
        className="h-10 px-3.5 rounded-[10px] text-[14px] font-medium text-content-muted hover:text-content hover:bg-surface transition-colors shrink-0 whitespace-nowrap">
        {lang === 'en' ? 'اردو' : 'English'}
      </button>
    </div>
  );
}
