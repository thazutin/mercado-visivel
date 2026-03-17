// ============================================================================
// US Census Adapter — US Census Bureau API
// API: https://api.census.gov/data/2020/dec/pl
// Decennial Census 2020, Public Law 94-171 Redistricting Data
// Requer US_CENSUS_API_KEY (variável de ambiente)
// ============================================================================

import type { CensusAdapter, CensusResult } from './census-adapter';

const POPULACAO_EUA = 335_000_000;

// Mapeamento de siglas de estado para códigos FIPS
const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55',
  WY: '56', DC: '11',
};

// Nomes completos de estados para FIPS
const STATE_NAME_TO_FIPS: Record<string, string> = {
  'alabama': '01', 'alaska': '02', 'arizona': '04', 'arkansas': '05',
  'california': '06', 'colorado': '08', 'connecticut': '09', 'delaware': '10',
  'florida': '12', 'georgia': '13', 'hawaii': '15', 'idaho': '16',
  'illinois': '17', 'indiana': '18', 'iowa': '19', 'kansas': '20',
  'kentucky': '21', 'louisiana': '22', 'maine': '23', 'maryland': '24',
  'massachusetts': '25', 'michigan': '26', 'minnesota': '27', 'mississippi': '28',
  'missouri': '29', 'montana': '30', 'nebraska': '31', 'nevada': '32',
  'new hampshire': '33', 'new jersey': '34', 'new mexico': '35', 'new york': '36',
  'north carolina': '37', 'north dakota': '38', 'ohio': '39', 'oklahoma': '40',
  'oregon': '41', 'pennsylvania': '42', 'rhode island': '44', 'south carolina': '45',
  'south dakota': '46', 'tennessee': '47', 'texas': '48', 'utah': '49',
  'vermont': '50', 'virginia': '51', 'washington': '53', 'west virginia': '54',
  'wisconsin': '55', 'wyoming': '56', 'district of columbia': '11',
};

function getStateFips(state: string): string | null {
  // Tenta sigla primeiro (ex: "CA", "NY")
  const upper = state.toUpperCase().trim();
  if (STATE_FIPS[upper]) return STATE_FIPS[upper];

  // Tenta nome completo (ex: "California")
  const lower = state.toLowerCase().trim();
  if (STATE_NAME_TO_FIPS[lower]) return STATE_NAME_TO_FIPS[lower];

  return null;
}

export class USCensusAdapter implements CensusAdapter {
  async getPopulation(city: string, state: string): Promise<CensusResult | null> {
    const apiKey = process.env.US_CENSUS_API_KEY;
    if (!apiKey) {
      console.warn('[Census US] US_CENSUS_API_KEY não configurada');
      return null;
    }

    const stateFips = getStateFips(state);
    if (!stateFips) {
      console.warn(`[Census US] Estado "${state}" não reconhecido`);
      return null;
    }

    try {
      console.log(`[Census US] Buscando população para "${city}", state="${state}" (FIPS=${stateFips})`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Busca population (P1_001N) de places no estado
      // API Census Bureau: variável P1_001N = Total Population
      const url = new URL('https://api.census.gov/data/2020/dec/pl');
      url.searchParams.set('get', 'NAME,P1_001N');
      url.searchParams.set('for', 'place:*');
      url.searchParams.set('in', `state:${stateFips}`);
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Census US] API retornou HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();

      // Resposta é array de arrays: [["NAME", "P1_001N", "state", "place"], ...]
      // Primeira linha é header
      if (!Array.isArray(data) || data.length < 2) {
        console.warn('[Census US] Resposta vazia ou formato inesperado');
        return null;
      }

      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cityNorm = normalize(city);

      // Percorre resultados (pula header na posição 0)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const name = row[0] || '';
        // Nomes vêm no formato "City name city, State" ou "City name CDP, State"
        // Remove sufixos como " city", " town", " CDP", " borough", etc.
        const cleanName = name.split(',')[0]
          .replace(/\s+(city|town|village|CDP|borough|municipality)$/i, '')
          .trim();

        if (normalize(cleanName) === cityNorm) {
          const populacao = parseInt(row[1], 10);
          if (populacao > 0) {
            const placeCode = row[3] || '';
            console.log(`[Census US] Encontrado: ${cleanName} = ${populacao} hab`);
            return {
              populacao,
              municipioNome: cleanName,
              municipioId: `${stateFips}${placeCode}`,
              estado: state,
              ano: 2020,
              fonte: 'US Census Bureau',
            };
          }
        }
      }

      console.warn(`[Census US] Cidade "${city}" não encontrada no estado ${state}`);
      return null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn('[Census US] Timeout (10s) ao consultar Census Bureau');
      } else {
        console.warn('[Census US] Erro ao consultar Census Bureau:', (err as Error).message);
      }
      return null;
    }
  }

  getNationalPopulation(): number {
    return POPULACAO_EUA;
  }

  getCountryName(): string {
    return 'Estados Unidos';
  }
}
