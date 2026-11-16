import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { reloadAppAsync } from 'expo';
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { openDb } from '../db/client';
import type { Db } from '../db/core';
import { translator, type Lang, type Translate } from '../i18n';
import { getSetting, setSetting } from '../repo/settings';
import { syncReminders } from '../services/reminders';
import { colors, fonts } from './theme';

type AppContextValue = { db: Db; lang: Lang; t: Translate; isRTL: boolean; setLang: (lang: Lang) => Promise<void> };

const AppContext = createContext<AppContextValue | null>(null);

function applyDirection(lang: Lang) {
  const rtl = lang === 'ur';
  if (Platform.OS === 'web') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    return;
  }
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
}

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: Archivo_400Regular, [fonts.medium]: Archivo_500Medium, [fonts.semibold]: Archivo_600SemiBold, [fonts.bold]: Archivo_700Bold,
    [fonts.heavy]: Archivo_800ExtraBold,
    [fonts.urdu]: NotoNastaliqUrdu_400Regular, [fonts.urduBold]: NotoNastaliqUrdu_700Bold,
  });
  const [db, setDb] = useState<Db | null>(null);
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    (async () => {
      const opened = await openDb();
      const saved = (await getSetting(opened, 'lang')) as Lang | null;
      const initial: Lang = saved ?? 'en';
      applyDirection(initial);
      // Native direction only changes on the next launch. Restart once, and only once
      // per language, so a device that ignores the request cannot loop forever.
      const wantRTL = initial === 'ur';
      if (Platform.OS !== 'web' && I18nManager.isRTL !== wantRTL && (await getSetting(opened, 'rtl_applied')) !== initial) {
        await setSetting(opened, 'rtl_applied', initial);
        await reloadAppAsync();
        return;
      }
      setLangState(initial);
      setDb(opened);
      syncReminders(opened, translator(initial));
    })();
  }, []);

  const value = useMemo<AppContextValue | null>(() => {
    if (!db) return null;
    return {
      db, lang, t: translator(lang), isRTL: lang === 'ur',
      setLang: async (next) => {
        await setSetting(db, 'lang', next);
        applyDirection(next);
        // Native layout direction is only read at launch.
        if (Platform.OS === 'web') setLangState(next);
        else await reloadAppAsync();
      },
    };
  }, [db, lang]);

  if (!value || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, backgroundColor: colors.brand }}>{fallback}</View>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

/** Reloads whenever the screen comes back into view, so saved edits always show. */
export function useData<T>(load: (db: Db) => Promise<T>, deps: readonly unknown[] = []) {
  const { db } = useApp();
  const [data, setData] = useState<T | null>(null);
  const request = useRef(0);
  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; });
  const key = JSON.stringify(deps);
  const reload = useCallback(async () => {
    const id = ++request.current;
    const result = await latestLoad.current(db);
    if (id === request.current) setData(result);
    // `key` carries the caller's values, so a changed filter reloads with the newest load function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, reload };
}
