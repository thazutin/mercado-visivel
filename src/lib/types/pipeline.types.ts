// ============================================================================
// Virô Phase 2 — Pipeline Types
// Contratos de dados entre todos os steps do Momento 1
// ============================================================================

// --- FORM INPUT ---

export interface FormInput {
  // Identidade do negócio
  businessName: string;
  product: string;                    // "O que vende"
  customerDescription?: string;       // "Como seu cliente descreve o que você faz?" (novo campo)
  region: string;                     // "Onde atende" (cidade, bairro, região)
  address?: string;                   // Endereço físico (opcional)
  ticket: number;                     // Ticket médio numérico (ajustado de range → valor)
  clientType?: 'b2c' | 'b2b' | 'b2g'; // Tipo de cliente: pessoas, empresas ou governo

  // Presença digital
  customerSources: string[];          // "De onde vem seu cliente" (Google, Instagram, indicação, etc.)
  digitalAssets: DigitalAsset[];      // Ativos digitais com tipo e identificador
  
  // Competição e posicionamento
  differentiator: string;             // "O que te diferencia" (auto-declaração)
  competitors: CompetitorInput[];     // Até 3 concorrentes com Instagram opcional
  
  // Contexto qualitativo
  challenge: string;                  // "Maior desafio" (alternativa)
  freeText?: string;                  // "Quer contar algo mais?"
  
  // Meta
  locale: 'pt-BR' | 'en' | 'es';
  submittedAt: string;                // ISO timestamp
}

export interface DigitalAsset {
  type: 'website' | 'instagram' | 'google_maps' | 'facebook' | 'tiktok' | 'youtube' | 'other';
  identifier: string;                 // URL, @handle, ou nome
}

export interface CompetitorInput {
  name: string;
  instagram?: string;                 // @handle (novo campo)
  website?: string;                   // URL se conhecida
}

// --- STEP 1: TERM GENERATION ---

export type TermIntent = 'transactional' | 'navigational' | 'consideration' | 'informational';
export type TermCategory = 'core' | 'branded' | 'comparative' | 'tension';

export interface GeneratedTerm {
  term: string;
  intent: TermIntent;
  intentWeight: number;               // transactional=1.0, navigational=0.7, consideration=0.35, informational=0.1
  category: TermCategory;
  rationale: string;                  // Por que esse termo foi gerado (rastreabilidade)
}

export interface Step1Output {
  terms: GeneratedTerm[];
  termCount: number;
  generationModel: string;            // e.g. "claude-sonnet-4-5-20250929"
  promptVersion: string;              // e.g. "term-gen-v1.2"
  processingTimeMs: number;
}

// --- STEP 2: SEARCH VOLUME ---

export interface TermVolumeData {
  term: string;
  
  // Volume (fonte primária: Google Ads KP)
  monthlyVolume: number;              // Volume médio mensal
  volumeSource: 'google_ads' | 'semrush' | 'apify_estimate';
  volumeConfidence: 'exact' | 'range' | 'estimate';
  volumeRange?: { low: number; high: number };  // Se KP retorna range
  
  // CPC
  cpcBrl: number;                     // CPC em reais
  competition: 'low' | 'medium' | 'high';
  
  // Sazonalidade (12 meses)
  monthlyTrend: MonthlyDataPoint[];   // 12 pontos, um por mês
  trendDirection: 'rising' | 'stable' | 'declining';
  trendSource: 'google_ads' | 'google_trends' | 'combined';
  
  // Cross-validation
  crossValidation?: {
    semrushVolume?: number;
    googleAdsVolume?: number;
    agreement: 'high' | 'medium' | 'low';  // ±20% = high, ±50% = medium, >50% = low
  };
}

export interface MonthlyDataPoint {
  month: string;                      // "2025-03", "2025-04", etc.
  volume: number;                     // Volume absoluto (KP) ou índice relativo (Trends)
  isRelative: boolean;                // true = índice 0-100 do Trends, false = volume absoluto
}

export interface Step2Output {
  termVolumes: TermVolumeData[];
  totalMonthlyVolume: number;         // Soma de todos os termos
  weightedMonthlyVolume: number;      // Soma ponderada por intenção
  dataFreshness: string;              // "2026-02" — mês mais recente dos dados
  sources: string[];                  // Fontes usadas nesta execução
  processingTimeMs: number;
}

// --- STEP 3: MARKET SIZING ---

export interface MarketSizing {
  // Volumes
  totalSearchVolume: number;          // Volume bruto mensal (todos os termos)
  weightedSearchVolume: number;       // Volume ponderado por intenção
  
  // Market sizing (range)
  marketPotential: {
    low: number;                      // R$ conservative (CTR pos 3 × conv low × ticket)
    mid: number;                      // R$ moderate (CTR pos 2 × conv mid × ticket)
    high: number;                     // R$ optimistic (CTR pos 1 × conv high × ticket)
    currency: 'BRL' | 'USD' | 'EUR';
  };
  
