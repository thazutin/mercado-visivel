// ============================================================================
// US SAM.gov Adapter — Federal procurement data (sam.gov)
// TODO: Implementar integração com SAM.gov API
// Docs: https://open.gsa.gov/api/get-opportunities-public-api/
// ============================================================================

import type { ProcurementAdapter, ProcurementResult } from './procurement-adapter';

export class USSamAdapter implements ProcurementAdapter {
  async searchContracts(product: string, region?: string): Promise<ProcurementResult | null> {
    // TODO: Implementar busca real na API SAM.gov
    // - Obter API key em sam.gov
    // - Endpoint: https://api.sam.gov/opportunities/v2/search
    // - Filtrar por NAICS code, set-aside, status
    console.warn(
      `[SAM.gov] Adapter ainda não implementado. Busca ignorada para product="${product}", region="${region ?? 'all'}"`,
    );
    return null;
  }
}
