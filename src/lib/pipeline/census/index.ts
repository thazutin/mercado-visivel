// ============================================================================
// Census Factory — Seleciona adapter censitário por país/região
// Ponto de entrada único para obter dados populacionais de qualquer país
// ============================================================================

export type { CensusResult, CensusAdapter } from './census-adapter';
export { BrazilCensusAdapter } from './brazil-census';
export { PortugalCensusAdapter } from './portugal-census';
export { SpainCensusAdapter } from './spain-census';
export { USCensusAdapter } from './us-census';
export { EurostatCensusAdapter } from './eurostat-census';

import type { CensusAdapter } from './census-adapter';
import { BrazilCensusAdapter } from './brazil-census';
import { PortugalCensusAdapter } from './portugal-census';
import { SpainCensusAdapter } from './spain-census';
import { USCensusAdapter } from './us-census';
import { EurostatCensusAdapter } from './eurostat-census';

/**
 * Países com adapter específico.
 * Para países europeus sem adapter dedicado, usa Eurostat como fallback.
 */
type SupportedCountry = 'BR' | 'PT' | 'ES' | 'US';

// Mapeamento de variações de nome/código para país padronizado
const COUNTRY_ALIASES: Record<string, SupportedCountry | 'EU'> = {
  // Brasil
  'br': 'BR', 'brasil': 'BR', 'brazil': 'BR', 'ibge': 'BR',
  // Portugal
  'pt': 'PT', 'portugal': 'PT', 'ine_pt': 'PT',
  // Espanha
  'es': 'ES', 'espanha': 'ES', 'españa': 'ES', 'spain': 'ES', 'ine_es': 'ES',
  // Estados Unidos
  'us': 'US', 'usa': 'US', 'eua': 'US', 'estados unidos': 'US', 'united states': 'US', 'census_us': 'US',
  // Eurostat
  'eurostat': 'EU',
  // Países europeus → Eurostat fallback
  'de': 'EU', 'alemanha': 'EU', 'germany': 'EU',
  'fr': 'EU', 'franca': 'EU', 'frança': 'EU', 'france': 'EU',
  'it': 'EU', 'italia': 'EU', 'itália': 'EU', 'italy': 'EU',
  'nl': 'EU', 'paises baixos': 'EU', 'netherlands': 'EU', 'holanda': 'EU',
  'be': 'EU', 'belgica': 'EU', 'bélgica': 'EU', 'belgium': 'EU',
  'at': 'EU', 'austria': 'EU', 'áustria': 'EU',
  'ch': 'EU', 'suica': 'EU', 'suíça': 'EU', 'switzerland': 'EU',
  'se': 'EU', 'suecia': 'EU', 'suécia': 'EU', 'sweden': 'EU',
  'dk': 'EU', 'dinamarca': 'EU', 'denmark': 'EU',
  'fi': 'EU', 'finlandia': 'EU', 'finlândia': 'EU', 'finland': 'EU',
  'no': 'EU', 'noruega': 'EU', 'norway': 'EU',
  'ie': 'EU', 'irlanda': 'EU', 'ireland': 'EU',
  'gr': 'EU', 'grecia': 'EU', 'grécia': 'EU', 'greece': 'EU',
  'pl': 'EU', 'polonia': 'EU', 'polônia': 'EU', 'poland': 'EU',
  'cz': 'EU', 'republica checa': 'EU', 'czech republic': 'EU', 'czechia': 'EU',
  'hu': 'EU', 'hungria': 'EU', 'hungary': 'EU',
  'ro': 'EU', 'romenia': 'EU', 'romênia': 'EU', 'romania': 'EU',
  'hr': 'EU', 'croacia': 'EU', 'croácia': 'EU', 'croatia': 'EU',
  'bg': 'EU', 'bulgaria': 'EU', 'bulgária': 'EU',
};

// Cache de adapters — evita reinstanciar para o mesmo país
const adapterCache = new Map<string, CensusAdapter>();

/**
 * Resolve o nome original do país europeu a partir do alias.
 * Usado para criar EurostatCensusAdapter com o nome correto.
 */