  // Premissas expostas (transparência = credibilidade)
  assumptions: {
    ctrBenchmark: { position: number; ctr: number }[];
    conversionRate: { low: number; mid: number; high: number };
    conversionSource: string;         // "benchmark [categoria] — fonte"
    ticketUsed: number;
  };
  
  // Disclaimer
  disclaimer: string;                 // "Dimensionamento baseado em intenção digital..."
}

export interface Step3Output {
  sizing: MarketSizing;
  processingTimeMs: number;
}

// --- STEP 4: INFLUENCE SCORE ---

// 4a — Google influence
export interface GoogleInfluence {
  serpPositions: SerpPosition[];       // Posição do negócio por termo
  mapsPresence: MapsPresence | null;  // Dados do Google Maps
  ctrShare: number;                   // % do CTR total capturado pelo negócio
  competitorCtrShares: { name: string; share: number }[];
}

export interface SerpPosition {
  term: string;
  position: number | null;            // null = não encontrado nos top 30
  url?: string;                       // URL que aparece
  serpFeatures: string[];             // 'local_pack', 'featured_snippet', 'ads', etc.
}

export interface MapsPresence {
  found: boolean;
  businessName?: string | null;       // Nome real do negócio no Google Maps
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  inLocalPack: boolean;               // Aparece no local pack?
  localPackPosition?: number;
  photos?: number;
  website?: string;
  phone?: string;
  openNow?: boolean;
}

// 4a+ — Organic presence (DataForSEO SERP)
export interface OrganicPresence {
  available: boolean;
  domain: string;
  rankedTerms: { term: string; position: number; url: string }[];
  totalRanked: number;
  avgPosition: number | null;
  topPosition: number | null;
}

// 4b — Instagram influence
export interface InstagramInfluence {
  profile: InstagramProfile;
  competitors: InstagramProfile[];
  relativeShare: number;              // % de atenção do negócio vs mercado local
}

export interface InstagramProfile {
  handle: string;
  name: string;
  isBusinessProfile: boolean;
  followers: number;
  
  // Métricas de alcance (últimos 30 dias)
  reachAbsolute: number;              // Média de views dos reels
  reachRelative: number;              // views / seguidores
  engagementRate: number;             // likes / views

  // Métricas brutas
  postsLast30d: number;
  avgLikesLast30d: number;
  avgViewsReelsLast30d: number;

  // Recência (últimos 15 dias)
  recentPostsCount: number;           // Posts nos últimos 15 dias
  recentAvgReach: number;             // Alcance médio dos posts recentes (15d)
  recentEngagementRate: number;       // Engajamento médio dos posts recentes (15d)
  
  // Conteúdo (para Step 5)
  bio: string;
  lastPostsCaptions: string[];        // Últimos 12-20 posts
  contentThemes?: string[];           // Processado depois pelo Claude
  
  // Status
  isPrivate: boolean;
  dataAvailable: boolean;             // false se privado ou sem dados
}

// 4c — Web influence (SimilarWeb via Modus)
export interface WebInfluence {
  available: boolean;                 // false se SimilarWeb não tem dados
  monthlyVisits?: number;
  authorityScore?: number;
  backlinks?: number;
  topKeywords?: string[];
  trafficSources?: {
    direct: number;
    search: number;
    social: number;
    referral: number;
  };
  competitorComparison?: {
    name: string;
    monthlyVisits: number;
    authorityScore: number;
  }[];
}

// 4 — Influence Score Composto
export interface InfluenceScore {
  // Score composto
  totalInfluence: number;             // 0-100, % de influência no mercado local
  
  // Breakdown por canal
  google: {
    score: number;                    // 0-100
    weight: number;                   // Peso usado (0.50 ou 0.60 se web indisponível)
    available: boolean;
    organic?: {
      totalRanked: number;
      avgPosition: number | null;
      topPosition: number | null;
      bonus: number;
    };
  };
  instagram: {
    score: number;
    weight: number;                   // 0.30 ou 0.40 se web indisponível
    available: boolean;
  };
  web: {
    score: number;
    weight: number;                   // 0.20 ou 0.00 se indisponível
    available: boolean;
  };
  
  // Comparação com concorrentes
  competitorScores: {
    name: string;
    totalInfluence: number;
    breakdown: { google: number; instagram: number; web: number };
  }[];
  
  // Dados brutos preservados
  rawGoogle: GoogleInfluence;
  rawInstagram: InstagramInfluence;
  rawWeb: WebInfluence;
}

export interface Step4Output {
  influence: InfluenceScore;
  processingTimeMs: number;
  sourcesUsed: string[];
  sourcesUnavailable: string[];       // Fontes que falharam (pra transparência)
}

