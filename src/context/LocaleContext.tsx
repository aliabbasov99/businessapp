import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  translate,
  type LanguageCode,
} from '@/i18n/translations';

type LocaleContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string) => string;
  languageLabel: string;
  locale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'promar.locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!mounted) return;
        if (value && LANGUAGES.some(item => item.code === value)) {
          setLangState(value as LanguageCode);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const value = useMemo<LocaleContextValue>(() => ({
    lang,
    setLang,
    t,
    languageLabel: LANGUAGES.find(item => item.code === lang)?.label ?? DEFAULT_LANGUAGE,
    locale: { az: 'az-AZ', tr: 'tr-TR', en: 'en-US', ru: 'ru-RU' }[lang],
  }), [lang, setLang, t]);

  if (!ready) {
    return null;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
