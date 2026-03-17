// ============================================================================
// Portugal BASE Adapter — Portal de contratos públicos (base.gov.pt)
// TODO: Implementar integração com BASE.gov.pt API
// Docs: https://www.base.gov.pt/Base4/pt/api/
// ============================================================================

import type { ProcurementAdapter, ProcurementResult } from './procurement-adapter';

export class PortugalBaseAdapter implements ProcurementAdapter {
  async searchContracts(product: string, region?: string): Promise<ProcurementResult | null> {
    // TODO: Implementar busca real na API BASE.gov.pt
    // - Endpoint: https://www.base.gov.pt/Base4/pt/api/contratos
    // - Filtrar por CPV, distrito, tipo de procedimento
    // - Dados em português
    console.warn(
      `[BASE.gov.pt] Adapter ainda não implementado. Busca ignorada para product="${product}", region="${region ?? 'all'}"`,
    );
    return null;
  }
}
