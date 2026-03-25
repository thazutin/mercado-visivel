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
  extractLocationCodeFromRegion,
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

// --- Reverse geocoding via Google (fonte de verdade para município) ---
async function reverseGeocodeCity(lat: number, lng: number): Promise<{ city: string; state: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !lat || !lng) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.results || data.results.length === 0) return null;

    // Procura nos componentes do primeiro resultado
    for (const result of data.results) {
      const components = result.address_components || [];
      let city = '';
      let state = '';

      for (const comp of components) {
        const types: string[] = comp.types || [];
        // administrative_area_level_2 = município no Brasil
        if (types.includes('administrative_area_level_2') && !city) {
          city = comp.long_name;
        }
        // locality como fallback
        if (types.includes('locality') && !city) {
          city = comp.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = comp.short_name; // "SP", "RJ", etc.
        }
      }

      if (city) {
        console.log(`[geocode] município resolvido: ${city} (administrative_area_level_2), estado: ${state}`);
        return { city, state };
      }
    }
    console.log(`[geocode] nenhum município encontrado para lat=${lat}, lng=${lng}`);
    return null;
  } catch (err) {
    console.warn('[ReverseGeocode] Falhou:', (err as Error).message);
    return null;
  }
}

// --- Extract city via Claude Haiku (fallback quando não há lat/lng) ---
function extractCityFromAddressString(region: string): string {
  // Tenta extrair município do padrão "Bairro, Cidade - UF" ou "Cidade - UF"
  const dashMatch = region.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2}/);
  if (dashMatch) return dashMatch[1].trim();
  // Fallback: último segmento antes de " - UF"
  const simpleDash = region.match(/([^,-]+)\s*-\s*[A-Z]{2}/);
  if (simpleDash) return simpleDash[1].trim();
  // Último recurso: primeiro segmento (pode ser rua — melhor que nada)
  return region.split(',')[0].trim();
}