// --- STEP 5: GAP ANALYSIS ---

export interface GapAnalysis {
  // Gaps detectados (3-5 mais relevantes)
  gaps: Gap[];
  
  // Padrão principal detectado
  primaryPattern: {
    id: 'narrative_gap' | 'demand_gap' | 'asset_gap' | 'frequency_gap' | 'positioning_gap';
    title: string;
    description: string;              // 2-3 frases no tom Vero
  };
  
  // Insight principal (a frase que o dono vai lembrar)
  headlineInsight: string;            // "Você influencia 7% do seu mercado disponível."
  
  // Análise de conteúdo (do scraping)
  contentAnalysis?: {
    businessThemes: string[];         // Temas que o negócio comunica
    competitorThemes: string[];       // Temas que concorrentes comunicam
    marketGapThemes: string[];        // Temas demandados mas não comunicados
    narrativeAlignment: number;       // 0-100: quanto o conteúdo reflete o diferencial declarado
  };
}

export interface Gap {
  type: 'positioning' | 'presence' | 'content' | 'reputation' | 'frequency';
  severity: 'critical' | 'important' | 'opportunity';
  title: string;                      // "Diferencial invisível"
  evidence: string;                   // "Você declara X. Seu conteúdo mostra Y."
  dataPoints: string[];               // Dados específicos que sustentam o gap
  // NÃO inclui recomendação — isso é do diagnóstico pago
}

export interface Step5Output {
  analysis: GapAnalysis;
  promptVersion: string;
  processingTimeMs: number;
}

// --- PIPELINE RESULT (Momento 1 completo) ---

export interface Momento1Result {
  // Identificação
  leadId: string;
  generatedAt: string;                // ISO timestamp
  
  // Dados de cada step
  terms: Step1Output;
  volumes: Step2Output;
  marketSizing: Step3Output;
  influence: Step4Output;
  gaps: Step5Output;
  
  // Meta do pipeline
  totalProcessingTimeMs: number;
  pipelineVersion: string;            // "momento1-v1.0"
  sourcesUsed: string[];
  sourcesUnavailable: string[];
  confidenceLevel: 'high' | 'medium' | 'low';  // Baseado em quantas fontes funcionaram
  
  // Cache
  cachedAt?: string;
  cacheKey?: string;
}

// --- PIPELINE EXECUTION ---

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineProgress {
  step1: { status: StepStatus; message: string };
  step2a: { status: StepStatus; message: string };
  step2b: { status: StepStatus; message: string };
  step4a: { status: StepStatus; message: string };
  step4b: { status: StepStatus; message: string };
  step4c: { status: StepStatus; message: string };
  step4d: { status: StepStatus; message: string };
  step3: { status: StepStatus; message: string };
  step4e: { status: StepStatus; message: string };
  step5: { status: StepStatus; message: string };
  overallProgress: number;            // 0-100
  estimatedSecondsRemaining: number;
}

// --- CACHE ---

export interface CacheEntry {
  key: string;                        // e.g. "term-volume:botox+são+paulo"
  value: any;
  source: string;
  fetchedAt: string;
  expiresAt: string;                  // TTL varies by data type
  hitCount: number;
}

// --- IBGE DATA ---

export interface IBGEData {
  municipio: string;
  estado: string;
  populacao: number;
  codigoIBGE: string;
}

// --- AUDIÊNCIA ESTIMADA ---

export interface AudienciaEstimada {
  populacaoRaio: number;
  raioKm: number | null;
  densidade: 'alta' | 'baixa' | 'nacional';
  municipioNome: string;
  municipioId: number;
  ibgeAno?: number;
}

export interface AudienciaTarget {
  targetProfile: string;
  estimatedPercentage: number;
  audienciaTarget: number;
  rationale: string;
}

export interface AudienciaDisplay {
  populacaoRaio: number;
  raioKm: number | null;
  densidade: 'alta' | 'baixa' | 'nacional';
  municipioNome: string;
  targetProfile: string;
  estimatedPercentage: number;
  audienciaTarget: number;
  rationale: string;
  ibgeAno?: number;
}

// --- COMPETITION INDEX ---

export interface CompetitionIndex {
  totalCompetitors: number;
  activeCompetitors: number;
  totalSearchVolume: number;
  indexValue: number;
  label: 'subatendido' | 'equilibrado' | 'saturado';
  labelText: string;
  color: 'green' | 'yellow' | 'red';
  competitors: {
    name: string;
    hasWebsite: boolean;
    hasInstagram: boolean;
    mapsPosition?: number;
    rating?: number;
    reviewCount?: number;
  }[];
}

// --- ERROR HANDLING ---

export interface StepError {
  step: string;
  source: string;
  error: string;
  recoverable: boolean;
  fallbackUsed?: string;              // "Recalculado sem componente web"
}
