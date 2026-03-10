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
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${config.apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutSecs * 1000),
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
    }, 120);

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
  ): Promise<MapsPresence> {
    const cacheKey = `maps:${businessName}:${region}`;
    if (config.cache) {
      const cached = await getCached<MapsPresence>(config.cache, cacheKey);
      if (cached) return cached;
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('[Maps] GOOGLE_PLACES_API_KEY não configurada');
      return { found: false, businessName: null, inLocalPack: false };
    }

    try {
      // 1. Text Search — busca o negócio por nome + região
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.types,places.photos',
        },
        body: JSON.stringify({
          textQuery: `${businessName} ${region}`,
          languageCode: 'pt-BR',
          maxResultCount: 5,
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

      // Primeiro resultado como match principal
      const match = places[0];
      const placeId = match.id;

      // 2. Place Details — busca campos extras (website, telefone, horário)
      const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,rating,userRatingCount,types,photos,websiteUri,nationalPhoneNumber,regularOpeningHours',
        },
      });

      let details: any = null;
      if (detailsRes.ok) {
        details = await detailsRes.json();
      } else {
        console.warn('[Maps] Place Details falhou, usando dados do Text Search');
      }

      const source = details || match;

      const presence: MapsPresence = {
        found: true,
        businessName: source.displayName?.text || null,
        rating: source.rating,
        reviewCount: source.userRatingCount,
        categories: source.types || [],
        inLocalPack: true,
        localPackPosition: 1,
        photos: source.photos?.length || 0,
        website: details?.websiteUri,
        phone: details?.nationalPhoneNumber,
        openNow: details?.regularOpeningHours?.openNow,
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

// --- PERPLEXITY AI VISIBILITY CHECKER ---

export interface PerplexityVisibilityResult {
  mentioned: boolean;
  mentionContext: string | null;
  rawResponse: string;
}

function removeAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function createPerplexityAIVisibilityChecker() {
  return async function checkAIVisibility(
    product: string,
    region: string,
    businessName: string | null,
    instagramHandle: string | null,
  ): Promise<PerplexityVisibilityResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.warn('[Perplexity] PERPLEXITY_API_KEY não configurada');
      return { mentioned: false, mentionContext: null, rawResponse: '' };
    }

    try {
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
              content: `Quais são os melhores negócios de ${product} em ${region}? Liste os 5 principais com nome.`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Perplexity] Chamada falhou:', res.status, errBody);
        return { mentioned: false, mentionContext: null, rawResponse: '' };
      }

      const data = await res.json();
      const rawResponse = data.choices?.[0]?.message?.content || '';
      const normalizedResponse = removeAccents(rawResponse);

      let mentioned = false;
      let mentionContext: string | null = null;

      // Verifica businessName
      if (businessName) {
        const normalizedName = removeAccents(businessName);
        if (normalizedName.length > 2 && normalizedResponse.includes(normalizedName)) {
          mentioned = true;
          // Extrai contexto ao redor da menção
          const idx = normalizedResponse.indexOf(normalizedName);
          const start = Math.max(0, idx - 60);
          const end = Math.min(rawResponse.length, idx + normalizedName.length + 60);
          mentionContext = rawResponse.substring(start, end);
        }
      }

      // Fallback: verifica instagramHandle
      if (!mentioned && instagramHandle) {
        const cleanHandle = removeAccents(instagramHandle.replace('@', ''));
        if (cleanHandle.length > 3 && normalizedResponse.includes(cleanHandle)) {
          mentioned = true;
          const idx = normalizedResponse.indexOf(cleanHandle);
          const start = Math.max(0, idx - 60);
          const end = Math.min(rawResponse.length, idx + cleanHandle.length + 60);
          mentionContext = rawResponse.substring(start, end);
        }
      }

      return { mentioned, mentionContext, rawResponse };
    } catch (err) {
      console.error('[Perplexity] Erro ao consultar API:', err);
      return { mentioned: false, mentionContext: null, rawResponse: '' };
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
    const cleanHandles = handles.map(h => h.replace('@', '').replace('https://www.instagram.com/', '').replace('/', ''));

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
    const [detailsResult, postsResult] = await Promise.allSettled([
      // Call 1: Profile details (followers, bio, etc.)
      runApifyActor(config, 'apify~instagram-scraper', {
        directUrls: urls,
        resultsType: 'details',
        resultsLimit: 1,
      }, 90),

      // Call 2: Posts (captions, likes, views, timestamps)
      runApifyActor(config, 'apify~instagram-scraper', {
        directUrls: urls,
        resultsType: 'posts',
        resultsLimit: 20,  // Last 20 posts per profile
      }, 90),
    ]);

    const details = detailsResult.status === 'fulfilled' ? detailsResult.value : [];
    const posts = postsResult.status === 'fulfilled' ? postsResult.value : [];

    if (detailsResult.status === 'rejected') {
      console.warn('[Instagram] Details call failed:', detailsResult.reason?.message || detailsResult.reason);
    }
    if (postsResult.status === 'rejected') {
      console.warn('[Instagram] Posts call failed:', postsResult.reason?.message || postsResult.reason);
    }

    // Parse results → InstagramProfile[]
    const profiles: InstagramProfile[] = toFetch.map(handle => {
      // Find profile in details results
      const profileData = details.find((r: any) =>
        r.username === handle || r.ownerUsername === handle ||
        r.id?.includes(handle) || r.url?.includes(handle)
      );

      // Find posts for this handle
      const handlePosts = posts.filter((r: any) =>
        r.ownerUsername === handle ||
        r.username === handle ||
        r.profileUrl?.includes(handle) ||
        r.inputUrl?.includes(handle)
      );

      const followers = profileData?.followersCount || profileData?.followers || profileData?.followedByCount || 0;
      const bio = profileData?.biography || profileData?.bio || '';
      const isPrivate = profileData?.isPrivate || profileData?.private || false;
      const fullName = profileData?.fullName || profileData?.name || handle;
      const isBusiness = profileData?.isBusinessAccount || profileData?.isBusiness || false;

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
          bio: '',
          lastPostsCaptions: [],
          isPrivate: false,
          dataAvailable: false,
        };
      }

      // Calculate metrics from posts (last 30 days)
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const recentPosts = handlePosts.filter((p: any) => {
        const ts = new Date(p.timestamp || p.takenAt || p.takenAtTimestamp * 1000 || 0).getTime();
        return ts > thirtyDaysAgo;
      });

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
        bio,
        lastPostsCaptions: captions,
        isPrivate,
        dataAvailable: !isPrivate && (followers > 0 || handlePosts.length > 0),
      };

      console.log(`[Instagram] @${handle}: ${followers} followers, ${handlePosts.length} posts scraped, ${recentPosts.length} last 30d, avgLikes=${Math.round(avgLikes)}, avgViews=${Math.round(avgViews)}, captions=${captions.length}`);

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
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'developer-token': config.developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords: terms,
        geoTargetConstants: ['geoTargetConstants/2076'],  // Brasil — ajustar por região
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
    locationCode: number = 2076,    // 2076 = Brasil
    languageCode: string = 'pt',
  ): Promise<TermVolumeData[]> {
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
          location_code: locationCode,
          language_code: languageCode,
        },
      ];

      let raw: DataForSEOResponse;
      try {
        const res = await fetch(`${baseUrl}/keywords_data/google_ads/search_volume/live`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => 'no body');
          throw new Error(`DataForSEO HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        raw = (await res.json()) as DataForSEOResponse;
      } catch (err) {
        console.error(`[DataForSEO] Request failed for chunk ${i / CHUNK_SIZE + 1}:`, err);
        // Graceful degradation: retorna zeros para esse chunk
        allResults.push(...chunk.map(term => buildZeroVolume(term)));
        continue;
      }

      // Validar resposta
      const task = raw.tasks?.[0];
      if (!task || task.status_code !== 20000) {
        console.error('[DataForSEO] Task error:', task?.status_message || 'no task returned');
        allResults.push(...chunk.map(term => buildZeroVolume(term)));
        continue;
      }

      const items = task.result?.[0]?.items ?? [];

      // Indexar por keyword (lowercase) para lookup rápido
      const itemMap = new Map<string, DataForSEOKeywordResult>();
      for (const item of items) {
        itemMap.set(item.keyword.toLowerCase(), item);
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
    locationCode: number = 2076,
    languageCode: string = 'pt',
  ): Promise<OrganicPresence> {
    if (terms.length === 0) {
      return { available: false, domain, rankedTerms: [], totalRanked: 0, avgPosition: null, topPosition: null };
    }

    const cacheKey = `organic:${domain}:${terms.sort().join('+')}`;
    if (config.cache) {
      const cached = await getCached<OrganicPresence>(config.cache, cacheKey);
      if (cached) return cached;
    }

    try {
      // Uma task por termo — DataForSEO SERP Organic Live Advanced
      const tasks = terms.map(term => ({
        keyword: term,
        location_code: locationCode,
        language_code: languageCode,
        device: 'desktop',
        os: 'windows',
        depth: 30,
      }));

      const res = await fetch(`${baseUrl}/serp/google/organic/live/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tasks),
      });

      if (!res.ok) {
        console.error('[OrganicChecker] DataForSEO falhou:', res.status);
        return { available: false, domain, rankedTerms: [], totalRanked: 0, avgPosition: null, topPosition: null };
      }

      const data = await res.json();
      const rankedTerms: { term: string; position: number; url: string }[] = [];

      for (const task of (data.tasks || [])) {
        if (task.status_code !== 20000) continue;
        const keyword = task.data?.keyword || '';
        const items = task.result?.[0]?.items || [];

        for (const item of items) {
          if (item.type !== 'organic') continue;
          const itemDomain = (item.domain || '').replace('www.', '');
          if (itemDomain === domain) {
            rankedTerms.push({
              term: keyword,
              position: item.rank_group || item.rank_absolute,
              url: item.url || '',
            });
            break; // pega só a primeira aparição do domínio por termo
          }
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
