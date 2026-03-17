// ============================================================================
// Virô — Country Configuration Registry
// Central config for each supported country: locale, currency, APIs, geo-targeting
// ============================================================================

import type { Locale } from './i18n';

export interface CountryConfig {
  code: string;                // ISO alpha-2
  locale: Locale;
  currency: 'BRL' | 'USD' | 'EUR';
  currencySymbol: string;
  phonePrefix: string;
  searchLanguageCode: string;  // pt-BR, en, es
  searchCountryCode: string;   // br, us, es, pt
  geoTargetConstant: string;   // Google Ads geo target ID
  dataforseoCountryCode: number;
  nominatimCountry: string;
  populationApi: 'ibge' | 'census_us' | 'ine_pt' | 'ine_es' | 'eurostat';
  procurementApi: 'pncp' | 'sam_gov' | 'ted_eu' | 'base_pt' | null;
  nationalPopulation: number;
  nationalLabel: string;
  nationalCheckRegex: RegExp;
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  BR: {
    code: 'BR',
    locale: 'pt',
    currency: 'BRL',
    currencySymbol: 'R$',
    phonePrefix: '+55',
    searchLanguageCode: 'pt-BR',
    searchCountryCode: 'br',
    geoTargetConstant: '2076',
    dataforseoCountryCode: 2076,
    nominatimCountry: 'Brazil',
    populationApi: 'ibge',
    procurementApi: 'pncp',
    nationalPopulation: 215_000_000,
    nationalLabel: 'Brasil',
    nationalCheckRegex: /brasil.*nacional|nacional|todo o brasil/i,
  },
  PT: {
    code: 'PT',
    locale: 'pt',
    currency: 'EUR',
    currencySymbol: '€',
    phonePrefix: '+351',
    searchLanguageCode: 'pt-PT',
    searchCountryCode: 'pt',
    geoTargetConstant: '2620',
    dataforseoCountryCode: 2620,
    nominatimCountry: 'Portugal',
    populationApi: 'ine_pt',
    procurementApi: 'base_pt',
    nationalPopulation: 10_300_000,
    nationalLabel: 'Portugal',
    nationalCheckRegex: /portugal.*nacional|nacional|todo.*portugal/i,
  },
  ES: {
    code: 'ES',
    locale: 'es',
    currency: 'EUR',
    currencySymbol: '€',
    phonePrefix: '+34',
    searchLanguageCode: 'es',
    searchCountryCode: 'es',
    geoTargetConstant: '2724',
    dataforseoCountryCode: 2724,
    nominatimCountry: 'Spain',
    populationApi: 'ine_es',
    procurementApi: 'ted_eu',
    nationalPopulation: 47_500_000,
    nationalLabel: 'España',
    nationalCheckRegex: /españa|espana|spain.*nacional|nacional|todo.*espa[ñn]a/i,
  },
  US: {
    code: 'US',
    locale: 'en',
    currency: 'USD',
    currencySymbol: '$',
    phonePrefix: '+1',
    searchLanguageCode: 'en',
    searchCountryCode: 'us',
    geoTargetConstant: '2840',
    dataforseoCountryCode: 2840,
    nominatimCountry: 'United States',
    populationApi: 'census_us',
    procurementApi: 'sam_gov',
    nationalPopulation: 335_000_000,
    nationalLabel: 'United States',
    nationalCheckRegex: /nationwide|national|all.*(?:us|usa|united states)/i,
  },

  // Generic EU fallback — used for EU countries without a dedicated config
  EU: {
    code: 'EU',
    locale: 'en',
    currency: 'EUR',
    currencySymbol: '€',
    phonePrefix: '',
    searchLanguageCode: 'en',
    searchCountryCode: '',
    geoTargetConstant: '',
    dataforseoCountryCode: 0,
    nominatimCountry: '',
    populationApi: 'eurostat',
    procurementApi: 'ted_eu',
    nationalPopulation: 450_000_000,
    nationalLabel: 'European Union',
    nationalCheckRegex: /eu.*wide|europe.*wide|national/i,
  },
};

/**
 * Get country config by ISO alpha-2 code. Falls back to BR if not found.
 */
export function getCountryConfig(countryCode: string): CountryConfig {
  return COUNTRY_CONFIGS[countryCode.toUpperCase()] || COUNTRY_CONFIGS.BR;
}

/**
 * Default country code used when no country is detected.
 */
export const DEFAULT_COUNTRY = 'BR';
