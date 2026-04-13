// ============================================================================
// Virô Radar — Expanded Data Sources Orchestrator (DADOS REAIS)
// Roda fontes de dados adicionais em paralelo após o diagnóstico principal.
// CADA fonte é dado real — scrape, API pública, ou Google search.
// Nenhuma inferência de Claude.
// ============================================================================

import { analyzeSeasonality } from './google-trends';
import { searchReclameAqui } from './reclame-aqui';
import { searchIFood } from './ifood';
import { analyzeAdsFromSerp } from './google-ads-transparency';
import { analyzeInstagramCompetitors } from './instagram-expanded';
import { searchMercadoLivre } from './mercado-livre';
import { searchLinkedIn } from './linkedin';
import { BLUEPRINT_MAP } from '@/lib/blueprints';

export interface ExpandedData {
  seasonality?: any;
  reclameAqui?: any;
  ifood?: any;
  mercadoLivre?: any;
  adsTransparency?: any;
  instagramExpanded?: any;
  linkedin?: any;
  fetchedAt: string;
  sources: string[];   // lista de fontes que retornaram dados reais
}

/**
 * Roda fontes expandidas em paralelo, baseado no blueprint.
 * Cada fonte só roda se o blueprint indicar que é relevante.
 * Timeout: 20s por fonte. Total: ~20s (paralelo).
 * ZERO INFERÊNCIA. Se não tem dado, retorna null.
 */
export async function fetchExpandedSources(
  blueprintId: string,
  lead: {
    name: string;
    product: string;
    region: string;
    instagram?: string;
    linkedin?: string;
    site?: string;
    sales_channel?: string;
  },
  diagnosis: any,
): Promise<ExpandedData> {
  const bp = BLUEPRINT_MAP[blueprintId];
  const promises: Promise<void>[] = [];
  const result: ExpandedData = { fetchedAt: new Date().toISOString(), sources: [] };
  const city = (lead.region || '').split(',')[0].trim();

  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))]);

  // 1. Seasonality (Google Trends Apify) — pra todos exceto low relevance
  if (!bp || bp.seasonalityRelevance !== 'low') {
    const terms = (diagnosis.terms || [])
      .filter((t: any) => t.volume > 0)
      .map((t: any) => t.term)
      .slice(0, 3);
    if (terms.length > 0) {
      promises.push(
        withTimeout(analyzeSeasonality(terms), 30_000, null)
          .then((r: any) => { if (r?.source !== 'unavailable') { result.seasonality = r; result.sources.push('google_trends'); } }),
      );
    }
  }

  // 2. Reclame Aqui — pra quem pode ter reclamações
  if (bp?.dataSources?.reclame_aqui) {
    promises.push(
      withTimeout(searchReclameAqui(lead.name || lead.product), 10_000, null)
        .then((r: any) => { if (r?.found) { result.reclameAqui = r; result.sources.push('reclame_aqui'); } }),
    );
  }

  // 3. iFood — só pra food
  if (bp?.dataSources?.ifood) {
    promises.push(
      withTimeout(searchIFood(lead.name || lead.product, city), 10_000, null)
        .then((r: any) => { if (r?.found) { result.ifood = r; result.sources.push('ifood'); } }),
    );
  }

  // 4. Mercado Livre — pra ecommerce/marketplace
  if (bp?.dataSources?.mercado_livre || lead.sales_channel === 'marketplace') {
    promises.push(
      withTimeout(searchMercadoLivre(lead.name || lead.product, lead.product), 15_000, null)
        .then((r: any) => { if (r?.found) { result.mercadoLivre = r; result.sources.push('mercado_livre'); } }),
    );
  }

  // 5. Google Ads — dados reais da SERP (síncrono, sem API)
  const serpData = (diagnosis.terms || []).map((t: any) => ({
    term: t.term,
    serpFeatures: t.serpFeatures || [],
    position: t.position,
  }));
  if (serpData.length > 0) {
    const adsResult = analyzeAdsFromSerp(serpData);
    if (adsResult.searched) {
      result.adsTransparency = adsResult;
      result.sources.push('serp_ads');
    }
  }

  // 6. Instagram Expanded — dados reais do scraping
  if (bp?.dataSources?.instagram_competitors && diagnosis.competitorInstagram?.length > 0) {
    const igResult = analyzeInstagramCompetitors(
      lead.instagram?.replace('@', '') || null,
      diagnosis.instagram?.followers || 0,
      diagnosis.instagram?.engagementRate || 0,
      diagnosis.instagram?.postsLast30d || 0,
      diagnosis.instagram?.avgLikes || 0,
      diagnosis.competitorInstagram || [],
    );
    if (igResult.gaps.length > 0 || igResult.competitors.length > 0) {
      result.instagramExpanded = igResult;
      result.sources.push('instagram_scrape');
    }
  }

  // 7. LinkedIn — pra B2B
  if (bp?.dataSources?.linkedin || bp?.primaryClientType === 'b2b') {
    promises.push(
      withTimeout(
        searchLinkedIn(lead.name || lead.product, lead.linkedin, lead.name),
        15_000, null,
      ).then((r: any) => {
        if (r?.companyPage?.found || r?.founderProfile?.found) {
          result.linkedin = r;
          result.sources.push('linkedin');
        }
      }),
    );
  }

  console.log(`[ExpandedSources] Running ${promises.length} async sources + ${result.sources.length} sync for blueprint ${blueprintId}...`);
  const t0 = Date.now();
  await Promise.allSettled(promises);
  console.log(`[ExpandedSources] Done in ${Date.now() - t0}ms. Sources with data: ${result.sources.join(', ') || 'none'}`);

  return result;
}
