import { en } from './en';
import { ur } from './ur';

export type Lang = 'en' | 'ur';
const dictionaries = { en, ur } as const;

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translator(lang: Lang): Translate {
  return (key, vars) => {
    let node: unknown = dictionaries[lang];
    for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
    let text = typeof node === 'string' ? node : key;
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.replace(`{{${name}}}`, String(value));
    return text;
  };
}

const arabicScript = /[؀-ۿ]/;
export const hasUrdu = (text: string | null | undefined) => arabicScript.test(text ?? '');
