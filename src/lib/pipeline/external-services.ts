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

    // Actor: compass~crawler-google-places (official Google Maps Scraper)
    // Docs: https://apify.com/compass/crawler-google-places
    const results = await runApifyActor(config, 'compass~crawler-google-places', {
      searchStringsArray: [`${businessName} ${region}`],
      maxCrawledPlacesPerSearch: 5,
      language: 'pt-BR',
    }, 120);

    // Find the best match
    const match = results.find((r: any) =>
      r.title?.toLowerCase().includes(businessName.toLowerCase())
    );

    const presence: MapsPresence = match ? {
      found: true,
      rating: match.totalScore || match.rating,
      reviewCount: match.reviewsCount || match.reviews,
      categories: match.categories || match.categoryName ? [match.categoryName] : [],
      inLocalPack: true,  // Se encontrou no Maps, provavelmente aparece no local pack
      localPackPosition: 1,  // Aproximação — refinamento futuro com SERP data
      photos: match.imageCount || match.photosCount,
    } : {
      found: false,
      inLocalPack: false,
    };

    if (config.cache) {
      await setCache(config.cache, cacheKey, 'apify_maps', presence, 14);
    }

    return presence;
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
