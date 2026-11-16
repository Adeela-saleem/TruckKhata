import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Db } from '../core/db/core';
import { translator, type Lang, type Translate } from '../core/i18n';
import { getSetting, setSetting } from '../core/repo/settings';
import { onExternalChange, openDb } from '../platform/db';

type AppState = {
  db: Db;
  lang: Lang;
  t: Translate;
  setLang: (lang: Lang) => Promise<void>;
  /** Bumped after every change, so every visible list reloads. */
  version: number;
  changed: () => void;
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp outside AppProvider');
  return app;
}

/** Urdu reads right to left and uses the Nastaliq face, everywhere at once. */
function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
}

export function AppProvider({ children, splash }: { children: ReactNode; splash: (error?: unknown) => ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<unknown>();
  const [lang, setLangState] = useState<Lang>('en');
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    openDb()
      .then(async (opened) => {
        const saved = (await getSetting(opened, 'lang')) as Lang | null;
        const initial = saved === 'ur' ? 'ur' : 'en';
        applyLang(initial);
        setLangState(initial);
        setDb(opened);
      })
      .catch(setError);
    return onExternalChange(changed);
  }, [changed]);

  const setLang = useCallback(async (next: Lang) => {
    if (!db) return;
    await setSetting(db, 'lang', next);
    applyLang(next);
    setLangState(next);
  }, [db]);

  const value = useMemo(
    () => (db ? { db, lang, t: translator(lang), setLang, version, changed } : null),
    [db, lang, setLang, version, changed],
  );
  if (!value) return <>{splash(error)}</>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Loads data from the database and reloads it after any change. */
export function useData<T>(load: (db: Db) => Promise<T>, deps: unknown[] = []) {
  const { db, version } = useApp();
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>();
  const loadRef = useRef(load);
  loadRef.current = load;
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    loadRef.current(db).then(
      (result) => { if (live) { setData(result); setError(undefined); } },
      (err) => { if (live) setError(err); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, nonce, ...deps]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading: data === undefined && !error, reload };
}
