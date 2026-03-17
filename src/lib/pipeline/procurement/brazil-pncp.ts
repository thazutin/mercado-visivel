// ============================================================================
// Brazil PNCP Adapter — Wraps buscarContratacoesPNCP into ProcurementAdapter
// Portal Nacional de Contratações Públicas (pncp.gov.br)
// ============================================================================

import type { ProcurementAdapter, ProcurementResult } from './procurement-adapter';
import { buscarContratacoesPNCP } from '../pncp';
import type { PNCPResumo } from '../pncp';

export class BrazilPNCPAdapter implements ProcurementAdapter {
  async searchContracts(product: string, region?: string): Promise<ProcurementResult | null> {
    const resumo: PNCPResumo | null = await buscarContratacoesPNCP(product, region);

    if (!resumo) {
      return null;
    }

    return {
      totalFound: resumo.totalEncontradas,
      contracts: resumo.contratacoes.map((c) => ({
        id: c.numeroContratacao,
        description: c.objeto,
        entity: c.orgaoEntidade,
        region: c.uf,
        category: c.modalidade,
        estimatedValue: c.valorEstimado,
        publishDate: c.dataPublicacao,
        status: c.situacao,
      })),
      totalEstimatedValue: resumo.valorTotalEstimado,
      categories: resumo.modalidades.map((m) => ({
        category: m.modalidade,
        count: m.count,
      })),
      uniqueEntities: resumo.orgaosUnicos,
      period: resumo.periodoConsultado,
      currency: 'BRL',
    };
  }
}
