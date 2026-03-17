// ============================================================================
// Procurement Factory — Retorna o adapter correto baseado no identificador
// ============================================================================

export type { ProcurementAdapter, ProcurementResult, ProcurementContract } from './procurement-adapter';

export type ProcurementApiId = 'pncp' | 'sam_gov' | 'ted_eu' | 'base_pt';

import type { ProcurementAdapter } from './procurement-adapter';
import { BrazilPNCPAdapter } from './brazil-pncp';
import { USSamAdapter } from './us-sam';
import { EUTedAdapter } from './eu-ted';
import { PortugalBaseAdapter } from './portugal-base';

/**
 * Factory que retorna o adapter de contratações públicas correto.
 * Retorna null se procurementApi for null/undefined (país sem suporte).
 */
export function getProcurementAdapter(
  procurementApi: ProcurementApiId | null | undefined,
): ProcurementAdapter | null {
  if (!procurementApi) return null;

  switch (procurementApi) {
    case 'pncp':
      return new BrazilPNCPAdapter();
    case 'sam_gov':
      return new USSamAdapter();
    case 'ted_eu':
      return new EUTedAdapter();
    case 'base_pt':
      return new PortugalBaseAdapter();
    default: {
      const _exhaustive: never = procurementApi;
      console.warn(`[Procurement] Adapter desconhecido: ${_exhaustive}`);
      return null;
    }
  }
}
