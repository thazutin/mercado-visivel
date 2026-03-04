// ============================================================================
// Virô Phase 2 — Block 2 Analysis Engine
// Real data: Apify (SERP, Maps, Instagram) + Google Ads KP / DataForSEO
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { LeadFormData } from "./schema";
import { adaptFormToInput } from "./form-adapter";
import { executeStep1 } from "./pipeline/step1-term-generation";
import { calculateMarketSizing, detectCategory } from "./models/market-sizing";
import {
  calculateGoogleInfluence,
  calculateInstagramInfluence,
  calculateCompositeInfluence,
} from "./models/influence-score";
import { executeStep5 } from "./pipeline/step5-gap-analysis";
import {
  createApifySerpScraper,
  createApifyMapsScraper,
  createApifyInstagramScraper,
  createGoogleAdsKPClient,
  createDataForSEOClient,
} from "./pipeline/external-services";
import type {
  FormInput,
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  Step5Output,
  Momento1Result,
  TermVolumeData,
  SerpPosition,
  MapsPresence,
  InstagramProfile,
  GoogleInfluence,
  InstagramInfluence,
  WebInfluence,
} from "./types/pipeline.types";

// --- Claude client singleton ---
function getClaudeClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey: key });
  return { createMessage: (params: any) => client.messages.create(params) };
}

// --- Apify config ---
function getApifyConfig() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  return { apiToken: token };
}

// --- PIPELINE VERSION ---
const PIPELINE_VERSION = "momento1-v2.1-block2";

// ============================================================================
// VOLUME FETCHER — cadeia de fallback
// 1. Google Ads KP (se GOOGLE_ADS_* env vars presentes)
// 2. DataForSEO (se DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD presentes)
// 3. Zeros (graceful degradation — pipeline continua funcional)
// ============================================================================

async function fetchTermVolumes(
  terms: string[],
  region: string,
): Promise<{ volumes: TermVolumeData[]; source: string }> {

  // --- 1. Google Ads Keyword Planner ---
  if (
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  ) {
    try {
      console.log('[Analysis] Buscando volumes via Google Ads KP...');
      const kpClient = createGoogleAdsKPClient({
        clientId: process.env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
      });
      const volumes = await kpClient(terms, region);
      const withData = volumes.filter(v => v.monthlyVolume > 0).length;
      if (withData > 0) {
        console.log(`[Analysis] Google Ads KP: ${withData}/${volumes.length} termos com volume`);
        return { volumes, source: 'google_ads' };
      }
      console.warn('[Analysis] Google Ads KP retornou tudo zero — tentando fallback...');
    } catch (err) {
      console.error('[Analysis] Google Ads KP falhou:', err);
    }
  }

  // --- 2. DataForSEO (fallback) ---
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      console.log('[Analysis] Buscando volumes via DataForSEO (fallback)...');
      const dfsClient = createDataForSEOClient({
        login: process.env.DATAFORSEO_LOGIN,
        password: process.env.DATAFORSEO_PASSWORD,
      });
      const volumes = await dfsClient(terms, region);
      const withData = volumes.filter(v => v.monthlyVolume > 0).length;
      console.log(`[Analysis] DataForSEO: ${withData}/${volumes.length} termos com volume`);
      return { volumes, source: 'dataforseo' };
    } catch (err) {
      console.error('[Analysis] DataForSEO falhou:', err);
    }
  }

  // --- 3. Graceful degradation: zeros ---
  console.warn('[Analysis] Nenhum provedor de volume disponível. monthlyVolume = 0 para todos os termos.');
  const volumes: TermVolumeData[] = terms.map(term => ({
    term,
    monthlyVolume: 0,
    volumeSource: 'apify_estimate' as const,
    volumeConfidence: 'estimate' as const,
    cpcBrl: 0,
    competition: 'medium' as const,
    monthlyTrend: [],
    trendDirection: 'stable' as const,
    trendSource: 'google_ads' as const,
  }));
  return { volumes, source: 'none' };
}


// --- MAIN ENTRY POINT ---

