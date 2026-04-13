// ============================================================================
// Virô Radar — Expanded Data Sources Orchestrator
// Roda fontes de dados adicionais em paralelo após o diagnóstico principal.
// Resultados são salvos no diagnosis_display.expandedData.
// ============================================================================

import { analyzeSeasonality } from './google-trends';
import { searchReclameAqui } from './reclame-aqui';
import { searchIFood } from './ifood';
import { checkAdsTransparency } from './google-ads-transparency';
import { analyzeInstagramCompetitors } from './instagram-expanded';
import type { Blueprint } from '@/lib/blueprints/types';
import { BLUEPRINT_MAP } from '@/lib/blueprints';

export interface ExpandedData {
  seasonality?: any;
  reclameAqui?: any;
  ifood?: any;
  adsTransparency?: any;
  instagramExpanded?: any;
  fetchedAt: string;
}

/**
 * Roda fontes expandidas em paralelo, baseado no blueprint.
 * Cada fonte só roda se o blueprint indicar que é relevante.
 * Timeout: 20s por fonte. Total: ~20s (paralelo).
 */
export async function fetchExpandedSources(
  blueprintId: string,
  lead: {
    name: string;
    product: string;
    region: string;
    instagram?: string;
  },
  diagnosis: any,
): Promise<ExpandedData> {
  const bp = BLUEPRINT_MAP[blueprintId];
  const promises: Promise<void>[] = [];
  const result: ExpandedData = { fetchedAt: new Date().toISOString() };

  const timeoutPromise = (p: Promise<any>, ms: number, fallback: any) =>
    Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);

  // 1. Seasonality (Google Trends) — pra todos que têm sazonalidade > low
  if (!bp || bp.seasonalityRelevance !== 'low') {
    const terms = (diagnosis.terms || [])
      .filter((t: any) => t.volume > 0)
      .map((t: any) => t.term)
      .slice(0, 3);
    if (terms.length > 0) {
      promises.push(
        timeoutPromise(analyzeSeasonality(terms), 20_000, null)
          .then((r: any) => { if (r) result.seasonality = r; }),
      );
    }
  }

  // 2. Reclame Aqui — pra b2c com presença que pode ter reclamações
  if (bp?.dataSources?.reclame_aqui) {
    promises.push(
      timeoutPromise(searchReclameAqui(lead.name || lead.product), 10_000, null)
        .then((r: any) => { if (r) result.reclameAqui = r; }),
    );
  }

  // 3. iFood — só pra restaurantes/food
  if (bp?.dataSources?.ifood) {
    const city = (lead.region || '').split(',')[0].trim();
    promises.push(
      timeoutPromise(searchIFood(lead.name || lead.product, city), 10_000, null)
        .then((r: any) => { if (r) result.ifood = r; }),
    );
  }

  // 4. Google Ads Transparency — pra todos com Google Ads como canal
  if (bp?.dataSources?.google_ads || bp?.channels?.includes('google_ads')) {
    const competitors = (diagnosis.competitorInstagram || [])
      .map((c: any) => c.handle)
      .concat(
        (diagnosis.maps?.mapsCompetitors || []).map((c: any) => c.name),
      )
      .filter(Boolean)
      .slice(0, 5);
    const serpData = diagnosis.terms?.map((t: any) => ({
      serpFeatures: t.serpFeatures || [],
    })) || [];
    if (competitors.length > 0) {
      promises.push(
        timeoutPromise(
          checkAdsTransparency(lead.name || lead.product, competitors, serpData),
          15_000, null,
        ).then((r: any) => { if (r) result.adsTransparency = r; }),
      );
    }
  }

  // 5. Instagram Expanded — pra todos com Instagram como canal
  if (bp?.dataSources?.instagram_competitors && diagnosis.competitorInstagram?.length > 0) {
    promises.push(
      timeoutPromise(
        analyzeInstagramCompetitors(
          lead.instagram?.replace('@', '') || null,
          diagnosis.instagram?.followers || 0,
          diagnosis.instagram?.engagementRate || 0,
          diagnosis.competitorInstagram || [],
          lead.product,
        ),
        15_000, null,
      ).then((r: any) => { if (r) result.instagramExpanded = r; }),
    );
  }

  console.log(`[ExpandedSources] Running ${promises.length} sources for blueprint ${blueprintId}...`);
  const t0 = Date.now();
  await Promise.allSettled(promises);
  console.log(`[ExpandedSources] Done in ${Date.now() - t0}ms`);

  return result;
}
