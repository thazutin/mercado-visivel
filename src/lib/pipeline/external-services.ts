// ============================================================================
// External Service Wrappers
// Interfaces prontas pra plugar com API keys reais
// Cada wrapper: configuração, chamada, parsing de resposta, cache
// ============================================================================

import type {
  TermVolumeData,
  MonthlyDataPoint,
  SerpPosition,
  MapsPresence,
  OrganicPresence,
  InstagramProfile,
  WebInfluence,
} from '../types/pipeline.types';

// --- CACHE HELPERS ---

interface CacheConfig {
  supabaseClient: any;  // SupabaseClient type
}

async function getCached<T>(
  config: CacheConfig,
  cacheKey: string,
): Promise<T | null> {
  const { data } = await config.supabaseClient
    .from('search_cache')
    .select('data')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (data) {
    // Update hit count
    await config.supabaseClient
      .from('search_cache')
      .update({ hit_count: data.hit_count + 1, last_hit_at: new Date().toISOString() })
      .eq('cache_key', cacheKey);
    return data.data as T;
  }
  return null;
}

async function setCache(
  config: CacheConfig,
  cacheKey: string,
  source: string,
  data: any,
  ttlDays: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  await config.supabaseClient
    .from('search_cache')
    .upsert({
      cache_key: cacheKey,
      source,
      data,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
      hit_count: 0,
    }, { onConflict: 'cache_key' });
}

// ============================================================================
// APIFY WRAPPER
// ============================================================================

interface ApifyConfig {
  apiToken: string;
  cache?: CacheConfig;
}

/**
 * Generic Apify actor runner.
 * Actors são identificados por ID do marketplace (e.g. "apify/google-search-scraper").
 */
async function runApifyActor(
  config: ApifyConfig,
  actorId: string,
  input: Record<string, any>,
  timeoutSecs: number = 60,
): Promise<any[]> {
  // timeout query param = server-side limit (Apify aborts the actor run after this)
  // AbortSignal.timeout = client-side limit (abort fetch if server doesn't respond)
  // Client-side gets 5s extra margin so Apify can return a partial/error response
  const serverTimeout = timeoutSecs;
  const clientTimeout = timeoutSecs + 5;

  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${config.apiToken}&timeout=${serverTimeout}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(clientTimeout * 1000),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body');
    throw new Error(`Apify actor ${actorId} failed: ${response.status} ${response.statusText} — ${errorBody.slice(0, 200)}`);
  }

  return response.json();
}

// --- GOOGLE SERP SCRAPER ---

export function createApifySerpScraper(config: ApifyConfig) {
  return async function runSerpScraper(
    terms: string[],
    region: string,
    targetDomain?: string,
  ): Promise<SerpPosition[]> {
    // Check cache first
    const cacheKey = `serp:${terms.sort().join('+')}:${region}`;
    if (config.cache) {
      const cached = await getCached<SerpPosition[]>(config.cache, cacheKey);
      if (cached) return cached;
    }

    // Actor: apify~google-search-scraper (official Apify SERP scraper)
    // Docs: https://apify.com/apify/google-search-scraper
    const results = await runApifyActor(config, 'apify~google-search-scraper', {
      queries: terms.join('\n'),
      countryCode: 'br',
      maxPagesPerQuery: 1,
      includeUnfilteredResults: false,
    }, 40);

    // Parse results → SerpPosition[]
    const positions: SerpPosition[] = terms.map(term => {
      const searchResult = results.find((r: any) => 
        r.searchQuery?.term?.toLowerCase() === term.toLowerCase()
      );

      if (!searchResult) {
        return {
          term,
          position: null,
          serpFeatures: [],
        };
      }

      // Find business in organic results
      let position: number | null = null;
      let url: string | undefined;

      if (targetDomain) {
        const organicResults = searchResult.organicResults || [];
        for (let i = 0; i < organicResults.length; i++) {
          const resultUrl = organicResults[i].url || organicResults[i].link || '';
          if (resultUrl.includes(targetDomain)) {
            position = i + 1;
            url = resultUrl;
            break;
          }
        }
      }

      // Detect SERP features
      const serpFeatures: string[] = [];
      if (searchResult.localResults?.length > 0) serpFeatures.push('local_pack');
      if (searchResult.featuredSnippet) serpFeatures.push('featured_snippet');
      if (searchResult.paidResults?.length > 0) serpFeatures.push('ads');
      if (searchResult.peopleAlsoAsk?.length > 0) serpFeatures.push('people_also_ask');

      return { term, position, url, serpFeatures };
    });

    // Cache for 7 days
    if (config.cache) {
      await setCache(config.cache, cacheKey, 'apify_serp', positions, 7);
    }

    return positions;
  };
}

// --- GOOGLE MAPS SCRAPER ---

