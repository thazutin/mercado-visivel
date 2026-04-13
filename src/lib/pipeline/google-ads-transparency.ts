// ============================================================================
// Virô Radar — Google Ads Detection (DADOS REAIS)
// Usa dados REAIS da SERP (serpFeatures) pra detectar quem investe em ads.
// Sem inferência, sem Claude. Só dados do scraping real.
// ============================================================================

export interface AdsTransparencyResult {
  searched: boolean;
  termsWithAds: number;        // quantos termos têm ads na SERP
  totalTerms: number;
  adsDetected: boolean;        // há concorrentes investindo nos seus termos?
  summary: string;
  source: 'serp_features';     // sempre real
}

/**
 * Analisa presença de ads nos resultados de SERP.
 * Usa SOMENTE dados reais do scraping (serpFeatures).
 * Não chama Claude, não infere, não chuta.
 */
export function analyzeAdsFromSerp(
  serpData: Array<{ term?: string; serpFeatures?: string[]; position?: string | number | null }>,
): AdsTransparencyResult {
  if (!serpData || serpData.length === 0) {
    return {
      searched: false,
      termsWithAds: 0,
      totalTerms: 0,
      adsDetected: false,
      summary: 'Sem dados de SERP disponíveis.',
      source: 'serp_features',
    };
  }

  const termsWithAds = serpData.filter(
    sp => sp.serpFeatures?.includes('ads') || sp.serpFeatures?.includes('paid'),
  );

  const adsDetected = termsWithAds.length > 0;
  const pct = Math.round((termsWithAds.length / serpData.length) * 100);

  let summary: string;
  if (!adsDetected) {
    summary = `Nenhum dos ${serpData.length} termos analisados tem anúncios pagos. Oportunidade: ser o primeiro a investir em ads pode capturar tráfego antes dos concorrentes.`;
  } else if (pct >= 70) {
    summary = `${termsWithAds.length} dos ${serpData.length} termos (${pct}%) têm anúncios pagos. Concorrência alta em ads — investir exige estratégia de termos de cauda longa.`;
  } else {
    summary = `${termsWithAds.length} dos ${serpData.length} termos (${pct}%) têm anúncios pagos. Há espaço pra investir em ads nos termos sem concorrência paga.`;
  }

  return {
    searched: true,
    termsWithAds: termsWithAds.length,
    totalTerms: serpData.length,
    adsDetected,
    summary,
    source: 'serp_features',
  };
}