export async function runInstantAnalysis(
  formData: LeadFormData,
  locale: string
): Promise<Momento1Result> {
  const pipelineStart = Date.now();
  const claude = getClaudeClient();
  const apifyConfig = getApifyConfig();
  const input = adaptFormToInput(formData, locale);

  const sourcesUsed: string[] = ["claude_term_gen"];
  const sourcesUnavailable: string[] = [];

  // =========================================================================
  // STEP 1 — Term Generation (Claude)
  // =========================================================================
  let step1: Step1Output;
  try {
    step1 = await executeStep1(input, claude, {
      model: "claude-haiku-4-5-20251001",
      maxRetries: 1,
    });
    console.log(`[Pipeline] Step 1 OK: ${step1.termCount} terms generated`);
  } catch (err) {
    console.error("[Pipeline] Step 1 failed:", err);
    throw new Error("Pipeline aborted: term generation failed");
  }

  // =========================================================================
  // STEP 2 — Search Volumes + SERP + Maps + Instagram (parallel)
  // =========================================================================
  // Extract top terms for SERP scraping (max 5 to save Apify credits and speed)
  const topTerms = step1.terms
    .sort((a, b) => b.intentWeight - a.intentWeight)
    .slice(0, 5)
    .map((t) => t.term);

  // Extract instagram handles to scrape
  const instagramHandles: string[] = [];
  if (formData.instagram) {
    instagramHandles.push(formData.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", ""));
  }
  for (const c of formData.competitors || []) {
    if (c.instagram) {
      instagramHandles.push(c.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", ""));
    }
  }

  // Extract domain for SERP position matching
  const siteDomain = formData.site
    ? new URL(formData.site.startsWith("http") ? formData.site : `https://${formData.site}`).hostname.replace("www.", "")
    : undefined;

  // Run ALL external calls in parallel (Apify + DataForSEO at the same time)
  let serpPositions: SerpPosition[] = [];
  let mapsPresence: MapsPresence | null = null;
  let instagramProfiles: InstagramProfile[] = [];

  // Helper: wrap a promise with a timeout (rejects if not resolved in time)
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        console.warn(`[Pipeline] ${label} timed out after ${ms / 1000}s`);
        reject(new Error(`${label} timed out after ${ms / 1000}s`));
      }, ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  // Build all parallel promises
  const allTermStrings = step1.terms.map(t => t.term);
  const parallelPromises: Promise<any>[] = [];
  const promiseLabels: string[] = [];

  // 1. DataForSEO volumes (runs in parallel with Apify — biggest speed win)
  parallelPromises.push(
    withTimeout(
      fetchTermVolumes(allTermStrings, input.region),
      30_000,
      "Volumes",
    )
  );
  promiseLabels.push("volumes");

  if (apifyConfig) {
    const serpScraper = createApifySerpScraper(apifyConfig);
    const mapsScraper = createApifyMapsScraper(apifyConfig);
    const instagramScraper = createApifyInstagramScraper(apifyConfig);

    console.log(`[Pipeline] Starting parallel calls: Volumes + SERP(${topTerms.length} terms) + Maps + Instagram(${instagramHandles.length} handles)`);

    // 2. SERP scraping (timeout: 30s)
    parallelPromises.push(
      withTimeout(
        serpScraper(topTerms, input.region, siteDomain)
          .then((r) => {
            sourcesUsed.push("apify_serp");
            console.log(`[Pipeline] SERP OK: ${r.length} positions`);
            return r;
          }),
        30_000,
        "SERP",
      )
    );
    promiseLabels.push("serp");

    // 3. Google Maps (timeout: 20s)
    parallelPromises.push(
      withTimeout(
        mapsScraper(input.businessName || input.product, input.region)
          .then((r) => {
            sourcesUsed.push("apify_maps");
            console.log(`[Pipeline] Maps OK: found=${r.found}, rating=${r.rating}`);
            return r;
          }),
        20_000,
        "Maps",
      )
    );
    promiseLabels.push("maps");

    // 4. Instagram (timeout: 25s — if it can't finish in 25s, skip it)
    parallelPromises.push(
      instagramHandles.length > 0
        ? withTimeout(
            instagramScraper(instagramHandles)
              .then((r) => {
                sourcesUsed.push("apify_instagram");
                console.log(`[Pipeline] Instagram OK: ${r.length} profiles`);
                return r;
              }),
            25_000,
            "Instagram",
          )
        : Promise.resolve([])
    );
    promiseLabels.push("instagram");
  } else {
    console.warn("[Pipeline] Apify not configured — skipping external data");
    sourcesUnavailable.push("serp_scraper", "google_maps", "instagram");
  }

  // Execute ALL in parallel
  const parallelResults = await Promise.allSettled(parallelPromises);

  // Collect volume results
  let fetchedVolumes: TermVolumeData[] = [];
  let volumeSource = 'none';
  const volumeResult = parallelResults[0];
  if (volumeResult.status === "fulfilled") {
    fetchedVolumes = volumeResult.value.volumes;
    volumeSource = volumeResult.value.source;
  } else {
    console.error("[Pipeline] Volumes failed:", volumeResult.reason);
  }

  // Collect Apify results (indices 1-3, only if Apify was configured)
  if (apifyConfig) {
    const serpResult = parallelResults[1];
    const mapsResult = parallelResults[2];
    const igResult = parallelResults[3];

    if (serpResult.status === "fulfilled") {
      serpPositions = serpResult.value;
    } else {
      console.error("[Pipeline] SERP failed:", serpResult.reason);
      sourcesUnavailable.push("serp_scraper");
    }

    if (mapsResult.status === "fulfilled") {
      mapsPresence = mapsResult.value;
    } else {
      console.error("[Pipeline] Maps failed:", mapsResult.reason);
      sourcesUnavailable.push("google_maps");
    }

    if (igResult.status === "fulfilled") {
      instagramProfiles = igResult.value;
    } else {
      console.error("[Pipeline] Instagram failed:", igResult.reason);
      sourcesUnavailable.push("instagram");
    }
  }

  if (volumeSource === 'google_ads') {
    sourcesUsed.push('google_ads');
  } else if (volumeSource === 'dataforseo') {
    sourcesUsed.push('dataforseo');
  }

  if (volumeSource === 'none') {
    sourcesUnavailable.push('google_ads', 'dataforseo');
  } else if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    sourcesUnavailable.push('google_ads');
  }
  sourcesUnavailable.push("google_trends", "similarweb");

  // Merge fetched volumes with SERP data (preserve any extra SERP info)
  const termVolumes: TermVolumeData[] = step1.terms.map((t) => {
    const fetched = fetchedVolumes.find(
      (fv) => fv.term.toLowerCase() === t.term.toLowerCase()
    );
    if (fetched && fetched.monthlyVolume > 0) {
      return fetched;
    }
    // Fallback: use whatever fetchTermVolumes returned (may be zero)
    return fetched || {
      term: t.term,
      monthlyVolume: 0,
      volumeSource: 'apify_estimate' as const,
      volumeConfidence: 'estimate' as const,
      cpcBrl: 0,
      competition: 'medium' as const,
      monthlyTrend: [],
      trendDirection: 'stable' as const,
      trendSource: 'google_ads' as const,
    };
  });

  const totalMonthlyVolume = termVolumes.reduce((s, t) => s + t.monthlyVolume, 0);
  const weightedMonthlyVolume = termVolumes.reduce((s, t) => {
    const weight = step1.terms.find((st) => st.term === t.term)?.intentWeight || 0.5;
    return s + t.monthlyVolume * weight;
  }, 0);

  const step2: Step2Output = {
    termVolumes,
    totalMonthlyVolume,
    weightedMonthlyVolume,
    dataFreshness: new Date().toISOString().slice(0, 7),
    sources: sourcesUsed.filter((s) => s.includes("volume") || s.includes("ads") || s.includes("trends") || s === "dataforseo"),
    processingTimeMs: Date.now() - pipelineStart,
  };

  console.log(`[Pipeline] Step 2 OK: ${termVolumes.length} terms, totalVolume=${totalMonthlyVolume}, source=${volumeSource}`);

  // =========================================================================
  // STEP 3 — Market Sizing
  // =========================================================================
  const category = detectCategory(input.product, input.differentiator);

  const step3: Step3Output = calculateMarketSizing(
    step2,
    serpPositions,
    input.ticket,
    category
  );

  console.log(
    `[Pipeline] Step 3 OK: market R$${step3.sizing.marketPotential.low}-${step3.sizing.marketPotential.high}`
  );

  // =========================================================================
  // STEP 4 — Influence Score (with real data!)
  // =========================================================================
  // Debug: log SERP positions
  const rankedTerms = serpPositions.filter((sp: SerpPosition) => sp.position && sp.position <= 10);
  console.log(`[Pipeline] SERP: ${serpPositions.length} terms scraped, ${rankedTerms.length} ranked in top 10`);
  for (const sp of serpPositions.slice(0, 5)) {
    console.log(`[Pipeline]   "${sp.term}": pos=${sp.position || 'not found'}, features=[${sp.serpFeatures?.join(',')}]`);
  }

  const googleInfluence: GoogleInfluence = calculateGoogleInfluence(
    serpPositions,
    mapsPresence,
    termVolumes
  );

  // Split profiles: first = business, rest = competitors
  const businessHandle = formData.instagram
    ? formData.instagram.replace("@", "").replace("https://www.instagram.com/", "").replace("/", "")
    : "";
  
  // Debug: log what Instagram scraper returned
  console.log(`[Pipeline] Instagram profiles received: ${instagramProfiles.length}`);
  for (const p of instagramProfiles) {
    console.log(`[Pipeline]   @${p.handle}: followers=${p.followers}, reach=${p.reachAbsolute}, engagement=${p.engagementRate}, posts30d=${p.postsLast30d}, dataAvailable=${p.dataAvailable}`);
  }
  console.log(`[Pipeline] Business handle to match: "${businessHandle}"`);

  const businessProfile = instagramProfiles.find(
    (p) => p.handle === businessHandle
  ) || {
    handle: businessHandle,
    name: "",
    isBusinessProfile: false,
    followers: 0,
    reachAbsolute: 0,
    reachRelative: 0,
    engagementRate: 0,
    postsLast30d: 0,
    avgLikesLast30d: 0,
    avgViewsReelsLast30d: 0,
    bio: "",
    lastPostsCaptions: [],
    isPrivate: false,
    dataAvailable: false,
  };
  const competitorProfiles = instagramProfiles.filter(
    (p) => p.handle !== businessHandle
  );

  const instagramInfluence: InstagramInfluence = calculateInstagramInfluence(
    businessProfile,
    competitorProfiles
  );

  const webInfluence: WebInfluence = { available: false };

  const step4: Step4Output = calculateCompositeInfluence(
    googleInfluence,
    instagramInfluence,
    webInfluence,
    serpPositions
  );

  console.log(`[Pipeline] Step 4 OK: influence ${step4.influence.totalInfluence}%`);

  // =========================================================================
  // STEP 5 — Gap Analysis (Claude with real data)
  // =========================================================================
  let step5: Step5Output;
  try {
    step5 = await executeStep5(input, step1, step2, step3, step4, claude, {
      model: "claude-sonnet-4-5-20250929",
    });
    sourcesUsed.push("claude_gap_analysis");
    console.log(`[Pipeline] Step 5 OK: gap analysis complete`);
  } catch (err) {
    console.error("[Pipeline] Step 5 failed:", err);
    step5 = {
      analysis: {
        primaryPattern: {
          id: "demand_gap",
          title: "Análise parcial",
          description:
            "Gap analysis falhou, mas os dados de mercado foram coletados com sucesso.",
        },
        headlineInsight: `${step1.termCount} termos mapeados para "${input.product}" em ${input.region}.`,
        gaps: [],
      },
      promptVersion: "fallback",
      processingTimeMs: 0,
    };
  }

  // =========================================================================
  // ASSEMBLE RESULT + determine confidence
  // =========================================================================
  const totalProcessingTimeMs = Date.now() - pipelineStart;

  // Confidence based on data sources available
  const dataSourceCount = sourcesUsed.filter(
    (s) => s !== "claude_term_gen" && s !== "claude_gap_analysis"
  ).length;
  let confidenceLevel: "high" | "medium" | "low" = "low";
  if (dataSourceCount >= 3 && totalMonthlyVolume > 0) confidenceLevel = "high";
  else if (dataSourceCount >= 1) confidenceLevel = "medium";

  const result: Momento1Result = {
    leadId: "",
    generatedAt: new Date().toISOString(),
    terms: step1,
    volumes: step2,
    marketSizing: step3,
    influence: step4,
    gaps: step5,
    totalProcessingTimeMs,
    pipelineVersion: PIPELINE_VERSION,
    sourcesUsed,
    sourcesUnavailable,
    confidenceLevel,
  };

  console.log(
    `[Pipeline] Complete in ${totalProcessingTimeMs}ms | Confidence: ${confidenceLevel} | Sources: ${sourcesUsed.join(", ")} | Unavailable: ${sourcesUnavailable.join(", ")}`
  );

  return result;
}

// --- LEGACY EXPORTS ---
export function generateMockResults(product: string, region: string) {
  console.warn("[DEPRECATED] generateMockResults called");
  return {
    terms: [{ term: product, volume: 0, cpc: 0, position: "—" }],
    total_volume: 0, avg_cpc: 0, market_low: 0, market_high: 0,
    influence_percent: 0, source: "deprecated_mock", confidence: "none",
  };
}