export function createApifyMapsScraper(config: ApifyConfig) {
  return async function runMapsScraper(
    businessName: string,
    region: string,
    radiusMeters?: number,
    options?: {
      expectedLat?: number | null;
      expectedLng?: number | null;
      expectedSite?: string | null;
    },
  ): Promise<MapsPresence> {
    const cacheKey = `maps:${businessName}:${region}:${options?.expectedLat || ''}:${options?.expectedSite || ''}`;
    if (config.cache) {
      const cached = await getCached<MapsPresence>(config.cache, cacheKey);
      if (cached) return cached;
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('[Maps] GOOGLE_PLACES_API_KEY não configurada');
      return { found: false, businessName: null, inLocalPack: false };
    }

    // Helpers de validação
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };
    const normalizeDomain = (url: string | null | undefined): string => {
      if (!url) return '';
      try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      }
    };
    const normalizeName = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const expectedDomain = normalizeDomain(options?.expectedSite || '');
    const expectedNameNorm = normalizeName(businessName);

    try {
      // 1. Text Search — busca o negócio por nome + região
      // Quando temos lat/lng do usuário, usa locationBias circular pra restringir.
      const locationBias =
        options?.expectedLat && options?.expectedLng
          ? {
              circle: {
                center: { latitude: options.expectedLat, longitude: options.expectedLng },
                radius: radiusMeters || 5000,
              },
            }
          : radiusMeters
          ? { circle: { radius: radiusMeters } }
          : undefined;

      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.location,places.websiteUri,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos,places.reviews',
        },
        body: JSON.stringify({
          textQuery: `${businessName} ${region}`,
          languageCode: 'pt-BR',
          maxResultCount: 10,
          ...(locationBias ? { locationBias } : {}),
        }),
      });

      if (!searchRes.ok) {
        const errBody = await searchRes.text();
        console.error('[Maps] Text Search falhou:', searchRes.status, errBody);
        return { found: false, businessName: null, inLocalPack: false };
      }

      const searchData = await searchRes.json();
      const places = searchData.places || [];

      if (places.length === 0) {
        const notFound: MapsPresence = { found: false, businessName: null, inLocalPack: false };
        if (config.cache) await setCache(config.cache, cacheKey, 'google_places', notFound, 14);
        return notFound;
      }

      // ─── Validação: escolher o melhor candidato em vez de pegar places[0] ───
      // Score por candidato:
      //   +50 se domain do website bate com expectedSite (sinal mais forte)
      //   +30 se distância < 1km do expectedLat/Lng
      //   +20 se distância 1-5km
      //   +25 se nome normalizado é match exato com businessName
      //   +15 se nome normalizado contém o businessName (substring)
      //   +5  pra primeiro resultado (tie-breaker leve, mantém ordem do Google)
      // Threshold mínimo pra aceitar: 25 (sem nenhum sinal forte → reject)
      const scored = places.map((p: any, idx: number) => {
        let score = idx === 0 ? 5 : 0;
        const reasons: string[] = [];

        // Site match
        if (expectedDomain) {
          const placeDomain = normalizeDomain(p.websiteUri || '');
          if (placeDomain && placeDomain === expectedDomain) {
            score += 50;
            reasons.push(`site=${placeDomain}`);
          }
        }

        // Distance match
        if (options?.expectedLat && options?.expectedLng && p.location?.latitude && p.location?.longitude) {
          const distKm = haversineKm(
            options.expectedLat,
            options.expectedLng,
            p.location.latitude,
            p.location.longitude,
          );
          if (distKm < 1) {
            score += 30;
            reasons.push(`dist=${distKm.toFixed(2)}km`);
          } else if (distKm < 5) {
            score += 20;
            reasons.push(`dist=${distKm.toFixed(2)}km`);
          } else {
            reasons.push(`dist=${distKm.toFixed(1)}km(far)`);
          }
        }

        // Name match
        const candidateName = normalizeName(p.displayName?.text || '');
        if (candidateName === expectedNameNorm) {
          score += 25;
          reasons.push('name=exact');
        } else if (candidateName.includes(expectedNameNorm) || expectedNameNorm.includes(candidateName)) {
          score += 15;
          reasons.push('name=substring');
        }

        return { place: p, score, reasons };
      });

      scored.sort((a: any, b: any) => b.score - a.score);
      const best = scored[0];
      const MIN_SCORE = 25;

      console.log(
        `[Maps] candidates for "${businessName}":`,
        scored
          .slice(0, 3)
          .map((s: any) => `${(s.place.displayName?.text || '?').slice(0, 30)} score=${s.score} [${s.reasons.join(',')}]`)
          .join(' | '),
      );

      if (!best || best.score < MIN_SCORE) {
        console.warn(
          `[Maps] best score ${best?.score || 0} < ${MIN_SCORE} → rejecting all candidates (likely wrong business)`,
        );
        const notFound: MapsPresence = { found: false, businessName: null, inLocalPack: false };
        if (config.cache) await setCache(config.cache, cacheKey, 'google_places', notFound, 14);
        return notFound;
      }

      const match = best.place;
      const placeId = match.id;

      // 2. Place Details — busca campos extras (website, telefone, horário)
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,rating,userRatingCount,types,photos,websiteUri,nationalPhoneNumber,regularOpeningHours,reviews',
        },
      });

      let details: any = null;
      if (detailsRes.ok) {
        details = await detailsRes.json();
      } else {
        console.warn('[Maps] Place Details falhou, usando dados do Text Search');
      }

      const source = details || match;

      // Analisa reviews para owner response rate
      const reviews = source.reviews || [];
      const ownerResponseCount = reviews.filter((r: any) => r.authorAttribution && r.ownerResponse).length;
      const ownerResponseRate = reviews.length > 0 ? ownerResponseCount / reviews.length : null;
      const topReviews = reviews.slice(0, 3).map((r: any) => ({
        rating: r.rating || 0,
        hasOwnerResponse: !!r.ownerResponse,
        snippet: r.text?.text?.slice(0, 100) || '',
      }));

      // Reviews completas pro co-pilot de resposta (cap 20, ignora já respondidas)
      const crypto = await import('crypto');
      const scrapedReviews = reviews
        .filter((r: any) => !r.ownerResponse && r.text?.text)
        .slice(0, 20)
        .map((r: any) => {
          const authorName = r.authorAttribution?.displayName || null;
          const text = r.text?.text || '';
          const date = r.publishTime || null;
          const hashInput = `${authorName || 'anon'}|${date || ''}|${text.slice(0, 50)}`;
          const externalId = crypto
            .createHash('sha1')
            .update(hashInput)
            .digest('hex')
            .slice(0, 16);
          return {
            externalId,
            authorName,
            rating: r.rating || 0,
            text,
            date,
            hasOwnerResponse: false,
          };
        });

      const presence: MapsPresence = {
        found: true,
        businessName: source.displayName?.text || null,
        rating: source.rating,
        reviewCount: source.userRatingCount,
        photoCount: source.photos?.length || 0,
        ownerResponseRate: ownerResponseRate,
        ownerResponseCount: ownerResponseCount,
        reviewsAnalyzed: reviews.length,
        topReviews: topReviews,
        reviews: scrapedReviews,
        categories: source.types || [],
        inLocalPack: true,
        localPackPosition: 1,
        photos: source.photos?.length || 0,
        website: details?.websiteUri,
        phone: details?.nationalPhoneNumber,
        openNow: details?.regularOpeningHours?.openNow,
        mapsCompetitors: places.slice(1).map((c: any) => ({
          name: c.displayName?.text || '',
          rating: c.rating || null,
          reviewCount: c.userRatingCount || null,
          photoCount: c.photos?.length || 0,
          categories: c.types?.slice(0, 3) || [],
          website: c.websiteUri || null,
        })),
      };

      if (config.cache) {
        await setCache(config.cache, cacheKey, 'google_places', presence, 14);
      }

      return presence;
    } catch (err) {
      console.error('[Maps] Erro ao consultar Google Places API:', err);
      return { found: false, businessName: null, inLocalPack: false };
    }
  };
}

// --- MAPS COMPETITION SEARCH (para Competition Index) ---

