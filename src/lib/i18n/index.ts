import { writable, derived } from 'svelte/store';
import no from './no';
import en from './en';

export type Locale = 'no' | 'en';

const translations: Record<Locale, Record<string, string>> = { no, en };

export const locale = writable<Locale>('no');

export const t = derived(locale, ($locale) => {
  const strings = translations[$locale];
  return (key: string, params?: Record<string, string>): string => {
    let str = strings[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
      }
    }
    return str;
  };
});
