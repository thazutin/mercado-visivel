// ============================================================================
// Momento 1 Pipeline Orchestrator
// Coordena todos os steps com execução paralela e fallback chain
// ============================================================================

import type {
  FormInput,
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  Step5Output,
  Momento1Result,
  PipelineProgress,
  StepStatus,
  StepError,
  GoogleInfluence,
  InstagramInfluence,
  WebInfluence,
  SerpPosition,
  MapsPresence,
  TermVolumeData,
  InstagramProfile,
} from '../types/pipeline.types';

import { executeStep1 } from './step1-term-generation';
import { calculateMarketSizing, detectCategory } from '../models/market-sizing';
import {
  calculateGoogleInfluence,
  calculateInstagramInfluence,
  calculateCompositeInfluence,
} from '../models/influence-score';
import { executeStep5 } from './step5-gap-analysis';

// --- PIPELINE CONFIG ---

const PIPELINE_VERSION = 'momento1-v1.0';

const TIMEOUTS = {
  step1_termGeneration: 15_000,      // 15s — Claude term gen
  step2a_googleAdsKP: 10_000,        // 10s — Google Ads API
  step2b_googleTrends: 15_000,       // 15s — Apify Google Trends
  step4a_serpPositions: 15_000,       // 15s — Apify SERP scraper
  step4b_googleMaps: 10_000,         // 10s — Apify Maps scraper
  step4c_instagram: 20_000,          // 20s — Apify Instagram scraper (o mais lento)
  step4d_similarWeb: 10_000,         // 10s — Modus AI / SimilarWeb
  step5_gapAnalysis: 15_000,         // 15s — Claude gap analysis
};

// --- EXTERNAL SERVICE INTERFACES ---
// Cada serviço externo implementa uma interface.
// Isso permite plugar implementações reais (Apify, Google Ads, etc.)
// ou mocks pra teste.

export interface ExternalServices {
  claude: {
    createMessage: (params: any) => Promise<any>;
  };
  googleAds?: {
    getKeywordVolumes: (terms: string[], region: string) => Promise<TermVolumeData[]>;
  };
  apify?: {
    runGoogleTrends: (terms: string[], region: string) => Promise<any>;
    runSerpScraper: (terms: string[], region: string, targetDomain?: string) => Promise<SerpPosition[]>;
    runMapsScraper: (businessName: string, region: string) => Promise<MapsPresence>;
    runInstagramScraper: (handles: string[]) => Promise<InstagramProfile[]>;
  };
  modus?: {
    getSimilarWebData: (domain: string) => Promise<WebInfluence>;
  };
}

export type ProgressCallback = (progress: PipelineProgress) => void;

// --- TIMEOUT WRAPPER ---

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stepName: string,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${stepName} timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

// --- FALLBACK-SAFE EXECUTOR ---
// Executa uma operação com fallback. Se falhar, retorna null em vez de quebrar o pipeline.

async function safeFetch<T>(
  fn: () => Promise<T>,
  stepName: string,
  timeoutMs: number,
  errors: StepError[],
): Promise<T | null> {
  try {
    return await withTimeout(fn(), timeoutMs, stepName);
  } catch (err: any) {
    errors.push({
      step: stepName,
      source: stepName,
      error: err.message || String(err),
      recoverable: true,
      fallbackUsed: `Pipeline continua sem ${stepName}`,
    });
    console.warn(`[Pipeline] ${stepName} failed:`, err.message);
    return null;
  }
}

// --- MAIN ORCHESTRATOR ---