export function createMapsCompetitionSearch(config: ApifyConfig) {
  return async function searchCompetitors(
    product: string,
    region: string,
  ): Promise<{ name: string; website: string; rating?: number; reviewCount?: number }[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return [];

    try {
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.types,places.photos,places.websiteUri,places.location',
        },
        body: JSON.stringify({
          textQuery: `${product} ${region}`,
          languageCode: 'pt-BR',
          maxResultCount: 20,
        }),
      });

      if (!searchRes.ok) {
        console.error('[MapsCompetition] Search failed:', searchRes.status);
        return [];
      }

      const data = await searchRes.json();
      const places = data.places || [];
      console.log(`[MapsCompetition] Found ${places.length} competitors for "${product}" in "${region}"`);

      return places.map((p: any) => ({
        name: p.displayName?.text || '',
        website: p.websiteUri || '',
        rating: p.rating,
        reviewCount: p.userRatingCount,
        photoCount: p.photos?.length || 0,
        categories: p.types?.slice(0, 3) || [],
        lat: p.location?.latitude || null,
        lng: p.location?.longitude || null,
      }));
    } catch (err) {
      console.error('[MapsCompetition] Error:', err);
      return [];
    }
  };
}

// --- PERPLEXITY AI VISIBILITY CHECKER (5 dimensões geográficas) ---

export interface PerplexityDimensionResult {
  mentioned: boolean;
  context?: string;
}

export interface PerplexityVisibilityResult {
  mentioned: boolean;
  bestDimension: string | null;
  dimensions: {
    street?: PerplexityDimensionResult;
    neighborhood?: PerplexityDimensionResult;
    city?: PerplexityDimensionResult;
    region?: PerplexityDimensionResult;
    state?: PerplexityDimensionResult;
  };
  rawResponses: string[];
}

export interface GeoDimensions {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
}

function removeAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function checkMentionInResponse(
  rawResponse: string,
  businessName: string | null,
  instagramHandle: string | null,
): { mentioned: boolean; context?: string } {
  const normalizedResponse = removeAccents(rawResponse);

  if (businessName) {
    const normalizedName = removeAccents(businessName);
    if (normalizedName.length > 2 && normalizedResponse.includes(normalizedName)) {
      const idx = normalizedResponse.indexOf(normalizedName);
      const start = Math.max(0, idx - 60);
      const end = Math.min(rawResponse.length, idx + normalizedName.length + 60);
      return { mentioned: true, context: rawResponse.substring(start, end) };
    }
  }

  if (instagramHandle) {
    const cleanHandle = removeAccents(instagramHandle.replace('@', ''));
    if (cleanHandle.length > 3 && normalizedResponse.includes(cleanHandle)) {
      const idx = normalizedResponse.indexOf(cleanHandle);
      const start = Math.max(0, idx - 60);
      const end = Math.min(rawResponse.length, idx + cleanHandle.length + 60);
      return { mentioned: true, context: rawResponse.substring(start, end) };
    }
  }

  return { mentioned: false };
}