function resolveEuropeanCountryName(countryInput: string): string {
  const lower = countryInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Mapeamento de códigos/nomes para nome em português
  const euroNames: Record<string, string> = {
    'de': 'Alemanha', 'alemanha': 'Alemanha', 'germany': 'Alemanha',
    'fr': 'França', 'franca': 'França', 'france': 'França',
    'it': 'Itália', 'italia': 'Itália', 'italy': 'Itália',
    'nl': 'Países Baixos', 'paises baixos': 'Países Baixos', 'netherlands': 'Países Baixos', 'holanda': 'Países Baixos',
    'be': 'Bélgica', 'belgica': 'Bélgica', 'belgium': 'Bélgica',
    'at': 'Áustria', 'austria': 'Áustria',
    'ch': 'Suíça', 'suica': 'Suíça', 'switzerland': 'Suíça',
    'se': 'Suécia', 'suecia': 'Suécia', 'sweden': 'Suécia',
    'dk': 'Dinamarca', 'dinamarca': 'Dinamarca', 'denmark': 'Dinamarca',
    'fi': 'Finlândia', 'finlandia': 'Finlândia', 'finland': 'Finlândia',
    'no': 'Noruega', 'noruega': 'Noruega', 'norway': 'Noruega',
    'ie': 'Irlanda', 'irlanda': 'Irlanda', 'ireland': 'Irlanda',
    'gr': 'Grécia', 'grecia': 'Grécia', 'greece': 'Grécia',
    'pl': 'Polônia', 'polonia': 'Polônia', 'poland': 'Polônia',
    'cz': 'República Checa', 'republica checa': 'República Checa', 'czech republic': 'República Checa', 'czechia': 'República Checa',
    'hu': 'Hungria', 'hungria': 'Hungria', 'hungary': 'Hungria',
    'ro': 'Romênia', 'romenia': 'Romênia', 'romania': 'Romênia',
    'hr': 'Croácia', 'croacia': 'Croácia', 'croatia': 'Croácia',
    'bg': 'Bulgária', 'bulgaria': 'Bulgária',
  };

  return euroNames[lower] || countryInput;
}

/**
 * Factory principal — retorna o adapter censitário para o país informado.
 *
 * @param country - Código ISO (BR, PT, US, etc.) ou nome do país em qualquer idioma
 * @returns Adapter específico do país, Eurostat para europeus, ou null se não suportado
 *
 * @example
 * ```ts
 * const adapter = getCensusAdapter('BR');
 * const result = await adapter?.getPopulation('São Paulo', 'SP');
 * ```
 */
export function getCensusAdapter(country: string): CensusAdapter | null {
  const normalized = country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const resolved = COUNTRY_ALIASES[normalized];

  if (!resolved) {
    console.warn(`[Census Factory] País "${country}" não suportado`);
    return null;
  }

  // Verifica cache
  const cacheKey = resolved === 'EU' ? `EU:${normalized}` : resolved;
  const cached = adapterCache.get(cacheKey);
  if (cached) return cached;

  let adapter: CensusAdapter;

  switch (resolved) {
    case 'BR':
      adapter = new BrazilCensusAdapter();
      break;
    case 'PT':
      adapter = new PortugalCensusAdapter();
      break;
    case 'ES':
      adapter = new SpainCensusAdapter();
      break;
    case 'US':
      adapter = new USCensusAdapter();
      break;
    case 'EU':
      adapter = new EurostatCensusAdapter(resolveEuropeanCountryName(country));
      break;
    default:
      return null;
  }

  adapterCache.set(cacheKey, adapter);
  console.log(`[Census Factory] Adapter criado: ${adapter.getCountryName()} (${resolved})`);
  return adapter;
}

/**
 * Atalho: busca população usando detecção automática de país.
 * Tenta Brasil primeiro (compatibilidade retroativa), depois outros países.
 */
export async function getPopulationByCountry(
  city: string,
  state: string,
  country: string,
): Promise<import('./census-adapter').CensusResult | null> {
  const adapter = getCensusAdapter(country);
  if (!adapter) return null;
  return adapter.getPopulation(city, state);
}
