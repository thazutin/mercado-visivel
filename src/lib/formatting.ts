// ============================================================================
// Virô — Centralized Formatting Utilities
// Currency, number, and date formatting by locale/country
// ============================================================================

import type { Locale } from './i18n';

type Currency = 'BRL' | 'USD' | 'EUR';

const LOCALE_TO_INTL: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const CURRENCY_CONFIG: Record<Currency, { locale: string; symbol: string }> = {
  BRL: { locale: 'pt-BR', symbol: 'R$' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'es-ES', symbol: '€' },
};

/**
 * Format a monetary value according to the currency.
 * Uses the currency's native locale for consistent formatting.
 */
export function formatCurrency(value: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(CURRENCY_CONFIG[currency].locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${CURRENCY_CONFIG[currency].symbol} ${value.toLocaleString()}`;
  }
}

/**
 * Format a number according to the UI locale.
 */
export function formatNumber(value: number, locale: Locale): string {
  try {
    return new Intl.NumberFormat(LOCALE_TO_INTL[locale]).format(value);
  } catch {
    return value.toLocaleString();
  }
}

/**
 * Format a date according to the UI locale.
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const defaultOpts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  };
  try {
    return new Intl.DateTimeFormat(LOCALE_TO_INTL[locale], defaultOpts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Get the Intl locale string for a Virô locale.
 */
export function getIntlLocale(locale: Locale): string {
  return LOCALE_TO_INTL[locale];
}