async function queryPerplexity(
  apiKey: string,
  product: string,
  dimensionValue: string,
): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Responda APENAS em JSON válido. Sem texto adicional fora do JSON.',
        },
        {
          role: 'user',
          content: `Quais são os melhores negócios de ${product} em ${dimensionValue}? Liste os 5 principais com nome.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[Perplexity] Chamada falhou:', res.status, errBody);
    return '';
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export function createPerplexityAIVisibilityChecker(
  claudeClient: { createMessage: (params: any) => Promise<any> },
) {
  return async function checkAIVisibility(
    product: string,
    region: string,
    businessName: string | null,
    instagramHandle: string | null,
  ): Promise<PerplexityVisibilityResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    const emptyResult: PerplexityVisibilityResult = {
      mentioned: false, bestDimension: null, dimensions: {}, rawResponses: [],
    };

    if (!apiKey) {
      console.warn('[Perplexity] PERPLEXITY_API_KEY não configurada');
      return emptyResult;
    }

    try {
      // 1. Extrair dimensões geográficas via Claude Haiku
      let geoDimensions: GeoDimensions = {
        street: null, neighborhood: null, city: null, region: null, state: null,
      };

      try {
        const geoRes = await claudeClient.createMessage({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `A partir deste endereço/região: '${region}', extraia em JSON as dimensões geográficas: { "street": "...", "neighborhood": "...", "city": "...", "region": "...", "state": "..." }. Retorne apenas o JSON, sem explicações. Use null para dimensões não identificáveis. O campo "region" é a mesorregião ou região metropolitana (ex: "ABC Paulista", "Vale do Paraíba").`,
          }],
        });
        const geoText = (geoRes.content as any[]).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
        const cleaned = geoText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        geoDimensions = {
          street: parsed.street || null,
          neighborhood: parsed.neighborhood || null,
          city: parsed.city || null,
          region: parsed.region || null,
          state: parsed.state || null,
        };
      } catch (err) {
        console.warn('[Perplexity] Geo extraction failed, using region as city:', err);
        geoDimensions.city = region.split(',')[0].trim();
      }

      console.log('[Perplexity] Dimensões geográficas:', JSON.stringify(geoDimensions));

      // 2. Query Perplexity em paralelo para cada dimensão com valor
      type DimKey = keyof GeoDimensions;
      const dimEntries: [DimKey, string][] = (Object.entries(geoDimensions) as [DimKey, string | null][])
        .filter((e): e is [DimKey, string] => e[1] !== null && e[1].length > 1);

      const perplexityResults = await Promise.allSettled(
        dimEntries.map(([_, value]) => queryPerplexity(apiKey, product, value))
      );

      // 3. Consolidar resultados
      const dimensions: PerplexityVisibilityResult['dimensions'] = {};
      const rawResponses: string[] = [];

      for (let i = 0; i < dimEntries.length; i++) {
        const [dimKey] = dimEntries[i];
        const result = perplexityResults[i];
        const rawResponse = result.status === 'fulfilled' ? result.value : '';
        rawResponses.push(rawResponse);

        if (rawResponse) {
          dimensions[dimKey] = checkMentionInResponse(rawResponse, businessName, instagramHandle);
        } else {
          dimensions[dimKey] = { mentioned: false };
        }
      }

      // 4. Determinar melhor dimensão
      const dimPriority: DimKey[] = ['street', 'neighborhood', 'city', 'region', 'state'];
      let bestDimension: string | null = null;
      let mentioned = false;

      for (const dim of dimPriority) {
        if (dimensions[dim]?.mentioned) {
          mentioned = true;
          bestDimension = dim;
          break;
        }
      }

      return { mentioned, bestDimension, dimensions, rawResponses };
    } catch (err) {
      console.error('[Perplexity] Erro ao consultar API:', err);
      return emptyResult;
    }
  };
}

// --- GOOGLE TRENDS SCRAPER ---

export function createApifyTrendsScraper(config: ApifyConfig) {
  return async function runGoogleTrends(
    terms: string[],
    region: string,
  ): Promise<{ term: string; monthlyTrend: MonthlyDataPoint[] }[]> {
    // Google Trends aceita max 5 termos por comparação
    const termsToSearch = terms.slice(0, 5);
    const cacheKey = `trends:${termsToSearch.sort().join('+')}:${region}`;

    if (config.cache) {
      const cached = await getCached<any>(config.cache, cacheKey);
      if (cached) return cached;
    }

    // Actor: epctex~google-trends-scraper
    const results = await runApifyActor(config, 'epctex~google-trends-scraper', {
      searchTerms: termsToSearch,
      geo: 'BR',             // Ajustar por região
      timeRange: 'past12Months',
      category: 0,           // All categories
    });

    // Parse → monthly trend data
    const trendData = termsToSearch.map(term => {
      const termResult = results.find((r: any) => r.term === term || r.keyword === term);
      const timeline = termResult?.timelineData || termResult?.interest || [];

      const monthlyTrend: MonthlyDataPoint[] = timeline.map((point: any) => ({
        month: point.date || point.formattedTime,
        volume: point.value || point.interest || 0,
        isRelative: true,  // Trends retorna índice 0-100, não volume absoluto
      }));

      return { term, monthlyTrend };
    });

    if (config.cache) {
      await setCache(config.cache, cacheKey, 'google_trends', trendData, 7);
    }

    return trendData;
  };
}

// --- INSTAGRAM SCRAPER ---

export function createApifyInstagramScraper(config: ApifyConfig) {
  return async function runInstagramScraper(
    handles: string[],
  ): Promise<InstagramProfile[]> {
    // Instagram handles são case-insensitive — sempre normalizar para lowercase
    // antes de montar a URL, senão o Apify Instagram scraper retorna 0 dados
    // pra handles digitados com maiúsculas (ex: "Efbrasil" vs "efbrasil").
    const cleanHandles = handles.map(h =>
      h
        .replace(/^@/, '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/.*$/, '')
        .trim()
        .toLowerCase()
    );

    // Check cache per handle
    const cached: InstagramProfile[] = [];
    const toFetch: string[] = [];

    for (const handle of cleanHandles) {
      if (config.cache) {
        const c = await getCached<InstagramProfile>(config.cache, `ig:${handle}`);
        if (c) { cached.push(c); continue; }
      }
      toFetch.push(handle);
    }

    if (toFetch.length === 0) return cached;

    const urls = toFetch.map(h => `https://www.instagram.com/${h}/`);

    // Two parallel calls: profile details + posts
    // Internal timeout = 50s each (fits within 60s outer withTimeout with margin)
    const [detailsResult, postsResult] = await Promise.allSettled([
      // Call 1: Profile details (followers, bio, etc.)
      runApifyActor(config, 'apify~instagram-scraper', {
        directUrls: urls,
        resultsType: 'details',
        resultsLimit: 1,
      }, 50),

      // Call 2: Posts (captions, likes, views, timestamps)
      runApifyActor(config, 'apify~instagram-scraper', {
        directUrls: urls,
        resultsType: 'posts',
        resultsLimit: 20,  // Last 20 posts per profile
      }, 50),
    ]);

    const details = detailsResult.status === 'fulfilled' ? detailsResult.value : [];
    const posts = postsResult.status === 'fulfilled' ? postsResult.value : [];

    if (detailsResult.status === 'rejected') {
      console.warn('[Instagram] Details call failed:', detailsResult.reason?.message || detailsResult.reason);
    }
    if (postsResult.status === 'rejected') {
      console.warn('[Instagram] Posts call failed:', postsResult.reason?.message || postsResult.reason);
    }

    // Log RAW data from Apify before transformation
    console.log(`[Instagram RAW] details count=${details.length}, posts count=${posts.length}`);
    if (details.length > 0) {
      const sample = details[0];
      console.log(`[Instagram RAW] details[0] keys: ${Object.keys(sample).join(', ')}`);
      console.log(`[Instagram RAW] details[0] sample: username=${sample.username}, ownerUsername=${sample.ownerUsername}, followersCount=${sample.followersCount}, followers=${sample.followers}, followedByCount=${sample.followedByCount}, id=${sample.id}`);
    }
    if (posts.length > 0) {
      const sample = posts[0];
      console.log(`[Instagram RAW] posts[0] keys: ${Object.keys(sample).join(', ')}`);
      console.log(`[Instagram RAW] posts[0] sample: ownerUsername=${sample.ownerUsername}, username=${sample.username}, likesCount=${sample.likesCount}, likes=${sample.likes}, videoViewCount=${sample.videoViewCount}, videoPlayCount=${sample.videoPlayCount}, type=${sample.type}, timestamp=${sample.timestamp}, takenAt=${sample.takenAt}`);
    }

    // Parse results → InstagramProfile[]
    const profiles: InstagramProfile[] = toFetch.map(handle => {
      // Find profile in details results (try multiple field patterns)
      const handleLower = handle.toLowerCase();
      const profileData = details.find((r: any) =>
        (r.username || '').toLowerCase() === handleLower ||
        (r.ownerUsername || '').toLowerCase() === handleLower ||
        (r.id || '').toLowerCase().includes(handleLower) ||
        (r.url || '').toLowerCase().includes(handleLower) ||
        (r.inputUrl || '').toLowerCase().includes(`/${handleLower}`)
      );

      // Find posts for this handle (case-insensitive matching)
      const handlePosts = posts.filter((r: any) =>
        (r.ownerUsername || '').toLowerCase() === handleLower ||
        (r.username || '').toLowerCase() === handleLower ||
        (r.profileUrl || '').toLowerCase().includes(`/${handleLower}`) ||
        (r.inputUrl || '').toLowerCase().includes(`/${handleLower}`)
      );

      console.log(`[Instagram] @${handle}: profileData found=${!!profileData}, posts matched=${handlePosts.length}/${posts.length}`);

      const followers = profileData?.followersCount || profileData?.followers || profileData?.followedByCount || profileData?.edge_followed_by?.count || profileData?.userInfo?.followersCount || 0;
      const bio = profileData?.biography || profileData?.bio || profileData?.userInfo?.biography || '';
      const isPrivate = profileData?.isPrivate || profileData?.private || false;
      const fullName = profileData?.fullName || profileData?.name || profileData?.userInfo?.fullName || handle;
      const isBusiness = profileData?.isBusinessAccount || profileData?.isBusiness || false;

      if (profileData) {
        console.log(`[Instagram Parser] @${handle} field check: followersCount=${profileData.followersCount}, followers=${profileData.followers}, followedByCount=${profileData.followedByCount}, edge_followed_by=${profileData.edge_followed_by?.count}, resolved=${followers}`);
      }

      if (!profileData && handlePosts.length === 0) {
        return {
          handle,
          name: handle,
          isBusinessProfile: false,
          followers: 0,
          reachAbsolute: 0,
          reachRelative: 0,
          engagementRate: 0,
          postsLast30d: 0,
          avgLikesLast30d: 0,
          avgViewsReelsLast30d: 0,
          recentPostsCount: 0,
          recentAvgReach: 0,
          recentEngagementRate: 0,
          bio: '',
          lastPostsCaptions: [],
          isPrivate: false,
          dataAvailable: false,
        };
      }

      // Calculate metrics from posts (last 30 days + last 15 days)
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

      const getPostTimestamp = (p: any) =>
        new Date(p.timestamp || p.takenAt || p.takenAtTimestamp * 1000 || 0).getTime();

      const recentPosts = handlePosts.filter((p: any) => getPostTimestamp(p) > thirtyDaysAgo);
      const recentPosts15d = handlePosts.filter((p: any) => getPostTimestamp(p) > fifteenDaysAgo);

      // Reels/videos
      const reels = handlePosts.filter((p: any) =>
        p.type === 'Video' || p.videoViewCount || p.videoPlayCount || p.videoUrl
      );
      const avgViews = reels.length > 0
        ? reels.reduce((s: number, p: any) => s + (p.videoViewCount || p.videoPlayCount || p.viewCount || 0), 0) / reels.length
        : 0;

      // Likes
      const postsWithLikes = handlePosts.filter((p: any) => (p.likesCount || p.likes || 0) > 0);
      const avgLikes = postsWithLikes.length > 0
        ? postsWithLikes.reduce((s: number, p: any) => s + (p.likesCount || p.likes || 0), 0) / postsWithLikes.length
        : 0;

      // Comments
      const avgComments = handlePosts.length > 0
        ? handlePosts.reduce((s: number, p: any) => s + (p.commentsCount || p.comments || 0), 0) / handlePosts.length
        : 0;

      const reachAbsolute = avgViews || avgLikes;  // Use views if available, otherwise likes as proxy
      const reachRelative = followers > 0 ? reachAbsolute / followers : 0;
      const engagementRate = reachAbsolute > 0 ? avgLikes / reachAbsolute : (followers > 0 ? avgLikes / followers : 0);

      // Recência: métricas dos últimos 15 dias
      const reels15d = recentPosts15d.filter((p: any) =>
        p.type === 'Video' || p.videoViewCount || p.videoPlayCount || p.videoUrl
      );
      const avgViews15d = reels15d.length > 0
        ? reels15d.reduce((s: number, p: any) => s + (p.videoViewCount || p.videoPlayCount || p.viewCount || 0), 0) / reels15d.length
        : 0;
      const likes15d = recentPosts15d.filter((p: any) => (p.likesCount || p.likes || 0) > 0);
      const avgLikes15d = likes15d.length > 0
        ? likes15d.reduce((s: number, p: any) => s + (p.likesCount || p.likes || 0), 0) / likes15d.length
        : 0;
      const recentAvgReach = avgViews15d || avgLikes15d;
      const recentEngagementRate = recentAvgReach > 0 ? avgLikes15d / recentAvgReach : 0;

      // Extract captions for content analysis
      const captions = handlePosts
        .slice(0, 20)
        .map((p: any) => p.caption || p.text || p.alt || '')
        .filter(Boolean);

      const profile: InstagramProfile = {
        handle,
        name: fullName,
        isBusinessProfile: isBusiness,
        followers,
        reachAbsolute: Math.round(reachAbsolute),
        reachRelative: Math.round(reachRelative * 1000) / 1000,
        engagementRate: Math.round(engagementRate * 1000) / 1000,
        postsLast30d: recentPosts.length,
        avgLikesLast30d: Math.round(avgLikes),
        avgViewsReelsLast30d: Math.round(avgViews),
        recentPostsCount: recentPosts15d.length,
        recentAvgReach: Math.round(recentAvgReach),
        recentEngagementRate: Math.round(recentEngagementRate * 1000) / 1000,
        bio,
        lastPostsCaptions: captions,
        isPrivate,
        dataAvailable: !isPrivate && (followers > 0 || handlePosts.length > 0),
      };

      console.log(`[Instagram] @${handle}: ${followers} followers, ${handlePosts.length} posts scraped, ${recentPosts.length} last 30d, ${recentPosts15d.length} last 15d, avgLikes=${Math.round(avgLikes)}, avgViews=${Math.round(avgViews)}, recentReach=${Math.round(recentAvgReach)}`);

      // Cache per handle for 3 days
      if (config.cache) {
        setCache(config.cache, `ig:${handle}`, 'instagram', profile, 3);
      }

      return profile;
    });

    return [...cached, ...profiles];
  };
}

