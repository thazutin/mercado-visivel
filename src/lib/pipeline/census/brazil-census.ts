// ============================================================================
// Brazil Census Adapter — Wrapper sobre lógica IBGE existente
// Usa getIBGEMunicipalData() de src/lib/pipeline/ibge.ts
// ============================================================================

import type { CensusAdapter, CensusResult } from './census-adapter';
import { getIBGEMunicipalData } from '../ibge';

const POPULACAO_BRASIL = 215_000_000;

export class BrazilCensusAdapter implements CensusAdapter {
  async getPopulation(city: string, state: string): Promise<CensusResult | null> {
    try {
      // Monta a região no formato esperado pelo IBGE (ex: "São Paulo, SP")
      const regionStr = state ? `${city}, ${state}` : city;
      const data = await getIBGEMunicipalData(city, regionStr);

      if (!data) {
        console.warn(`[Census BR] Município "${city}" não encontrado via IBGE`);
        return null;
      }

      return {
        populacao: data.populacao,
        municipioNome: data.municipio,
        municipioId: data.codigoIBGE,
        estado: data.estado,
        ano: new Date().getFullYear(), // IBGE retorna estimativa mais recente
        fonte: 'IBGE',
      };
    } catch (err) {
      console.error('[Census BR] Erro ao consultar IBGE:', err);
      return null;
    }
  }

  getNationalPopulation(): number {
    return POPULACAO_BRASIL;
  }

  getCountryName(): string {
    return 'Brasil';
  }
}
