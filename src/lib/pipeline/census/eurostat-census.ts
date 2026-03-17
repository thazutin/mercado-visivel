// ============================================================================
// Eurostat Census Adapter — Fallback para países europeus
// API: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/
// Dataset demo_r_pjangrp3: Population by NUTS 3 regions
// Usado quando não há adapter específico para o país (ex: Alemanha, França, etc.)
// ============================================================================

import type { CensusAdapter, CensusResult } from './census-adapter';

// Populações nacionais aproximadas (milhões) — países europeus cobertos pelo Eurostat
const POPULACAO_EUROPA: Record<string, number> = {
  'alemanha': 84_000_000,
  'franca': 68_000_000,
  'italia': 59_000_000,
  'paises baixos': 17_800_000,
  'belgica': 11_600_000,
  'grecia': 10_400_000,
  'republica checa': 10_800_000,
  'suecia': 10_500_000,
  'hungria': 9_600_000,
  'austria': 9_100_000,
  'suica': 8_800_000,
  'bulgaria': 6_500_000,
  'dinamarca': 5_900_000,
  'finlandia': 5_500_000,
  'noruega': 5_400_000,
  'irlanda': 5_100_000,
  'croacia': 3_900_000,
  'lituania': 2_800_000,
  'eslovenia': 2_100_000,
  'letonia': 1_800_000,
  'estonia': 1_300_000,
  'chipre': 1_200_000,
  'luxemburgo': 660_000,
  'malta': 530_000,
  'islandia': 380_000,
};

// População padrão caso o país não esteja no mapa
const POPULACAO_EUROPA_MEDIA = 10_000_000;

export class EurostatCensusAdapter implements CensusAdapter {
  private country: string;

  constructor(country: string) {
    this.country = country;
  }

  async getPopulation(city: string, state: string): Promise<CensusResult | null> {
    try {
      console.log(`[Census Eurostat] Buscando população para "${city}", região="${state}", país="${this.country}"`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Eurostat JSON API — busca dados de população por NUTS 3
      // A busca por cidade individual é limitada no Eurostat (dados são por região NUTS)
      // Tentamos buscar e filtrar, mas em muitos casos retornará null
      const url = new URL(
        'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_r_pjangrp3'
      );
      url.searchParams.set('format', 'JSON');
      url.searchParams.set('lang', 'EN');
      url.searchParams.set('sex', 'T');       // Total (ambos sexos)
      url.searchParams.set('age', 'TOTAL');   // Todas as idades
      url.searchParams.set('sinceTimePeriod', '2022');
      url.searchParams.set('untilTimePeriod', '2023');

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Census Eurostat] API retornou HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();

      // O Eurostat retorna dados no formato JSON-stat
      // Estrutura: data.dimension.geo.category.label contém nomes das regiões NUTS
      const geoLabels = data?.dimension?.geo?.category?.label;
      const geoIndex = data?.dimension?.geo?.category?.index;
      const values = data?.value;

      if (!geoLabels || !geoIndex || !values) {
        console.warn('[Census Eurostat] Formato de resposta inesperado');
        return null;
      }

      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cityNorm = normalize(city);

      // Percorre regiões NUTS buscando correspondência pelo nome
      // Nota: NUTS 3 são regiões, não cidades — correspondência aproximada
      for (const [code, label] of Object.entries(geoLabels)) {
        const labelStr = String(label);
        if (normalize(labelStr).includes(cityNorm)) {
          const idx = geoIndex[code];
          const populacao = values[String(idx)];

          if (typeof populacao === 'number' && populacao > 0) {
            console.log(`[Census Eurostat] Encontrado: ${labelStr} (${code}) = ${populacao} hab`);
            return {
              populacao,
              municipioNome: labelStr,
              municipioId: code,
              estado: state || this.country,
              ano: 2023,
              fonte: 'Eurostat',
            };
          }
        }
      }

      console.warn(`[Census Eurostat] Região "${city}" não encontrada nos dados Eurostat`);
      return null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn('[Census Eurostat] Timeout (10s) ao consultar Eurostat');
      } else {
        console.warn('[Census Eurostat] Erro ao consultar Eurostat:', (err as Error).message);
      }
      return null;
    }
  }

  getNationalPopulation(): number {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const countryNorm = normalize(this.country);
    return POPULACAO_EUROPA[countryNorm] || POPULACAO_EUROPA_MEDIA;
  }

  getCountryName(): string {
    return this.country;
  }
}