// ============================================================================
// GOOGLE ADS KEYWORD PLANNER WRAPPER
// ============================================================================
// NOTA: Requer conta Google Ads + OAuth2 + Developer Token
// Configuração detalhada necessária — este é o esqueleto

interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string;       // ID da conta Google Ads (sem hífens)
  cache?: CacheConfig;
}

export function createGoogleAdsKPClient(config: GoogleAdsConfig) {
  return async function getKeywordVolumes(
    terms: string[],
    region: string,
    locationCode?: number,
  ): Promise<TermVolumeData[]> {
    const cacheKey = `kp:${terms.sort().join('+')}:${region}`;
    if (config.cache) {
      const cached = await getCached<TermVolumeData[]>(config.cache, cacheKey);
      if (cached) return cached;
    }

    // Step 1: Get OAuth2 access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const { access_token } = await tokenResponse.json();

    // Step 2: Call KeywordPlanService → GenerateKeywordHistoricalMetrics
    // API: https://developers.google.com/google-ads/api/reference/rpc/v17/KeywordPlanIdeaService
    const apiUrl = `https://googleads.googleapis.com/v17/customers/${config.customerId}:generateKeywordHistoricalMetrics`;

    const resolvedGeoTarget = locationCode
      ? `geoTargetConstants/${locationCode}`
      : extractLocationCodeFromRegion(region)
        ? `geoTargetConstants/${extractLocationCodeFromRegion(region)}`
        : 'geoTargetConstants/2076';
    console.log(`[GoogleAdsKP] geo-target: ${resolvedGeoTarget} para região "${region}"`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'developer-token': config.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: terms,
        geoTargetConstants: [resolvedGeoTarget],
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        language: 'languageConstants/1014',  // Português
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse response → TermVolumeData[]
    const volumeData: TermVolumeData[] = (data.results || []).map((result: any) => {
      const metrics = result.keywordMetrics || {};
      const monthlySearchVolumes = metrics.monthlySearchVolumes || [];
      
      // Volume mensal médio
      const avgVolume = metrics.avgMonthlySearches || 0;
      
      // CPC
      const cpcMicros = metrics.averageCpcMicros || 0;
      const cpcBrl = cpcMicros / 1_000_000;  // Micros → reais
      
      // Sazonalidade (últimos 12 meses)
      const monthlyTrend: MonthlyDataPoint[] = monthlySearchVolumes
        .slice(-12)
        .map((m: any) => ({
          month: `${m.year}-${String(m.month).padStart(2, '0')}`,
          volume: m.monthlySearches || 0,
          isRelative: false,  // KP retorna volumes absolutos
        }));
      
      // Tendência
      let trendDirection: 'rising' | 'stable' | 'declining' = 'stable';
      if (monthlyTrend.length >= 6) {
        const firstHalf = monthlyTrend.slice(0, 6).reduce((s, m) => s + m.volume, 0) / 6;
        const secondHalf = monthlyTrend.slice(6).reduce((s, m) => s + m.volume, 0) / Math.max(monthlyTrend.length - 6, 1);
        if (secondHalf > firstHalf * 1.15) trendDirection = 'rising';
        else if (secondHalf < firstHalf * 0.85) trendDirection = 'declining';
      }

      return {
        term: result.text || result.keyword || '',
        monthlyVolume: avgVolume,
        volumeSource: 'google_ads' as const,
        volumeConfidence: avgVolume > 0 ? 'exact' as const : 'range' as const,
        cpcBrl,
        competition: metrics.competition === 'HIGH' ? 'high' 
          : metrics.competition === 'LOW' ? 'low' : 'medium',
        monthlyTrend,
        trendDirection,
        trendSource: 'google_ads' as const,
      } as TermVolumeData;
    });

    // Cache for 30 days
    if (config.cache) {
      await setCache(config.cache, cacheKey, 'google_ads', volumeData, 30);
    }

    return volumeData;
  };
}


// ============================================================================
// DATAFORSEO WRAPPER — Fallback para Google Ads Keyword Planner
// ============================================================================
// API Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
// Env vars: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD
// Custo: ~$0.05 por request (até 700 keywords por request)

// Geo-targeting: usa módulo centralizado de localização
import { UF_LOCATION_CODES, BRAZIL_LOCATION_CODE, getCityLocationCode } from './dataforseo-locations';

export function extractLocationCodeFromRegion(region: string): number {
  // 1. Tenta cidade específica
  const cityMatch = getCityLocationCode(region);
  if (cityMatch) {
    console.log(`[DataForSEO] Location: city="${cityMatch.cityName}" → code=${cityMatch.code} (city-level)`);
    return cityMatch.code;
  }

  // 2. Fallback: estado (UF)
  const ufMatch = region.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) {
    const code = UF_LOCATION_CODES[ufMatch[1]];
    if (code) {
      console.log(`[DataForSEO] Location: UF=${ufMatch[1]} → code=${code} (state-level)`);
      return code;
    }
  }

  console.log(`[DataForSEO] Location: no match in "${region}", using ${BRAZIL_LOCATION_CODE} (Brazil)`);
  return BRAZIL_LOCATION_CODE;
}