export async function executeMomento1Pipeline(
  input: FormInput,
  services: ExternalServices,
  onProgress?: ProgressCallback,
): Promise<Momento1Result> {
  const pipelineStart = Date.now();
  const errors: StepError[] = [];
  const sourcesUsed: string[] = [];
  const sourcesUnavailable: string[] = [];

  // Helper pra atualizar progresso
  const progress: PipelineProgress = {
    step1: { status: 'pending', message: 'Aguardando...' },
    step2a: { status: 'pending', message: 'Aguardando...' },
    step2b: { status: 'pending', message: 'Aguardando...' },
    step4a: { status: 'pending', message: 'Aguardando...' },
    step4b: { status: 'pending', message: 'Aguardando...' },
    step4c: { status: 'pending', message: 'Aguardando...' },
    step4d: { status: 'pending', message: 'Aguardando...' },
    step3: { status: 'pending', message: 'Aguardando...' },
    step4e: { status: 'pending', message: 'Aguardando...' },
    step5: { status: 'pending', message: 'Aguardando...' },
    overallProgress: 0,
    estimatedSecondsRemaining: 25,
  };

  function updateProgress(
    step: keyof PipelineProgress,
    status: StepStatus,
    message: string,
    overallPct: number
  ) {
    if (step !== 'overallProgress' && step !== 'estimatedSecondsRemaining') {
      (progress[step] as any) = { status, message };
    }
    progress.overallProgress = overallPct;
    progress.estimatedSecondsRemaining = Math.max(0, Math.round((25 * (100 - overallPct)) / 100));
    onProgress?.(structuredClone(progress));
  }

  // =========================================================================
  // STEP 1 — Geração de termos (sequencial — tudo mais depende disso)
  // =========================================================================
  updateProgress('step1', 'running', 'Vero está analisando seu mercado...', 5);

  const step1Result = await withTimeout(
    executeStep1(input, services.claude),
    TIMEOUTS.step1_termGeneration,
    'step1_termGeneration',
  );
  sourcesUsed.push('claude_term_gen');

  updateProgress('step1', 'completed', `${step1Result.termCount} termos identificados`, 15);

  const termStrings = step1Result.terms.map(t => t.term);

  // =========================================================================
  // STEPS 2a, 2b, 4a, 4b, 4c, 4d — Todos em paralelo
  // =========================================================================
  updateProgress('step2a', 'running', 'Consultando volumes de busca...', 20);
  updateProgress('step2b', 'running', 'Analisando sazonalidade...', 20);
  updateProgress('step4a', 'running', 'Verificando posição no Google...', 20);
  updateProgress('step4b', 'running', 'Checando Google Maps...', 20);
  updateProgress('step4c', 'running', 'Analisando Instagram...', 20);
  updateProgress('step4d', 'running', 'Consultando dados de tráfego...', 20);

  // Extrair handles de Instagram
  const businessInstagram = input.digitalAssets.find(a => a.type === 'instagram')?.identifier;
  const competitorInstagrams = input.competitors
    .map(c => c.instagram)
    .filter((h): h is string => !!h);
  const allInstagramHandles = [
    ...(businessInstagram ? [businessInstagram] : []),
    ...competitorInstagrams,
  ];

  // Extrair domínio do site
  const businessSite = input.digitalAssets.find(a => a.type === 'website')?.identifier;
  const businessDomain = businessSite
    ? new URL(businessSite.startsWith('http') ? businessSite : `https://${businessSite}`).hostname
    : undefined;

  // Rodar tudo em paralelo
  const [
    volumeData,
    trendsData,
    serpData,
    mapsData,
    instagramData,
    webData,
  ] = await Promise.all([
    // 2a — Google Ads Keyword Planner (ou fallback)
    services.googleAds
      ? safeFetch(
          () => services.googleAds!.getKeywordVolumes(termStrings, input.region),
          'step2a_googleAdsKP',
          TIMEOUTS.step2a_googleAdsKP,
          errors,
        )
      : (sourcesUnavailable.push('google_ads'), Promise.resolve(null)),

    // 2b — Google Trends via Apify
    services.apify
      ? safeFetch(
          () => services.apify!.runGoogleTrends(termStrings.slice(0, 5), input.region),
          'step2b_googleTrends',
          TIMEOUTS.step2b_googleTrends,
          errors,
        )
      : (sourcesUnavailable.push('google_trends'), Promise.resolve(null)),

    // 4a — SERP positions via Apify
    services.apify
      ? safeFetch(
          () => services.apify!.runSerpScraper(termStrings, input.region, businessDomain),
          'step4a_serpPositions',
          TIMEOUTS.step4a_serpPositions,
          errors,
        )
      : (sourcesUnavailable.push('serp_scraper'), Promise.resolve(null)),

    // 4b — Google Maps via Apify
    services.apify
      ? safeFetch(
          () => services.apify!.runMapsScraper(input.businessName || input.product, input.region),
          'step4b_googleMaps',
          TIMEOUTS.step4b_googleMaps,
          errors,
        )
      : (sourcesUnavailable.push('google_maps'), Promise.resolve(null)),

    // 4c — Instagram via Apify
    allInstagramHandles.length > 0 && services.apify
      ? safeFetch(
          () => services.apify!.runInstagramScraper(allInstagramHandles),
          'step4c_instagram',
          TIMEOUTS.step4c_instagram,
          errors,
        )
      : (sourcesUnavailable.push('instagram'), Promise.resolve(null)),

    // 4d — SimilarWeb via Modus
    businessDomain && services.modus
      ? safeFetch(
          () => services.modus!.getSimilarWebData(businessDomain),
          'step4d_similarWeb',
          TIMEOUTS.step4d_similarWeb,
          errors,
        )
      : (sourcesUnavailable.push('similarweb'), Promise.resolve(null)),
  ]);

  // Update progress
  updateProgress('step2a', volumeData ? 'completed' : 'failed', 
    volumeData ? 'Volumes carregados' : 'Fonte indisponível', 50);
  updateProgress('step2b', trendsData ? 'completed' : 'failed',
    trendsData ? 'Sazonalidade mapeada' : 'Fonte indisponível', 55);
  updateProgress('step4a', serpData ? 'completed' : 'failed',
    serpData ? 'Posições mapeadas' : 'Fonte indisponível', 60);
  updateProgress('step4b', mapsData ? 'completed' : 'failed',
    mapsData ? 'Google Maps verificado' : 'Fonte indisponível', 62);
  updateProgress('step4c', instagramData ? 'completed' : 'failed',
    instagramData ? 'Instagram analisado' : 'Perfil indisponível', 65);
  updateProgress('step4d', webData ? 'completed' : 'failed',
    webData ? 'Tráfego web analisado' : 'Dados insuficientes', 68);

  // Track sources
  if (volumeData) sourcesUsed.push('google_ads');
  if (trendsData) sourcesUsed.push('google_trends');
  if (serpData) sourcesUsed.push('serp_scraper');
  if (mapsData) sourcesUsed.push('google_maps');
  if (instagramData) sourcesUsed.push('instagram');
  if (webData) sourcesUsed.push('similarweb');

  // =========================================================================
  // ASSEMBLE STEP 2 OUTPUT
  // =========================================================================

  // Se Google Ads falhou, usar estimativas (fallback futuro: SEMrush via Modus)
  const termVolumes: TermVolumeData[] = volumeData || step1Result.terms.map(t => ({
    term: t.term,
    monthlyVolume: 0,  // Sem dados reais → zero
    volumeSource: 'apify_estimate' as const,
    volumeConfidence: 'estimate' as const,
    cpcBrl: 0,
    competition: 'medium' as const,
    monthlyTrend: [],
    trendDirection: 'stable' as const,
    trendSource: 'google_ads' as const,
  }));

  // Merge trends data se disponível
  if (trendsData && Array.isArray(trendsData)) {
    for (const trend of trendsData) {
      const match = termVolumes.find(tv => tv.term === trend.term);
      if (match && trend.monthlyTrend) {
        match.monthlyTrend = trend.monthlyTrend;
        match.trendSource = 'combined';
      }
    }
  }

  // Calcular totais
  const totalMonthlyVolume = termVolumes.reduce((sum, tv) => sum + tv.monthlyVolume, 0);
  const weightedMonthlyVolume = termVolumes.reduce((sum, tv) => {
    const termDef = step1Result.terms.find(t => t.term === tv.term);
    const weight = termDef?.intentWeight ?? 0.35;
    return sum + (tv.monthlyVolume * weight);
  }, 0);

  const step2Result: Step2Output = {
    termVolumes,
    totalMonthlyVolume,
    weightedMonthlyVolume,
    dataFreshness: new Date().toISOString().slice(0, 7),
    sources: sourcesUsed.filter(s => ['google_ads', 'google_trends', 'semrush'].includes(s)),
    processingTimeMs: Date.now() - pipelineStart,
  };

  // =========================================================================
  // STEP 3 — Market Sizing (puro cálculo)
  // =========================================================================
  updateProgress('step3', 'running', 'Calculando dimensionamento...', 72);

  const category = detectCategory(input.product, input.differentiator);
  const serpPositions: SerpPosition[] = serpData || [];

  const step3Result = calculateMarketSizing(
    step2Result,
    serpPositions,
    input.ticket,
    category,
  );

  updateProgress('step3', 'completed', 'Mercado dimensionado', 78);

  // =========================================================================
  // STEP 4e — Influence Score Composto (puro cálculo)
  // =========================================================================
  updateProgress('step4e', 'running', 'Calculando influência...', 80);

  // Montar Google influence
  const googleInfluence = calculateGoogleInfluence(
    serpPositions,
    mapsData || null,
    termVolumes,
  );

  // Montar Instagram influence
  const businessIgProfile: InstagramProfile = instagramData?.find(
    (p: InstagramProfile) => p.handle === businessInstagram?.replace('@', '')
  ) || createEmptyInstagramProfile(businessInstagram || '');

  const competitorIgProfiles: InstagramProfile[] = competitorInstagrams.map(handle => {
    const profile = instagramData?.find(
      (p: InstagramProfile) => p.handle === handle.replace('@', '')
    );
    return profile || createEmptyInstagramProfile(handle);
  });

  const instagramInfluence = calculateInstagramInfluence(
    businessIgProfile,
    competitorIgProfiles,
  );

  // Montar Web influence
  const webInfluenceData: WebInfluence = webData || { available: false };
  const competitorWebData: WebInfluence[] = []; // Futuro: buscar pra cada concorrente

  const step4Result = calculateCompositeInfluence(
    googleInfluence,
    instagramInfluence,
    webInfluenceData,
    competitorWebData,
  );

  updateProgress('step4e', 'completed', `Influência: ${step4Result.influence.totalInfluence}%`, 85);

  // =========================================================================
  // STEP 5 — Gap Analysis (Claude)
  // =========================================================================
  updateProgress('step5', 'running', 'Vero está cruzando os dados...', 88);

  const step5Result = await withTimeout(
    executeStep5(input, step1Result, step2Result, step3Result, step4Result, services.claude),
    TIMEOUTS.step5_gapAnalysis,
    'step5_gapAnalysis',
  );

  updateProgress('step5', 'completed', 'Análise completa', 100);

  // =========================================================================
  // ASSEMBLE FINAL RESULT
  // =========================================================================

  const totalProcessingTimeMs = Date.now() - pipelineStart;

  // Determine confidence level
  const criticalSources = ['google_ads', 'serp_scraper'];
  const criticalAvailable = criticalSources.filter(s => sourcesUsed.includes(s)).length;
  const confidenceLevel = criticalAvailable === 2 ? 'high'
    : criticalAvailable === 1 ? 'medium'
    : 'low';

  return {
    leadId: '', // Set by caller
    generatedAt: new Date().toISOString(),
    terms: step1Result,
    volumes: step2Result,
    marketSizing: step3Result,
    influence: step4Result,
    gaps: step5Result,
    totalProcessingTimeMs,
    pipelineVersion: PIPELINE_VERSION,
    sourcesUsed,
    sourcesUnavailable,
    confidenceLevel,
  };
}

// --- HELPERS ---

function createEmptyInstagramProfile(handle: string): InstagramProfile {
  return {
    handle: handle.replace('@', ''),
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
