// ============================================================================
// Portugal Census Adapter — INE Portugal (Instituto Nacional de Estatística)
// API: https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores
// Indicador 0008273: População residente por município
// ============================================================================

import type { CensusAdapter, CensusResult } from './census-adapter';

const POPULACAO_PORTUGAL = 10_350_000;

// URL base da API JSON do INE Portugal
const INE_PT_API_BASE = 'https://www.ine.pt/ine/json_indicador/pindica.jsp';

export class PortugalCensusAdapter implements CensusAdapter {
  async getPopulation(city: string, state: string): Promise<CensusResult | null> {
    try {
      console.log(`[Census PT] Buscando população para "${city}", distrito="${state}"`);

      // Tenta consultar a API do INE Portugal
      // O indicador 0008273 contém população residente por município
      const url = `${INE_PT_API_BASE}?op=2&varcd=0008273&Ession=pt`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Census PT] API INE retornou HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();

      // Normaliza nome da cidade para comparação
      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cityNorm = normalize(city);

      // Estrutura da resposta INE varia — tenta extrair dados do município
      // A API retorna array de registros com GeografiaDescritivo e Valor
      if (Array.isArray(data)) {
        for (const record of data) {
          const geoName = record?.GeografiaDescritivo || record?.geodsg || '';
          if (normalize(geoName) === cityNorm) {
            const populacao = parseInt(record?.Valor || record?.valor || '0', 10);
            if (populacao > 0) {
              console.log(`[Census PT] Encontrado: ${geoName} = ${populacao} hab`);
              return {
                populacao,
                municipioNome: geoName,
                municipioId: String(record?.geocod || record?.GeografiaCodigo || ''),
                estado: state || 'Portugal',
                ano: parseInt(record?.dim_3 || String(new Date().getFullYear()), 10),
                fonte: 'INE Portugal',
              };
            }
          }
        }
      }

      console.warn(`[Census PT] Município "${city}" não encontrado nos dados INE`);
      return null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn('[Census PT] Timeout (10s) ao consultar INE Portugal');
      } else {
        console.warn('[Census PT] Erro ao consultar INE Portugal:', (err as Error).message);
      }
      return null;
    }
  }

  getNationalPopulation(): number {
    return POPULACAO_PORTUGAL;
  }

  getCountryName(): string {
    return 'Portugal';
  }
}
