// ============================================================================
// Procurement Adapter — Interface genérica para APIs de contratações públicas
// Permite internacionalização: cada país implementa seu adapter
// ============================================================================

export interface ProcurementContract {
  id: string;
  description: string;
  entity: string;
  region: string;
  category: string;
  estimatedValue: number;
  publishDate: string;
  status: string;
}

export interface ProcurementResult {
  totalFound: number;
  contracts: ProcurementContract[];
  totalEstimatedValue: number;
  categories: { category: string; count: number }[];
  uniqueEntities: number;
  period: string;
  currency: 'BRL' | 'USD' | 'EUR';
}

export interface ProcurementAdapter {
  searchContracts(product: string, region?: string): Promise<ProcurementResult | null>;
}
