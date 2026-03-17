// ============================================================================
// EU TED Adapter — Tenders Electronic Daily (ted.europa.eu)
// TODO: Implementar integração com TED API
// Docs: https://ted.europa.eu/en/simap/api
// ============================================================================

import type { ProcurementAdapter, ProcurementResult } from './procurement-adapter';

export class EUTedAdapter implements ProcurementAdapter {
  async searchContracts(product: string, region?: string): Promise<ProcurementResult | null> {
    // TODO: Implementar busca real na API TED Europa
    // - Endpoint: https://ted.europa.eu/api/v3.0/notices/search
    // - Filtrar por CPV codes, country, status
    // - Suporta múltiplos idiomas (EN, FR, DE, PT, etc.)
    console.warn(
      `[TED EU] Adapter ainda não implementado. Busca ignorada para product="${product}", region="${region ?? 'all'}"`,
    );
    return null;
  }
}
