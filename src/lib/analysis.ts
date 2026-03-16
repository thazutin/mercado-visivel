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
import { executeAIVisibilityCheck } from "./pipeline/ai-visibility";
import { getIBGEMunicipalData, fetchAudienciaEstimada, geocodeNominatim } from "./pipeline/ibge";
import { inferirTargetAudiencia } from "./pipeline/audience-target";
import {
  createApifySerpScraper,
  createApifyMapsScraper,
  createApifyInstagramScraper,
  createGoogleAdsKPClient,
  createDataForSEOClient,
  createPerplexityAIVisibilityChecker,
  createDataForSEOOrganicChecker,
  createMapsCompetitionSearch,
} from "./pipeline/external-services";
import { calcularIndiceSaturacao, type CompetitionIndex } from "./pipeline/competition-index";
import { buscarContratacoesPNCP, type PNCPResumo } from "./pipeline/pncp";
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
  OrganicPresence,
  IBGEData,
  AudienciaEstimada,
  AudienciaTarget,
  AudienciaDisplay,
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

// --- Extract city via Claude Haiku ---
async function extractCity(region: string): Promise<string> {
  try {
    const claude = getClaudeClient();
    const res = await claude.createMessage({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Extraia apenas o nome completo da cidade (sem abreviações) desta string de endereço/região. Responda somente com o nome da cidade, sem mais nada. Exemplo: "R. Jundiaí" → "Jundiaí", "S. Paulo" → "São Paulo". Região: ${region}`,
      }],
    });
    const text = (res.content as any[]).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
    return text || region.split(',')[0].trim();
  } catch {
    return region.split(',')[0].trim();
  }
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
): Promise<{ volumes: TermVolumeData[]; source: string; geoLevel?: string; geoLabel?: string }> {

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

  // --- 2. DataForSEO — cidade com fallback rápido para estado (máx 2 chamadas) ---
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    const { getCityLocationCode, UF_LOCATION_CODES, BRAZIL_LOCATION_CODE } = await import('./pipeline/dataforseo-locations');
    const dfsClient = createDataForSEOClient({
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    });

    // Resolve cidade e estado
    const cityMatch = getCityLocationCode(region);
    const ufMatch = region.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    const stateCode = ufMatch ? UF_LOCATION_CODES[ufMatch[1]] : BRAZIL_LOCATION_CODE;
    const VOLUME_THRESHOLD = 3;

    // Chamada 1: cidade (se disponível) ou estado direto
    const primaryCode = cityMatch?.code || stateCode;
    const primaryLevel = cityMatch ? 'city' : (ufMatch ? 'state' : 'country');
    const primaryLabel = cityMatch?.cityName || (ufMatch?.[1] ?? 'Brasil');

    try {
      console.log(`[Analysis] DataForSEO: ${primaryLevel} (${primaryLabel}), code=${primaryCode}`);
      const volumes = await dfsClient(terms, region, primaryCode);
      const withData = volumes.filter(v => v.monthlyVolume > 0).length;
      console.log(`[Analysis] DataForSEO ${primaryLevel}: ${withData}/${volumes.length} termos com volume`);

      if (withData >= VOLUME_THRESHOLD || !cityMatch) {
        // Dados suficientes OU já estava no nível estado — aceitar
        return { volumes, source: 'dataforseo', geoLevel: primaryLevel, geoLabel: primaryLabel };
      }

      // Chamada 2: fallback para estado (só se a chamada cidade teve poucos dados)
      console.log(`[Analysis] Cidade com poucos dados (${withData}), fallback → estado ${ufMatch?.[1] || 'BR'}`);
      const stateVolumes = await dfsClient(terms, region, stateCode);
      const stateWithData = stateVolumes.filter(v => v.monthlyVolume > 0).length;
      console.log(`[Analysis] DataForSEO estado: ${stateWithData}/${stateVolumes.length} termos com volume`);
      return {
        volumes: stateVolumes,
        source: 'dataforseo',
        geoLevel: ufMatch ? 'state' : 'country',
        geoLabel: ufMatch?.[1] ?? 'Brasil',
      };
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
  // STEP 1 — Term Generation (Claude) + clientType Inference
  // =========================================================================
  let step1: Step1Output;
  let inferredClientType: 'b2c' | 'b2b' | 'b2g' = (input.clientType as any) || 'b2c';
  try {
    const step1Result = await executeStep1(input, claude, {
      model: "claude-sonnet-4-5-20250929",
      maxRetries: 1,
    });
    step1 = step1Result;
    inferredClientType = step1Result.inferredClientType || 'b2c';
    // Propagate inferred clientType to the input for downstream steps
    input.clientType = inferredClientType;
    console.log(`[Pipeline] Step 1 OK: ${step1.termCount} terms generated, clientType=${inferredClientType}`);

    // Fallback: if too few terms, supplement with a direct Claude query
    if (step1.termCount < 10) {
      console.warn(`[Pipeline] Step 1 generated only ${step1.termCount} terms — running fallback`);
      try {
        const fallbackResponse = await claude.createMessage({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 3000,
          temperature: 0.3,
          messages: [{
            role: "user",
            content: `Gere 20 termos de busca de alta intenção local para "${input.product}" na região "${input.region}".
            
Foco: termos que um consumidor digita no Google quando está pronto para comprar ou agendar.
Inclua variações com: nome da cidade, "perto de mim", preço, melhor, agendar, telefone, avaliação.

Responda APENAS em JSON, sem markdown:
{
  "terms": [
    { "term": "termo aqui", "intent": "transactional", "intentWeight": 0.9, "category": "core", "rationale": "motivo" }
  ]
}`,
          }],
        });
        const fallbackText = fallbackResponse.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
        const cleaned = fallbackText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.terms && parsed.terms.length > 0) {
          // Merge with existing terms, avoiding duplicates
          const existingTerms = new Set(step1.terms.map(t => t.term.toLowerCase()));
          const newTerms = parsed.terms
            .filter((t: any) => !existingTerms.has(t.term.toLowerCase()))
            .map((t: any) => ({
              term: t.term,
              intent: t.intent || "transactional",
              intentWeight: t.intentWeight || 0.8,
              category: t.category || "core",
              rationale: t.rationale || "fallback generation",
            }));
          step1.terms = [...step1.terms, ...newTerms];
          step1.termCount = step1.terms.length;
          sourcesUsed.push("claude_fallback_terms");
          console.log(`[Pipeline] Fallback added ${newTerms.length} terms — total now ${step1.termCount}`);
        }
      } catch (fallbackErr) {
        console.error("[Pipeline] Fallback term generation failed:", fallbackErr);
      }
    }
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

  // Extract & auto-discover Instagram handles
  const instagramHandles: string[] = [];
  const businessHandle = formData.instagram
    ? formData.instagram.replace(/@/g, "").replace(/https?:\/\/(www\.)?instagram\.com\//g, "").replace(/\//g, "").trim()
    : "";
  if (businessHandle.length > 1) {
    instagramHandles.push(businessHandle);
  }

  // Add any manually declared competitors
  for (const c of formData.competitors || []) {
    if (c.instagram && c.instagram.length > 1) {
      const cleaned = c.instagram.replace(/@/g, "").replace(/https?:\/\/(www\.)?instagram\.com\//g, "").replace(/\//g, "").trim();
      if (cleaned.length > 1) instagramHandles.push(cleaned);
    }
  }

  // AUTO-DISCOVER competitors via SERP if no competitors declared
  if (instagramHandles.length <= 1 && apifyConfig) {
    try {
      console.log(`[Pipeline] Auto-discovering Instagram competitors for "${input.product}" in "${input.region}"...`);
      const serpScraper = createApifySerpScraper(apifyConfig);
      const searchQuery = `instagram ${input.product} ${input.region.split(",")[0].trim()}`;
      const discoveryResults = await withTimeout(
        serpScraper([searchQuery], input.region, undefined),
        20_000,
        "Competitor Discovery",
      );
      
      // Extract Instagram handles from SERP results
      const discoveredHandles: string[] = [];
      for (const result of discoveryResults) {
        const url = result.url || result.link || "";
        const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (match && match[1] && !["explore", "p", "reel", "stories", "accounts"].includes(match[1])) {
          const handle = match[1].toLowerCase();
          if (handle !== businessHandle.toLowerCase() && !discoveredHandles.includes(handle)) {
            discoveredHandles.push(handle);
          }
        }
      }
      
      // Take top 4 discovered competitors
      const competitorHandles = discoveredHandles.slice(0, 4);
      instagramHandles.push(...competitorHandles);
      if (competitorHandles.length > 0) {
        sourcesUsed.push("auto_competitor_discovery");
        console.log(`[Pipeline] Discovered ${competitorHandles.length} competitors: [${competitorHandles.join(", ")}]`);
      }
    } catch (err) {
      console.warn("[Pipeline] Competitor auto-discovery failed:", (err as Error).message);
    }
  }

  console.log(`[Pipeline] Instagram handles to scrape: [${instagramHandles.join(", ")}] (business: "${businessHandle}", total: ${instagramHandles.length})`);

  // Extract domain for SERP position matching
  const siteDomain = formData.site
    ? new URL(formData.site.startsWith("http") ? formData.site : `https://${formData.site}`).hostname.replace("www.", "")
    : undefined;

  // Run ALL external calls in parallel (Apify + DataForSEO at the same time)
  let serpPositions: SerpPosition[] = [];
  let mapsPresence: MapsPresence | null = null;
  let instagramProfiles: InstagramProfile[] = [];
  let organicPresence: OrganicPresence | null = null;

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

    // 2. SERP scraping (timeout: 45s — Apify actor needs warm-up time)
    parallelPromises.push(
      withTimeout(
        (async () => {
          const t0 = Date.now();
          console.log('[SERP] started');
          try {
            const r = await serpScraper(topTerms, input.region, siteDomain);
            sourcesUsed.push("apify_serp");
            console.log(`[SERP] completed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${r.length} positions`);
            return r;
          } catch (err) {
            console.error(`[SERP] failed after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, (err as Error).message);
            throw err;
          }
        })(),
        45_000,
        "SERP",
      )
    );
    promiseLabels.push("serp");

    // 3. Google Maps (timeout: 45s — Google Places API can be slow)
    parallelPromises.push(
      withTimeout(
        (async () => {
          const t0 = Date.now();
          console.log('[Maps] started');
          try {
            const r = await mapsScraper(input.businessName || input.product, input.region);
            sourcesUsed.push("apify_maps");
            console.log(`[Maps] completed in ${((Date.now() - t0) / 1000).toFixed(1)}s — found=${r.found}, rating=${r.rating}`);
            return r;
          } catch (err) {
            console.error(`[Maps] failed after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, (err as Error).message);
            throw err;
          }
        })(),
        45_000,
        "Maps",
      )
    );
    promiseLabels.push("maps");

    // 4. Instagram (timeout: 60s — Instagram actor is heavier, runs 2 parallel calls internally)
    parallelPromises.push(
      instagramHandles.length > 0
        ? withTimeout(
            (async () => {
              const t0 = Date.now();
              console.log(`[Instagram] started — ${instagramHandles.length} handles`);
              try {
                const r = await instagramScraper(instagramHandles);
                sourcesUsed.push("apify_instagram");
                console.log(`[Instagram] completed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${r.length} profiles`);
                return r;
              } catch (err) {
                console.error(`[Instagram] failed after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, (err as Error).message);
                throw err;
              }
            })(),
            60_000,
            "Instagram",
          )
        : Promise.resolve([])
    );
    promiseLabels.push("instagram");

    // 5. Organic position check (se site declarado + DataForSEO configurado)
    if (siteDomain && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
      const organicChecker = createDataForSEOOrganicChecker({
        login: process.env.DATAFORSEO_LOGIN,
        password: process.env.DATAFORSEO_PASSWORD,
      });
      parallelPromises.push(
        withTimeout(
          (async () => {
            const t0 = Date.now();
            console.log('[DataForSEO Organic] started');
            try {
              const r = await organicChecker(siteDomain, topTerms, input.region);
              sourcesUsed.push("dataforseo_organic");
              console.log(`[DataForSEO Organic] completed in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${r.totalRanked} terms ranked, top=${r.topPosition}`);
              return r;
            } catch (err) {
              console.error(`[DataForSEO Organic] failed after ${((Date.now() - t0) / 1000).toFixed(1)}s:`, (err as Error).message);
              throw err;
            }
          })(),
          30_000,
          "Organic",
        )
      );
      promiseLabels.push("organic");
    }
  } else {
    console.warn("[Pipeline] Apify not configured — skipping external data");
    sourcesUnavailable.push("serp_scraper", "google_maps", "instagram");
  }

  // Execute ALL in parallel
  const parallelStart = Date.now();
  const parallelResults = await Promise.allSettled(parallelPromises);
  console.log(`[Pipeline] All parallel calls resolved in ${Date.now() - parallelStart}ms`);
  for (let i = 0; i < promiseLabels.length; i++) {
    const r = parallelResults[i];
    console.log(`[Pipeline]   ${promiseLabels[i]}: ${r.status}${r.status === 'rejected' ? ` (${(r as any).reason?.message || r.reason})` : ''}`);
  }

  // Collect volume results
  let fetchedVolumes: TermVolumeData[] = [];
  let volumeSource = 'none';
  let volumeGeoLevel: string | undefined;
  let volumeGeoLabel: string | undefined;
  const volumeResult = parallelResults[0];
  if (volumeResult.status === "fulfilled") {
    fetchedVolumes = volumeResult.value.volumes;
    volumeSource = volumeResult.value.source;
    volumeGeoLevel = volumeResult.value.geoLevel;
    volumeGeoLabel = volumeResult.value.geoLabel;
    if (volumeGeoLevel) {
      console.log(`[Pipeline] Volume geo: ${volumeGeoLevel} (${volumeGeoLabel})`);
    }
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

    // Collect organic results (index 4, only if organic promise was added)
    const organicIdx = promiseLabels.indexOf("organic");
    if (organicIdx >= 0) {
      const organicResult = parallelResults[organicIdx];
      if (organicResult.status === "fulfilled") {
        organicPresence = organicResult.value;
      } else {
        console.error("[Pipeline] Organic failed:", organicResult.reason);
      }
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
  // Extract city + resolve lat/lng (reused by IBGE, Perplexity, etc.)
  // =========================================================================
  const extractedCity = await extractCity(input.region);
  // Extrai sigla UF do endereço completo (ex: "R. Jundiaí, 604 - Matriz, Mauá - SP, 09370-180" → "SP")
  const ufMatch = input.region.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  const extractedState = ufMatch ? ufMatch[1] : '';
  console.log(`[Pipeline] Cidade extraída: "${extractedCity}", estado: "${extractedState}" (de region="${input.region.slice(0, 80)}")`);

  // Resolve lat/lng: form (Google Places) → Nominatim fallback
  let pipelineLat = formData.lat || 0;
  let pipelineLng = formData.lng || 0;
  if (!pipelineLat || !pipelineLng) {
    console.log(`[Pipeline] Lat/lng não veio do form (lat=${formData.lat}, lng=${formData.lng}) — geocodificando via Nominatim...`);
    try {
      const geo = await geocodeNominatim(extractedCity, extractedState);
      if (geo) {
        pipelineLat = geo.lat;
        pipelineLng = geo.lng;
        console.log(`[Pipeline] Nominatim geocoding OK: lat=${pipelineLat}, lng=${pipelineLng}`);
      } else {
        console.warn('[Pipeline] Nominatim geocoding retornou null — audiência sem coordenadas');
      }
    } catch (err) {
      console.warn('[Pipeline] Nominatim geocoding falhou:', (err as Error).message);
    }
  } else {
    console.log(`[Pipeline] Lat/lng do form (Google Places): lat=${pipelineLat}, lng=${pipelineLng}`);
  }

  // =========================================================================
  // STEP 3 — Market Sizing (com dados IBGE opcionais)
  // =========================================================================
  const category = detectCategory(input.product, input.differentiator);

  let ibgeData: IBGEData | null = null;
  try {
    ibgeData = await getIBGEMunicipalData(extractedCity, input.region);
    if (ibgeData) {
      console.log(`[Pipeline] IBGE OK: ${ibgeData.municipio}/${ibgeData.estado} — pop=${ibgeData.populacao.toLocaleString('pt-BR')}`);
    }
  } catch (err) {
    console.warn('[Pipeline] IBGE falhou/ignorado:', (err as Error).message);
  }

  const step3: Step3Output = calculateMarketSizing(
    step2,
    serpPositions,
    input.ticket,
    category,
    ibgeData,
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
  // (businessHandle already defined above in Instagram extraction section)
  
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
    recentPostsCount: 0,
    recentAvgReach: 0,
    recentEngagementRate: 0,
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

  // LinkedIn check for B2B
  let linkedinPresent = false;
  const linkedinFromForm = (formData as any).linkedin;
  if (linkedinFromForm && linkedinFromForm.length > 5) {
    // LinkedIn URL provided in form — confirmed presence
    linkedinPresent = true;
    console.log(`[Pipeline] LinkedIn from form: "${linkedinFromForm}" → confirmed`);
  } else if (inferredClientType === 'b2b' && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    // B2B inferred but no LinkedIn in form — search via SERP
    try {
      const organicChecker = createDataForSEOOrganicChecker({
        login: process.env.DATAFORSEO_LOGIN,
        password: process.env.DATAFORSEO_PASSWORD,
      });
      const linkedinResult = await withTimeout(
        organicChecker('linkedin.com/company', [`"${input.businessName || input.product}" site:linkedin.com/company`], input.region),
        10_000,
        "LinkedIn Check",
      );
      linkedinPresent = linkedinResult.totalRanked > 0;
      console.log(`[Pipeline] LinkedIn B2B SERP check: present=${linkedinPresent}`);
    } catch (err) {
      console.warn('[Pipeline] LinkedIn check failed:', (err as Error).message);
    }
  }

  // NOTE: step4 (composite influence) is calculated AFTER aiVisibility below,
  // so that D4 dimension can use real AI visibility data.
  // Placeholder declared here, assigned after line ~833.
  let step4: Step4Output;

  // =========================================================================
  // COMPETITION INDEX — Índice de Saturação de Mercado
  // =========================================================================
  let competitionIndex: CompetitionIndex | null = null;
  try {
    if (apifyConfig && process.env.GOOGLE_PLACES_API_KEY) {
      const competitionSearch = createMapsCompetitionSearch(apifyConfig);
      const shortRegion = input.region.split(',')[0].trim();
      const competitorResults = await withTimeout(
        competitionSearch(input.product, shortRegion),
        10_000,
        "MapsCompetition",
      );
      if (competitorResults.length > 0) {
        // Mapeia para o formato esperado por calcularIndiceSaturacao
        const mapsForIndex = competitorResults.map(c => ({
          title: c.name,
          website: c.website,
          rating: c.rating,
          reviewCount: c.reviewCount,
        }));
        competitionIndex = calcularIndiceSaturacao(mapsForIndex, totalMonthlyVolume);
        sourcesUsed.push("maps_competition");
      }
    }
  } catch (err) {
    console.warn("[Pipeline] Competition Index failed:", (err as Error).message);
  }

  // =========================================================================
  // AUDIÊNCIA ESTIMADA (IBGE + Claude Haiku) — roda em paralelo com AI Visibility
  // =========================================================================
  const isNacional = /brasil.*nacional|nacional|todo o brasil/i.test(input.region);

  const audienciaPromise = (async (): Promise<{ estimada: AudienciaEstimada | null; target: AudienciaTarget | null }> => {
    try {
      const estimada = await fetchAudienciaEstimada(
        extractedCity,
        extractedState,
        isNacional,
        pipelineLat,
        pipelineLng,
      );
      if (!estimada) return { estimada: null, target: null };

      const target = await inferirTargetAudiencia(
        input.product,
        input.differentiator || input.product,
        estimada.populacaoRaio,
        claude,
        input.clientType || 'b2c',
      );
      return { estimada, target };
    } catch (err) {
      console.warn('[Pipeline] Audiência falhou/ignorado:', (err as Error).message);
      return { estimada: null, target: null };
    }
  })();

  // =========================================================================
  // STEP 4b — AI Visibility Check (DataForSEO SERP real)
  // =========================================================================
  let aiVisibility: { score: number; summary: string; likelyMentioned: boolean; factors: any[]; competitorMentions: any[]; processingTimeMs: number } | null = null;
  try {
    const hasSite = !!(formData.site && formData.site.length > 3);

    // businessName: nome real do negócio via Maps (primário) ou null
    const mapsBusinessName = mapsPresence?.found ? (mapsPresence as any).businessName || null : null;

    // DataForSEO client para SERP de descoberta
    const dataForSEOClient = (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
      ? createDataForSEOClient({
          login: process.env.DATAFORSEO_LOGIN,
          password: process.env.DATAFORSEO_PASSWORD,
        })
      : undefined;

    // Perplexity AI client para verificar menções em respostas de IA (5 dimensões geográficas)
    const perplexityClient = process.env.PERPLEXITY_API_KEY
      ? createPerplexityAIVisibilityChecker(claude)
      : undefined;

    aiVisibility = await withTimeout(
      executeAIVisibilityCheck(
        input.product,
        input.region,
        mapsBusinessName,                          // nome real do Maps
        businessHandle || null,                    // handle do Instagram como fallback
        hasSite,
        mapsPresence?.found || false,
        mapsPresence?.rating || null,
        mapsPresence?.reviewCount || null,
        serpPositions.filter(sp => sp.position && sp.position <= 10).length,
        serpPositions.length,
        (formData.competitors || []).filter(c => c.name && c.name.length > 1),
        dataForSEOClient ? { getKeywordVolumes: dataForSEOClient } : undefined,
        undefined,                                 // claude client deprecated em v2
        perplexityClient,
      ),
      20_000,
      "AI Visibility",
    );
    sourcesUsed.push("ai_visibility");
    console.log(`[Pipeline] AI Visibility OK: score=${aiVisibility.score}, mentioned=${aiVisibility.likelyMentioned}, method=${(aiVisibility as any)._raw?.matchMethod}`);
  } catch (err) {
    console.warn("[Pipeline] AI Visibility failed/skipped:", (err as Error).message);
  }

  // =========================================================================
  // STEP 4 — Composite Influence (4D model — needs aiVisibility)
  // =========================================================================
  step4 = calculateCompositeInfluence(
    googleInfluence,
    instagramInfluence,
    webInfluence,
    organicPresence,
    inferredClientType,
    linkedinPresent,
    aiVisibility ? { score: aiVisibility.score, likelyMentioned: aiVisibility.likelyMentioned } : null,
  );
  console.log(`[Pipeline] Step 4 OK: influence ${step4.influence.totalInfluence}%`);

  // =========================================================================
  // STEP 4c — PNCP (Contratações Públicas) — only for B2G
  // =========================================================================
  let pncpData: PNCPResumo | null = null;
  if (inferredClientType === 'b2g') {
    try {
      pncpData = await withTimeout(
        buscarContratacoesPNCP(input.product, extractedState || undefined),
        12_000,
        "PNCP",
      );
      if (pncpData && pncpData.totalEncontradas > 0) {
        sourcesUsed.push("pncp");
        console.log(`[Pipeline] PNCP OK: ${pncpData.totalEncontradas} contratações, R$${(pncpData.valorTotalEstimado / 1000).toFixed(0)}k`);
      }
    } catch (err) {
      console.warn("[Pipeline] PNCP failed/skipped:", (err as Error).message);
    }
  }

  // =========================================================================
  // STEP 5 — Gap Analysis + Work Routes (Claude with real data + AI visibility)
  // =========================================================================
  let step5: Step5Output;
  try {
    step5 = await executeStep5(input, step1, step2, step3, step4, claude, {
      model: "claude-sonnet-4-5-20250929",
      aiVisibility: aiVisibility ? {
        score: aiVisibility.score,
        summary: aiVisibility.summary,
        likelyMentioned: aiVisibility.likelyMentioned,
      } : null,
      competitionIndex: competitionIndex ? {
        label: competitionIndex.label,
        indexValue: competitionIndex.indexValue,
        activeCompetitors: competitionIndex.activeCompetitors,
        totalCompetitors: competitionIndex.totalCompetitors,
      } : null,
      pncp: pncpData,
    });
    sourcesUsed.push("claude_gap_analysis");
    console.log(`[Pipeline] Step 5 OK: gap analysis + work routes complete`);
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
  // AWAIT AUDIÊNCIA (started in parallel with AI Visibility + Step 5)
  // =========================================================================
  const audienciaResult = await audienciaPromise;
  let audienciaDisplay: AudienciaDisplay | null = null;
  if (audienciaResult.estimada && audienciaResult.target) {
    audienciaDisplay = {
      populacaoRaio: audienciaResult.estimada.populacaoRaio,
      raioKm: audienciaResult.estimada.raioKm,
      densidade: audienciaResult.estimada.densidade,
      municipioNome: audienciaResult.estimada.municipioNome,
      targetProfile: audienciaResult.target.targetProfile,
      estimatedPercentage: audienciaResult.target.estimatedPercentage,
      audienciaTarget: audienciaResult.target.audienciaTarget,
      rationale: audienciaResult.target.rationale,
      ibgeAno: audienciaResult.estimada.ibgeAno,
    };
    sourcesUsed.push('ibge_audiencia');
    console.log(`[Pipeline] Audiência OK: ${audienciaDisplay.populacaoRaio.toLocaleString('pt-BR')} pop raio, ${audienciaDisplay.audienciaTarget.toLocaleString('pt-BR')} target`);
  } else if (audienciaResult.estimada) {
    // Temos IBGE mas não target — exibe só população
    audienciaDisplay = {
      populacaoRaio: audienciaResult.estimada.populacaoRaio,
      raioKm: audienciaResult.estimada.raioKm,
      densidade: audienciaResult.estimada.densidade,
      municipioNome: audienciaResult.estimada.municipioNome,
      targetProfile: '',
      estimatedPercentage: 0,
      audienciaTarget: 0,
      rationale: '',
      ibgeAno: audienciaResult.estimada.ibgeAno,
    };
    sourcesUsed.push('ibge_audiencia');
    console.log(`[Pipeline] Audiência parcial: ${audienciaDisplay.populacaoRaio.toLocaleString('pt-BR')} pop raio (sem target)`);
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
    // @ts-ignore — extending Momento1Result with runtime data
    volumeGeo: volumeGeoLevel ? { level: volumeGeoLevel, label: volumeGeoLabel } : null,
    ibgeData: ibgeData || null,
    audiencia: audienciaDisplay,
    competitionIndex: competitionIndex || null,
    clientType: inferredClientType,
    pncp: pncpData,
    aiVisibility: aiVisibility ? {
      score: aiVisibility.score,
      summary: aiVisibility.summary,
      likelyMentioned: aiVisibility.likelyMentioned,
      factors: aiVisibility.factors,
      competitorMentions: aiVisibility.competitorMentions,
    } : null,
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
