// ============================================================================
// Virô i18n Configuration
// Country detection, locale mapping, and cookie management
// ============================================================================

import type { Locale } from './i18n';

export const SUPPORTED_LOCALES: Locale[] = ['pt', 'en', 'es'];
export const DEFAULT_LOCALE: Locale = 'pt';
export const LOCALE_COOKIE_NAME = 'viro_locale';

// Country ISO alpha-2 → locale mapping
export const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Portuguese
  BR: 'pt',
  PT: 'pt',
  AO: 'pt',
  MZ: 'pt',

  // Spanish
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  PE: 'es',
  EC: 'es',
  VE: 'es',
  UY: 'es',
  PY: 'es',
  BO: 'es',
  CR: 'es',
  PA: 'es',
  DO: 'es',
  GT: 'es',
  HN: 'es',
  SV: 'es',
  NI: 'es',
  CU: 'es',

  // English (everything else defaults here, but these are explicit)
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',
  ZA: 'en',
  IN: 'en',
};

/**
 * Resolves a country code (from Vercel x-vercel-ip-country header) to a locale.
 * Falls back to DEFAULT_LOCALE if country not mapped.
 */
export function countryToLocale(countryCode: string | null): Locale {
  if (!countryCode) return DEFAULT_LOCALE;
  return COUNTRY_TO_LOCALE[countryCode.toUpperCase()] || 'en';
}

/**
 * Validates a locale string. Returns the locale if valid, DEFAULT_LOCALE otherwise.
 */
export function isValidLocale(locale: string | undefined | null): locale is Locale {
  return !!locale && SUPPORTED_LOCALES.includes(locale as Locale);
}

export function resolveLocale(cookieValue: string | undefined | null): Locale {
  if (isValidLocale(cookieValue)) return cookieValue;
  return DEFAULT_LOCALE;
}