async function extractCity(region: string): Promise<string> {
  try {
    const claude = getClaudeClient();
    const res = await claude.createMessage({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Extraia apenas o nome do MUNICÍPIO (cidade) desta string de endereço brasileiro. Ignore nomes de ruas/bairros. Responda somente com o nome da cidade. Exemplo: "R. Jundiaí, 407 - Matriz, Mauá - SP" → "Mauá", "Av. Paulista, 1000 - Bela Vista, São Paulo - SP" → "São Paulo". Região: ${region}`,
      }],
    });
    const text = (res.content as any[]).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
    if (text) {
      console.log(`[geocode] município resolvido (Claude Haiku): ${text}`);
      return text;
    }
    const fallback = extractCityFromAddressString(region);
    console.log(`[geocode] município resolvido (fallback regex): ${fallback}`);
    return fallback;
  } catch {
    const fallback = extractCityFromAddressString(region);
    console.log(`[geocode] município resolvido (fallback regex, após erro): ${fallback}`);
    return fallback;
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
  radiusKm: number = 5,
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
      const locationCode = extractLocationCodeFromRegion(region);
      const volumes = await kpClient(terms, region, locationCode);
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

  // --- 2. DataForSEO — cidade/região/estado em PARALELO, usa o mais específico ---
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    const { getCityLocationCode, getRegionalGroup, getRegionalProxyCode, UF_LOCATION_CODES, BRAZIL_LOCATION_CODE } = await import('./pipeline/dataforseo-locations');
    const dfsClient = createDataForSEOClient({
      login: process.env.DATAFORSEO_LOGIN,
      password: process.env.DATAFORSEO_PASSWORD,
    });

    const cityMatch = getCityLocationCode(region);
    const ufMatch = region.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    const stateCode = ufMatch ? UF_LOCATION_CODES[ufMatch[1]] : BRAZIL_LOCATION_CODE;
    const VOLUME_THRESHOLD = 3;

    // Monta chamadas em paralelo: cidade + região + estado
    type GeoCall = { level: string; label: string; code: number; promise: Promise<TermVolumeData[]> };
    const calls: GeoCall[] = [];

    // Sempre inclui estado (garantia de dados)
    calls.push({
      level: ufMatch ? 'state' : 'country',
      label: ufMatch?.[1] ?? 'Brasil',
      code: stateCode,
      promise: dfsClient(terms, region, stateCode),
    });

    // Cidade (se tem code próprio e é diferente do estado)
    if (cityMatch && cityMatch.code !== stateCode) {
      calls.push({
        level: 'city',
        label: cityMatch.cityName,
        code: cityMatch.code,
        promise: dfsClient(terms, region, cityMatch.code),
      });

      // Região (proxy: maior cidade do grupo, diferente da cidade do lead)
      const group = getRegionalGroup(cityMatch.cityName);
      if (group) {
        const proxy = getRegionalProxyCode(group.groupName, cityMatch.cityName);
        if (proxy && proxy.code !== cityMatch.code && proxy.code !== stateCode) {
          calls.push({
            level: 'regional',
            label: group.groupName,
            code: proxy.code,
            promise: dfsClient(terms, region, proxy.code),
          });
        }
      }
    }

    console.log(`[Analysis] DataForSEO: ${calls.length} chamadas em paralelo: ${calls.map(c => `${c.level}(${c.label})`).join(', ')}`);

    try {
      const results = await Promise.allSettled(calls.map(c => c.promise));

      // Avalia resultados do mais específico (city) ao mais genérico (state)
      const priority = ['city', 'regional', 'state', 'country'];
      const ranked = calls
        .map((call, i) => ({
          ...call,
          result: results[i],
          withData: results[i].status === 'fulfilled'
            ? results[i].value.filter(v => v.monthlyVolume > 0).length
            : 0,
        }))
        .sort((a, b) => priority.indexOf(a.level) - priority.indexOf(b.level));

      for (const r of ranked) {
        console.log(`[Analysis] DataForSEO ${r.level} (${r.label}): ${r.result.status === 'fulfilled' ? `${r.withData}/${r.result.value.length} termos` : 'FALHOU'}`);
      }

      // Escolhe o mais específico com dados suficientes
      for (const r of ranked) {
        if (r.result.status === 'fulfilled' && (r.withData >= VOLUME_THRESHOLD || r.level === 'state' || r.level === 'country')) {
          console.log(`[Analysis] ✅ Usando ${r.level} (${r.label})`);
          return { volumes: r.result.value, source: 'dataforseo', geoLevel: r.level, geoLabel: r.label };
        }
      }

      // Se nenhum passou o threshold, usa o que tiver mais dados
      const best = ranked.filter(r => r.result.status === 'fulfilled').sort((a, b) => b.withData - a.withData)[0];
      if (best && best.result.status === 'fulfilled') {
        console.log(`[Analysis] ⚠️ Nenhum passou threshold, usando ${best.level} (${best.label}) com ${best.withData} termos`);
        return { volumes: best.result.value, source: 'dataforseo', geoLevel: best.level, geoLabel: best.label };
      }
    } catch (err) {
      console.error('[Analysis] DataForSEO paralelo falhou:', err);
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
            content: `Gere 20 termos de busca de alta intenção local para "${input.product}" na região "${resolvedRegion}".
            
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
  // RESOLVE MUNICIPALITY — must run BEFORE any query that uses location
  // Source of truth: lat/lng → Google Geocoding (administrative_area_level_2)
  // Fallback: Claude Haiku extraction from address string
  // =========================================================================
  const ufMatch = input.region.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  let extractedState = ufMatch ? ufMatch[1] : '';

  let pipelineLat = formData.lat || 0;
  let pipelineLng = formData.lng || 0;

  let extractedCity = '';
  if (pipelineLat && pipelineLng) {
    console.log(`[Pipeline] Lat/lng do form (Google Places): lat=${pipelineLat}, lng=${pipelineLng}`);
    const reverseResult = await reverseGeocodeCity(pipelineLat, pipelineLng);
    if (reverseResult) {
      extractedCity = reverseResult.city;
      if (reverseResult.state) extractedState = reverseResult.state;
      console.log(`[Pipeline] Reverse geocoding → cidade="${extractedCity}", estado="${extractedState}"`);
    }
  }

  if (!extractedCity) {
    extractedCity = await extractCity(input.region);
    console.log(`[Pipeline] Claude Haiku → cidade="${extractedCity}"`);
  }

  // resolvedRegion: município limpo para usar em TODAS as queries externas
  const resolvedRegion = extractedState
    ? `${extractedCity} - ${extractedState}`
    : extractedCity || input.region;

  console.log(`[Pipeline] Município resolvido: "${resolvedRegion}" (cidade="${extractedCity}", estado="${extractedState}", region original="${input.region.slice(0, 80)}")`);

  // Resolve lat/lng se não veio do form
  if (!pipelineLat || !pipelineLng) {
    console.log(`[Pipeline] Lat/lng não veio do form — geocodificando via Nominatim...`);
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
      console.log(`[Pipeline] Auto-discovering Instagram competitors for "${input.product}" in "${resolvedRegion}"...`);
      const serpScraper = createApifySerpScraper(apifyConfig);
      console.log(`[pipeline] município usado em Competitor Discovery SERP:`, extractedCity);
      const searchQuery = `instagram ${input.product} ${extractedCity}`;
      const discoveryResults = await withTimeout(
        serpScraper([searchQuery], resolvedRegion, undefined),
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

  // ── Calcula raio dinâmico ANTES das chamadas paralelas ──
  const isNacional = /brasil.*nacional|nacional|todo o brasil/i.test(input.region);
  let resolvedRadiusKm = 5; // default médio
  let precomputedAudiencia: AudienciaEstimada | null = null;
  try {
    precomputedAudiencia = await fetchAudienciaEstimada(
      extractedCity, extractedState, isNacional,
      pipelineLat ?? undefined, pipelineLng ?? undefined, input.product,
    );
    if (precomputedAudiencia?.raioKm) {
      resolvedRadiusKm = precomputedAudiencia.raioKm;
    }
    console.log(`[Pipeline] Raio dinâmico: ${resolvedRadiusKm}km para "${input.product}"`);
  } catch (err) {
    console.warn('[Pipeline] fetchAudienciaEstimada preview falhou, usando raio default 5km:', (err as Error).message);
  }

  // Build all parallel promises
  const allTermStrings = step1.terms.map(t => t.term);
  const parallelPromises: Promise<any>[] = [];
  const promiseLabels: string[] = [];

  // 1. DataForSEO volumes (runs in parallel with Apify — biggest speed win)
  console.log(`[pipeline] município usado em Volumes (DataForSEO):`, extractedCity);
  parallelPromises.push(
    withTimeout(
      fetchTermVolumes(allTermStrings, resolvedRegion, resolvedRadiusKm),
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
            console.log(`[pipeline] município usado em SERP:`, extractedCity);
            const r = await serpScraper(topTerms, resolvedRegion, siteDomain);
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
            console.log(`[pipeline] município usado em Maps:`, extractedCity);
            const r = await mapsScraper(input.businessName || input.product, resolvedRegion, resolvedRadiusKm * 1000);
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
              console.log(`[pipeline] município usado em DataForSEO Organic:`, extractedCity);
              const r = await organicChecker(siteDomain, topTerms, resolvedRegion);
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
  // STEP 3 — Market Sizing (com dados IBGE opcionais)
  // =========================================================================
  const category = detectCategory(input.product, input.differentiator);

  let ibgeData: IBGEData | null = null;
  try {
    console.log(`[pipeline] município usado em IBGE:`, extractedCity);
    ibgeData = await getIBGEMunicipalData(extractedCity, resolvedRegion);
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
        organicChecker('linkedin.com/company', [`"${input.businessName || input.product}" site:linkedin.com/company`], resolvedRegion),
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
      console.log(`[pipeline] município usado em Competition Index:`, extractedCity);
      const competitorResults = await withTimeout(
        competitionSearch(input.product, resolvedRegion),
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
  // AUDIÊNCIA ESTIMADA — reutiliza precomputedAudiencia (calculado antes dos scrapers)
  // =========================================================================
  console.log(`[pipeline] município usado em Audiência (IBGE):`, extractedCity);
  const audienciaPromise = (async (): Promise<{ estimada: AudienciaEstimada | null; target: AudienciaTarget | null }> => {
    try {
      const estimada = precomputedAudiencia;
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

    console.log(`[pipeline] município usado em AI Visibility:`, extractedCity);
    aiVisibility = await withTimeout(
      executeAIVisibilityCheck(
        input.product,
        resolvedRegion,
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
        headlineInsight: `${step1.termCount} termos mapeados para "${input.product}" em ${resolvedRegion}.`,
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

// ============================================================================
// POST-DIAGNOSIS ENRICHMENT — Runs after plan generation
// Checklist (step6) + Seasonality (step7) + Content generation
// All 3 run in parallel via Promise.allSettled — function only resolves when all complete
// ============================================================================

export async function runPostDiagnosisEnrichment(
  leadId: string,
  pipelineResult: Momento1Result,
  formData: { name?: string; product: string; region: string; client_type?: string },
): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const influenceBreakdown = (pipelineResult.influence?.influence as any)?.breakdown || null;
  const clientType = (pipelineResult as any).clientType || formData.client_type || 'b2c';
  const terms = pipelineResult.terms.terms.map(t => t.term);

  const gapRoutes = (pipelineResult.gaps?.analysis?.workRoutes || []).map((r: any) => ({
    title: r.title || '',
    description: r.rationale || r.connection || '',
    timeframe: r.horizon || '',
  }));

  console.log(`[Enrichment] Iniciando enriquecimento para lead ${leadId} (3 etapas em paralelo)`);

  const results = await Promise.allSettled([

    // 1. Plano de ação (step 6)
    (async () => {
      const { executeStep6Checklist } = await import("./pipeline/step6-checklist");
      const checklist = await executeStep6Checklist({
        name: formData.name || formData.product,
        business_category: formData.product,
        region: formData.region,
        influence_score: pipelineResult.influence.influence.totalInfluence,
        influence_breakdown: influenceBreakdown,
        client_type: clientType,
        gap_routes: gapRoutes.length > 0 ? gapRoutes : undefined,
      });
      if (checklist.items.length === 0) {
        throw new Error('executeStep6Checklist retornou items vazio — possível falha interna no step6');
      }
      await supabase.from("checklists").delete().eq("lead_id", leadId);
      const { error: checklistErr } = await supabase.from("checklists").insert({
        lead_id: leadId,
        items: checklist.items,
      });
      if (checklistErr) throw new Error(`Supabase checklist insert falhou: ${checklistErr.message}`);
      console.log(`[Enrichment] Plano de ação salvo: ${checklist.items.length} itens para lead ${leadId}`);
    })(),

    // 2. Sazonalidade (step 7)
    (async () => {
      const { data: latestDiag } = await supabase
        .from("diagnoses")
        .select("id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!latestDiag) {
        console.error("[Enrichment] Nenhum diagnóstico encontrado para lead", leadId);
        return;
      }

      const { executeStep7Seasonality } = await import("./pipeline/step7-seasonality");
      const termVolumes = pipelineResult.volumes?.termVolumes || [];
      let seasonality = await executeStep7Seasonality(terms, termVolumes);
      console.log("[Enrichment] seasonality:", JSON.stringify(seasonality));

      if (!seasonality) {
        console.warn("[Enrichment] Seasonality null — usando fallback genérico");
        seasonality = {
          months: [
            { month: "Jan", volume: 0 }, { month: "Fev", volume: 0 },
            { month: "Mar", volume: 0 }, { month: "Abr", volume: 0 },
            { month: "Mai", volume: 0 }, { month: "Jun", volume: 0 },
            { month: "Jul", volume: 0 }, { month: "Ago", volume: 0 },
            { month: "Set", volume: 0 }, { month: "Out", volume: 0 },
            { month: "Nov", volume: 0 }, { month: "Dez", volume: 0 },
          ],
          peak_month: "dados insuficientes",
          low_month: "dados insuficientes",
        };
      }

      // Gera macro_context via Claude Haiku
      const macroPrompt = `Você é um analista econômico especialista em mercado local brasileiro.

Negócio: ${formData.product} em ${formData.region}
Setor inferido: ${clientType === 'b2b' ? 'B2B' : clientType === 'b2g' ? 'B2G/Governo' : 'B2C local'}

Gere um contexto macroeconômico relevante para este negócio em 2025, considerando:
- Tendências de consumo no setor específico
- Fatores econômicos que afetam a demanda local (inflação, emprego, renda)
- Sazonalidade econômica do setor
- Oportunidades ou ameaças do cenário atual

Responda APENAS em JSON:
{
  "summary": "2-3 parágrafos diretos sobre o cenário econômico atual para este negócio",
  "indicators": [
    { "name": "Nome do indicador", "value": "valor ou tendência", "impact": "positive|neutral|negative", "description": "o que significa para o negócio" }
  ],
  "outlook": "positive|neutral|negative",
  "key_opportunity": "principal oportunidade econômica atual para este setor"
}

Gere APENAS o JSON.`;

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      let macro_context: any = { summary: "Contexto macroeconômico não disponível.", indicators: [], outlook: "neutral", key_opportunity: "" };
      try {
        const macroResponse = await claudeClient.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          temperature: 0.3,
          messages: [{ role: 'user', content: macroPrompt }],
        });
        const macroText = macroResponse.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
        macro_context = JSON.parse(macroText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
        console.log(`[Enrichment] Macro context gerado: outlook=${macro_context.outlook}`);
      } catch (macroErr) {
        console.error('[Enrichment] Macro context falhou (usando fallback):', macroErr);
      }

      const { error: updateErr } = await supabase
        .from("diagnoses")
        .update({
          seasonality,
          macro_context,
          b2b_targets: clientType === 'b2b' ? { companies: [], status: "preview" } : null,
          b2g_tenders: clientType === 'b2g' ? { tenders: [], status: "preview" } : null,
        })
        .eq("id", latestDiag.id);

      if (updateErr) {
        throw new Error(`Supabase update falhou: ${updateErr.message}`);
      }
      console.log(`[Enrichment] Sazonalidade salva para lead ${leadId} (diagId=${latestDiag.id}, peak=${seasonality.peak_month})`);
    })(),

    // 3. Geração de conteúdos
    (async () => {
      const { triggerContentGeneration } = await import("./generateContents");
      await triggerContentGeneration(leadId);
      console.log(`[Enrichment] Conteúdos gerados para lead ${leadId}`);
    })(),

  ]);

  // Log resultado de cada etapa
  const labels = ["Plano de ação", "Sazonalidade", "Conteúdos"];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`[Enrichment] ${labels[i]}: concluído`);
    } else {
      console.error(`[Enrichment] ${labels[i]}: falhou —`, result.reason);
    }
  });

  console.log(`[Enrichment] Enriquecimento completo para lead ${leadId}`);
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