interface DataForSEOConfig {
  login: string;
  password: string;
  cache?: CacheConfig;
}

interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number | null;
  competition: number | null;               // 0-1 (numérico)
  competition_level: string | null;         // "LOW" | "MEDIUM" | "HIGH"
  cpc: number | null;                       // USD — converter pra BRL se necessário
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result: Array<{
      items: DataForSEOKeywordResult[] | null;
    }> | null;
  }>;
}

export function createDataForSEOClient(config: DataForSEOConfig) {
  const baseUrl = 'https://api.dataforseo.com/v3';
  const authHeader = 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64');

  return async function getKeywordVolumes(
    terms: string[],
    region: string,
    locationCode?: number,
    languageCode: string = 'pt',
  ): Promise<TermVolumeData[]> {
    // Auto-detect state-level location code from region string
    const resolvedLocationCode = locationCode ?? extractLocationCodeFromRegion(region);
    if (terms.length === 0) return [];

    // Check cache
    const cacheKey = `dfs:${terms.sort().join('+')}:${region}`;
    if (config.cache) {
      const cached = await getCached<TermVolumeData[]>(config.cache, cacheKey);
      if (cached) return cached;
    }

    // DataForSEO aceita até 700 keywords por request
    const CHUNK_SIZE = 700;
    const allResults: TermVolumeData[] = [];

    for (let i = 0; i < terms.length; i += CHUNK_SIZE) {
      const chunk = terms.slice(i, i + CHUNK_SIZE);

      const body = [
        {
          keywords: chunk,
          location_code: resolvedLocationCode,
          language_code: languageCode,
        },
      ];

      let raw: any;
      let isLabsEndpoint = false;
      console.log(`[DataForSEO] Sending ${chunk.length} keywords, first 3: ${chunk.slice(0, 3).join(', ')}`);
      try {
        // Tenta Google Ads endpoint primeiro (mais preciso)
        const res = await fetch(`${baseUrl}/keywords_data/google_ads/search_volume/live`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });

        if (res.status === 402) {
          // Sem créditos no Keywords Data API — tenta DataForSEO Labs (mais barato)
          console.warn('[DataForSEO] Keywords Data API 402 (sem créditos), tentando Labs fallback...');
          isLabsEndpoint = true;
          const labsRes = await fetch(`${baseUrl}/dataforseo_labs/google/search_volume/live`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
          });

          if (!labsRes.ok) {
            const errText = await labsRes.text().catch(() => 'no body');
            throw new Error(`DataForSEO Labs HTTP ${labsRes.status}: ${errText.slice(0, 300)}`);
          }

          raw = await labsRes.json();
          console.log('[DataForSEO] Using Labs endpoint (fallback)');
        } else if (!res.ok) {
          const errText = await res.text().catch(() => 'no body');
          throw new Error(`DataForSEO HTTP ${res.status}: ${errText.slice(0, 300)}`);
        } else {
          raw = await res.json();
        }
      } catch (err) {
        console.error(`[DataForSEO] Request failed for chunk ${i / CHUNK_SIZE + 1}:`, err);
        allResults.push(...chunk.map(term => buildZeroVolume(term)));
        continue;
      }

      // Validar resposta
      const task = raw.tasks?.[0];
      console.log(`[DataForSEO] Response: status=${raw.status_code}, task_status=${task?.status_code}, task_msg="${task?.status_message}", isLabs=${isLabsEndpoint}`);
      if (!task || task.status_code !== 20000) {
        console.error('[DataForSEO] Task error:', task?.status_message || 'no task returned');
        allResults.push(...chunk.map(term => buildZeroVolume(term)));
        continue;
      }

      // Extrair items — Keywords Data API retorna result[] diretamente (sem wrapper items)
      let items: DataForSEOKeywordResult[] = [];
      const taskResult = task.result;

      if (Array.isArray(taskResult) && taskResult.length > 0) {
        const first = taskResult[0];
        console.log(`[DataForSEO] result.length=${taskResult.length}, result[0] keys: ${Object.keys(first).join(', ')}`);

        // Formato 1: result[] diretamente contém keyword data (Keywords Data API)
        // Cada elemento tem { keyword, search_volume, cpc, ... }
        if (first.keyword !== undefined && !first.items) {
          items = taskResult as DataForSEOKeywordResult[];
          console.log('[DataForSEO] Formato: result[] direto (sem items wrapper)');
        }
        // Formato 2: result[0].items contém keyword data (possível em outros endpoints)
        else if (first.items && Array.isArray(first.items)) {
          const rawItems = first.items;
          const sample = rawItems[0];
          if (sample) {
            // Labs: keyword_data.keyword_info wrapper
            if (sample.keyword_data?.keyword_info) {
              console.log('[DataForSEO] Formato: Labs (keyword_data.keyword_info)');
              items = rawItems.map((ri: any) => ({
                keyword: ri.keyword_data?.keyword || ri.keyword || '',
                search_volume: ri.keyword_data?.keyword_info?.search_volume ?? null,
                competition: ri.keyword_data?.keyword_info?.competition ?? null,
                competition_level: ri.keyword_data?.keyword_info?.competition_level ?? null,
                cpc: ri.keyword_data?.keyword_info?.cpc ?? null,
                monthly_searches: ri.keyword_data?.keyword_info?.monthly_searches ?? null,
              }));
            } else {
              items = rawItems;
              console.log('[DataForSEO] Formato: items[] direto');
            }
          }
        }
        // Formato desconhecido
        else {
          console.log(`[DataForSEO] Formato desconhecido, result[0]: ${JSON.stringify(first).slice(0, 300)}`);
        }
      } else {
        console.log(`[DataForSEO] task.result vazio ou null: ${JSON.stringify(taskResult).slice(0, 200)}`);
      }

      const withVolume = items.filter(it => (it.search_volume ?? 0) > 0).length;
      console.log(`[DataForSEO] ${items.length} items parsed, ${withVolume} with volume > 0`);
      if (items.length > 0) {
        const s = items[0];
        console.log(`[DataForSEO] item[0]: keyword="${s.keyword}", search_volume=${s.search_volume}, cpc=${s.cpc}`);
      }

      // Indexar por keyword (lowercase) para lookup rápido
      const itemMap = new Map<string, DataForSEOKeywordResult>();
      for (const item of items) {
        if (item.keyword) itemMap.set(item.keyword.toLowerCase(), item);
      }

      // Mapear cada termo do chunk
      for (const term of chunk) {
        const item = itemMap.get(term.toLowerCase());
        if (item) {
          allResults.push(mapDataForSEOToTermVolume(item));
        } else {
          allResults.push(buildZeroVolume(term));
        }
      }
    }

    // Cache for 30 days (volume data não muda rápido)
    if (config.cache && allResults.some(r => r.monthlyVolume > 0)) {
      await setCache(config.cache, cacheKey, 'dataforseo', allResults, 30);
    }

    return allResults;
  };
}

