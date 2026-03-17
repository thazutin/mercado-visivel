// ============================================================================
// Spain Census Adapter — INE España (Instituto Nacional de Estadística)
// API: https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2852
// Tabla 2852: Población por municipios
// ============================================================================

import type { CensusAdapter, CensusResult } from './census-adapter';

const POPULACAO_ESPANHA = 48_000_000;

// Endpoint REST da API JSON Tempus do INE España
const INE_ES_API_URL = 'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2852';

export class SpainCensusAdapter implements CensusAdapter {
  async getPopulation(city: string, state: string): Promise<CensusResult | null> {
    try {
      console.log(`[Census ES] Buscando população para "${city}", comunidad="${state}"`);

      // A API do INE España retorna dados de población por municipio
      // Filtramos client-side pelo nome do município
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Nota: A tabela 2852 pode ser grande. Em produção, considerar usar
      // o endpoint com filtro por série específica se disponível.
      const res = await fetch(`${INE_ES_API_URL}?nult=1`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[Census ES] API INE España retornou HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();

      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cityNorm = normalize(city);

      // Estrutura INE España: array de objetos com Nombre, Data, Valor
      if (Array.isArray(data)) {
        for (const record of data) {
          const nombre = record?.Nombre || '';
          // O campo Nombre geralmente contém "NombreMunicipio. Comunidad"
          const municipioName = nombre.split('.')[0]?.trim() || nombre;

          if (normalize(municipioName) === cityNorm) {
            const populacao = Math.round(record?.Valor || 0);
            if (populacao > 0) {
              const anoMatch = record?.Data?.match(/(\d{4})/);
              const ano = anoMatch ? parseInt(anoMatch[1], 10) : new Date().getFullYear();

              console.log(`[Census ES] Encontrado: ${municipioName} = ${populacao} hab (${ano})`);
              return {
                populacao,
                municipioNome: municipioName,
                municipioId: String(record?.COD || ''),
                estado: state || 'España',
                ano,
                fonte: 'INE España',
              };
            }
          }
        }
      }

      console.warn(`[Census ES] Município "${city}" não encontrado nos dados INE España`);
      return null;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn('[Census ES] Timeout (10s) ao consultar INE España');
      } else {
        console.warn('[Census ES] Erro ao consultar INE España:', (err as Error).message);
      }
      return null;
    }
  }

  getNationalPopulation(): number {
    return POPULACAO_ESPANHA;
  }

  getCountryName(): string {
    return 'Espanha';
  }
}
