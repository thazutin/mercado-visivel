// ============================================================================
// useLocale — Client-side locale hook
// Reads locale from cookie, provides setter and translation function
// ============================================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { dictionaries, type Locale } from '@/lib/i18n';
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n-config';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const cookie = getCookie(LOCALE_COOKIE_NAME);
    if (cookie && SUPPORTED_LOCALES.includes(cookie as Locale)) {
      return cookie as Locale;
    }
    return DEFAULT_LOCALE;
  });

  const setLocale = useCallback((newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setCookie(LOCALE_COOKIE_NAME, newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useMemo(() => dictionaries[locale], [locale]);

  return { locale, setLocale, t };
}