/**
 * Converte um resultado da API DataForSEO para TermVolumeData (interface Virô).
 */
function mapDataForSEOToTermVolume(item: DataForSEOKeywordResult): TermVolumeData {
  // Sazonalidade: ordenar por data e pegar últimos 12 meses
  const sortedMonthly = (item.monthly_searches ?? [])
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-12);

  const monthlyTrend: MonthlyDataPoint[] = sortedMonthly.map(m => ({
    month: `${m.year}-${String(m.month).padStart(2, '0')}`,
    volume: m.search_volume ?? 0,
    isRelative: false,  // DataForSEO retorna volumes absolutos (via Google Ads data)
  }));

  // Tendência: comparar primeira e segunda metade
  let trendDirection: 'rising' | 'stable' | 'declining' = 'stable';
  if (monthlyTrend.length >= 6) {
    const firstHalf = monthlyTrend.slice(0, 6).reduce((s, m) => s + m.volume, 0) / 6;
    const secondHalf = monthlyTrend.slice(6).reduce((s, m) => s + m.volume, 0) / Math.max(monthlyTrend.length - 6, 1);
    if (secondHalf > firstHalf * 1.15) trendDirection = 'rising';
    else if (secondHalf < firstHalf * 0.85) trendDirection = 'declining';
  }

  // Competition: DataForSEO retorna tanto string ("LOW"/"MEDIUM"/"HIGH") quanto numérico (0-1)
  let competition: 'low' | 'medium' | 'high' = 'medium';
  if (item.competition_level) {
    const level = item.competition_level.toUpperCase();
    if (level === 'HIGH') competition = 'high';
    else if (level === 'LOW') competition = 'low';
    else competition = 'medium';
  } else if (item.competition !== null) {
    if (item.competition > 0.66) competition = 'high';
    else if (item.competition < 0.33) competition = 'low';
  }

  return {
    term: item.keyword,
    monthlyVolume: item.search_volume ?? 0,
    volumeSource: 'google_ads' as const,      // DataForSEO puxa do Google Ads internamente
    volumeConfidence: (item.search_volume ?? 0) > 0 ? 'exact' as const : 'estimate' as const,
    cpcBrl: item.cpc ?? 0,                    // DataForSEO retorna CPC em USD por padrão; ajustar se necessário
    competition,
    monthlyTrend,
    trendDirection,
    trendSource: 'google_ads' as const,
  };
}

/**
 * Fallback: gera TermVolumeData zerado para um termo sem dados.
 */
function buildZeroVolume(term: string): TermVolumeData {
  return {
    term,
    monthlyVolume: 0,
    volumeSource: 'apify_estimate' as const,
    volumeConfidence: 'estimate' as const,
    cpcBrl: 0,
    competition: 'medium' as const,
    monthlyTrend: [],
    trendDirection: 'stable' as const,
    trendSource: 'google_ads' as const,
  };
}


// ============================================================================
// DATAFORSEO ORGANIC POSITION CHECKER
// ============================================================================

export function createDataForSEOOrganicChecker(config: DataForSEOConfig) {
  const baseUrl = 'https://api.dataforseo.com/v3';
  const authHeader = 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64');

  return async function checkOrganicPositions(
    domain: string,
    terms: string[],
    region: string,
    locationCode?: number,
    languageCode: string = 'pt',
  ): Promise<OrganicPresence> {
    const resolvedLocationCode = locationCode ?? extractLocationCodeFromRegion(region);
    if (terms.length === 0) {
      return { available: false, domain, rankedTerms: [], totalRanked: 0, avgPosition: null, topPosition: null };
    }

    const cacheKey = `organic:${domain}:${terms.sort().join('+')}`;
    if (config.cache) {
      const cached = await getCached<OrganicPresence>(config.cache, cacheKey);
      if (cached) return cached;
    }

    try {
      // Serializa tasks (uma por vez) — DataForSEO SERP Live não aceita múltiplas tasks simultâneas
      const rankedTerms: { term: string; position: number; url: string }[] = [];

      for (const term of terms) {
        try {
          const res = await fetch(`${baseUrl}/serp/google/organic/live/advanced`, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
              keyword: term,
              location_code: resolvedLocationCode,
              language_code: languageCode,
              device: 'desktop',
              os: 'windows',
              depth: 30,
            }]),
            signal: AbortSignal.timeout(15_000),
          });

          if (!res.ok) {
            console.warn(`[OrganicChecker] SERP falhou para "${term}": HTTP ${res.status}`);
            continue;
          }

          const data = await res.json();
          const task = data.tasks?.[0];
          if (!task || task.status_code !== 20000) {
            console.warn(`[OrganicChecker] Task error para "${term}": ${task?.status_code} ${task?.status_message}`);
            continue;
          }

          const items = task.result?.[0]?.items || [];
          for (const item of items) {
            if (item.type !== 'organic') continue;
            const itemDomain = (item.domain || '').replace('www.', '');
            if (itemDomain === domain) {
              rankedTerms.push({
                term,
                position: item.rank_group || item.rank_absolute,
                url: item.url || '',
              });
              break;
            }
          }
          console.log(`[OrganicChecker] "${term}": ${rankedTerms.find(r => r.term === term) ? `pos ${rankedTerms.find(r => r.term === term)!.position}` : 'not found'}`);
        } catch (termErr) {
          console.warn(`[OrganicChecker] Erro para "${term}":`, (termErr as Error).message);
        }
      }

      const positions = rankedTerms.map(r => r.position);
      const result: OrganicPresence = {
        available: true,
        domain,
        rankedTerms,
        totalRanked: rankedTerms.length,
        avgPosition: positions.length > 0
          ? Math.round((positions.reduce((s, p) => s + p, 0) / positions.length) * 10) / 10
          : null,
        topPosition: positions.length > 0 ? Math.min(...positions) : null,
      };

      if (config.cache) {
        await setCache(config.cache, cacheKey, 'dataforseo_organic', result, 7);
      }

      return result;
    } catch (err) {
      console.error('[OrganicChecker] Erro:', err);
      return { available: false, domain, rankedTerms: [], totalRanked: 0, avgPosition: null, topPosition: null };
    }
  };
}

// ============================================================================
// MODUS AI / SIMILARWEB WRAPPER
// ============================================================================
// NOTA: Depende de como a API do Modus funciona — esqueleto genérico

interface ModusConfig {
  apiKey: string;
  baseUrl: string;          // URL da API Modus
  cache?: CacheConfig;
}

export function createModusClient(config: ModusConfig) {
  return async function getSimilarWebData(
    domain: string,
  ): Promise<WebInfluence> {
    const cacheKey = `web:${domain}`;
    if (config.cache) {
      const cached = await getCached<WebInfluence>(config.cache, cacheKey);
      if (cached) return cached;
    }

    // Chamada ao Modus AI — adaptar conforme documentação real
    const response = await fetch(`${config.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      // SimilarWeb frequentemente não tem dados pra sites pequenos
      return { available: false };
    }

    const data = await response.json();

    const webInfluence: WebInfluence = {
      available: true,
      monthlyVisits: data.monthlyVisits || data.traffic?.monthly,
      authorityScore: data.authorityScore || data.domainAuthority,
      backlinks: data.backlinks || data.referringDomains,
      topKeywords: data.topKeywords?.slice(0, 10),
      trafficSources: data.trafficSources ? {
        direct: data.trafficSources.direct || 0,
        search: data.trafficSources.search || 0,
        social: data.trafficSources.social || 0,
        referral: data.trafficSources.referral || 0,
      } : undefined,
    };

    if (config.cache) {
      await setCache(config.cache, cacheKey, 'similarweb', webInfluence, 14);
    }

    return webInfluence;
  };
}


// ============================================================================
// SERVICE FACTORY
// Cria todas as instâncias de serviço a partir de env vars
// ============================================================================

export function createExternalServices(env: {
  ANTHROPIC_API_KEY: string;
  APIFY_API_TOKEN?: string;
  GOOGLE_ADS_CLIENT_ID?: string;
  GOOGLE_ADS_CLIENT_SECRET?: string;
  GOOGLE_ADS_REFRESH_TOKEN?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_CUSTOMER_ID?: string;
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  MODUS_API_KEY?: string;
  MODUS_BASE_URL?: string;
  supabaseClient?: any;
}) {
  const cache: CacheConfig | undefined = env.supabaseClient
    ? { supabaseClient: env.supabaseClient }
    : undefined;

  const services: any = {
    claude: {
      // Wrapper simples — adaptar pra usar @anthropic-ai/sdk
      createMessage: async (params: any) => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(params),
        });
        return response.json();
      },
    },
  };

  // Apify (se configurado)
  if (env.APIFY_API_TOKEN) {
    const apifyConfig: ApifyConfig = { apiToken: env.APIFY_API_TOKEN, cache };
    services.apify = {
      runGoogleTrends: createApifyTrendsScraper(apifyConfig),
      runSerpScraper: createApifySerpScraper(apifyConfig),
      runMapsScraper: createApifyMapsScraper(apifyConfig),
      runInstagramScraper: createApifyInstagramScraper(apifyConfig),
    };
  }

  // Google Ads (se configurado)
  if (env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    services.googleAds = {
      getKeywordVolumes: createGoogleAdsKPClient({
        clientId: env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!,
        refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN!,
        developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
        customerId: env.GOOGLE_ADS_CUSTOMER_ID!,
        cache,
      }),
    };
  }

  // DataForSEO (se configurado — fallback para Google Ads KP)
  if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) {
    services.dataForSEO = {
      getKeywordVolumes: createDataForSEOClient({
        login: env.DATAFORSEO_LOGIN,
        password: env.DATAFORSEO_PASSWORD,
        cache,
      }),
    };
  }

  // Modus / SimilarWeb (se configurado)
  if (env.MODUS_API_KEY) {
    services.modus = {
      getSimilarWebData: createModusClient({
        apiKey: env.MODUS_API_KEY,
        baseUrl: env.MODUS_BASE_URL || 'https://api.modus.ai',
        cache,
      }),
    };
  }

  return services;
}
