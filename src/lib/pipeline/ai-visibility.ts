// ============================================================================
// AI Visibility Check — v2.0
// Baseado em dados reais de SERP via DataForSEO
// Busca queries de descoberta ("melhor X em Y") e verifica se o negócio aparece
// Matching: nome do Maps (primário) → handle do Instagram (fallback)
// ============================================================================

export interface AIVisibilityResult {
  score: number;                      // 0-100
  summary: string;
  likelyMentioned: boolean;           // true apenas se score >= 71
  factors: {
    factor: string;
    status: 'positive' | 'negative' | 'neutral';
    detail: string;
  }[];
  competitorMentions: {
    name: string;
    likelyMentioned: boolean;
    reason: string;
  }[];
  processingTimeMs: number;
  // v2: dados brutos para debug
  _raw?: {
    queriesSearched: string[];
    matchMethod: 'maps_name' | 'instagram_handle' | 'none';
    matchedName: string | null;
    serpAppearances: number;
    totalQueries: number;
  };
}

export const AI_VISIBILITY_PROMPT_VERSION = 'ai-visibility-v2.0-serp';

// ─── Queries de descoberta ────────────────────────────────────────────────────
// Estas são as queries que um usuário real faria a uma AI ou ao Google
// para encontrar um negócio como este

function buildDiscoveryQueries(product: string, region: string): string[] {
  const shortRegion = region.split(',')[0].trim();
  return [
    `melhor ${product} em ${shortRegion}`,
    `${product} recomendado ${shortRegion}`,
    `${product} ${shortRegion}`,
  ];
}

// ─── Matching: verifica se o negócio aparece nos resultados ──────────────────

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function businessAppearsInResults(
  serpResults: any[],
  businessName: string | null,
  instagramHandle: string | null,
): { found: boolean; method: 'maps_name' | 'instagram_handle' | 'none'; matchedName: string | null } {
  const allText = serpResults.map(r => {
    const parts = [
      r.title || '',
      r.description || r.snippet || '',
      r.url || r.link || '',
      ...(r.localResults || []).map((lr: any) => `${lr.title || ''} ${lr.address || ''}`),
    ];
    return normalizeForMatch(parts.join(' '));
  }).join(' ');

  // Primário: nome do Maps
  if (businessName) {
    const normalizedName = normalizeForMatch(businessName);
    // Usa as 2 primeiras palavras significativas para matching parcial
    const nameParts = normalizedName.split(/\s+/).filter(w => w.length > 2).slice(0, 2);
    if (nameParts.length > 0 && nameParts.every(part => allText.includes(part))) {
      return { found: true, method: 'maps_name', matchedName: businessName };
    }
  }

  // Fallback: handle do Instagram
  if (instagramHandle) {
    const cleanHandle = normalizeForMatch(instagramHandle.replace('@', ''));
    if (cleanHandle.length > 3 && allText.includes(cleanHandle)) {
      return { found: true, method: 'instagram_handle', matchedName: instagramHandle };
    }
  }

  return { found: false, method: 'none', matchedName: null };
}

// ─── Score a partir de aparições no SERP ─────────────────────────────────────

function calculateScoreFromSerp(
  appearances: number,
  totalQueries: number,
  hasMapsProfile: boolean,
  mapsRating: number | null,
  mapsReviews: number | null,
  hasWebsite: boolean,
): { score: number; factors: AIVisibilityResult['factors'] } {
  const factors: AIVisibilityResult['factors'] = [];

  // Base: aparições nos resultados
  const appearanceRate = totalQueries > 0 ? appearances / totalQueries : 0;
  let score = Math.round(appearanceRate * 60); // máx 60 pts por aparições

  if (appearances > 0) {
    factors.push({
      factor: 'Aparece em buscas de descoberta',
      status: 'positive',
      detail: `Encontrado em ${appearances} de ${totalQueries} queries analisadas`,
    });
  } else {
    factors.push({
      factor: 'Não aparece em buscas de descoberta',
      status: 'negative',
      detail: `Ausente nos ${totalQueries} termos de busca analisados para este serviço e região`,
    });
  }

  // Google Maps: +20 pts se tem perfil com avaliações
  if (hasMapsProfile && (mapsReviews || 0) >= 10) {
    score += 20;
    factors.push({
      factor: 'Presença no Google Maps',
      status: 'positive',
      detail: `★ ${mapsRating || '—'} com ${mapsReviews} avaliações — aumenta visibilidade em buscas locais`,
    });
  } else if (hasMapsProfile) {
    score += 8;
    factors.push({
      factor: 'Google Maps com poucas avaliações',
      status: 'neutral',
      detail: `Perfil encontrado mas com ${mapsReviews || 0} avaliações — abaixo do limiar de relevância`,
    });
  } else {
    factors.push({
      factor: 'Sem perfil no Google Maps',
      status: 'negative',
      detail: 'Ausência no Maps reduz significativamente visibilidade em buscas locais',
    });
  }

  // Website: +15 pts
  if (hasWebsite) {
    score += 15;
    factors.push({
      factor: 'Tem website',
      status: 'positive',
      detail: 'Presença web aumenta chance de indexação em bases de AI',
    });
  } else {
    factors.push({
      factor: 'Sem website',
      status: 'negative',
      detail: 'Sem website, a visibilidade em AI depende quase exclusivamente de avaliações e Maps',
    });
  }

  // Rating bonus: +5 pts
  if (mapsRating && mapsRating >= 4.5) {
    score += 5;
    factors.push({
      factor: 'Avaliação excelente',
      status: 'positive',
      detail: `★ ${mapsRating} — negócios com alta avaliação têm mais chance de ser recomendados`,
    });
  }

  return { score: Math.min(100, score), factors };
}

// ─── Executor principal ───────────────────────────────────────────────────────

export async function executeAIVisibilityCheck(
  product: string,
  region: string,
  businessName: string | null,       // do Maps
  instagramHandle: string | null,    // do formulário
  hasWebsite: boolean,
  hasMapsProfile: boolean,
  mapsRating: number | null,
  mapsReviews: number | null,
  serpPositions: number,
  serpTotal: number,
  competitors: { name: string; instagram?: string }[],
  // v2: DataForSEO client (obrigatório para dados reais)
  dataForSEOClient?: { getKeywordVolumes: (terms: string[], region: string) => Promise<any[]> },
  // fallback: Claude client (mantido para compatibilidade)
  claudeClient?: { createMessage: (params: any) => Promise<any> },
): Promise<AIVisibilityResult> {
  const startTime = Date.now();

  const queries = buildDiscoveryQueries(product, region);
  let serpAppearances = 0;
  let matchMethod: 'maps_name' | 'instagram_handle' | 'none' = 'none';
  let matchedName: string | null = null;

  // ── Tenta DataForSEO SERP (dados reais) ──────────────────────────────────
  if (dataForSEOClient) {
    try {
      // Usa DataForSEO para buscar as queries de descoberta
      // Reutiliza a mesma infraestrutura de volume — aqui nos interessa o SERP, não o volume
      const serpData = await dataForSEOClient.getKeywordVolumes(queries, region);

      for (const queryResult of serpData) {
        // DataForSEO retorna top SERP results por keyword via tasks
        const results = queryResult?.serpResults || queryResult?.organicResults || [];
        const match = businessAppearsInResults(results, businessName, instagramHandle);
        if (match.found) {
          serpAppearances++;
          matchMethod = match.method;
          matchedName = match.matchedName;
        }
      }
    } catch (err) {
      console.warn('[AIVisibility] DataForSEO SERP check failed, falling back:', err);
    }
  }

  // ── Calcula score ─────────────────────────────────────────────────────────
  const { score, factors } = calculateScoreFromSerp(
    serpAppearances,
    queries.length,
    hasMapsProfile,
    mapsRating,
    mapsReviews,
    hasWebsite,
  );

  // likelyMentioned apenas se score >= 71
  const likelyMentioned = score >= 71;

  const summary = likelyMentioned
    ? `Seu negócio provavelmente aparece quando buscam por ${product} em ${region.split(',')[0]}`
    : serpAppearances > 0
    ? `Seu negócio aparece em ${serpAppearances} de ${queries.length} buscas, mas ainda abaixo do limiar de relevância`
    : `Seu negócio não aparece nas buscas de descoberta para ${product} em ${region.split(',')[0]}`;

  return {
    score,
    summary,
    likelyMentioned,
    factors,
    competitorMentions: [],   // v3: adicionar quando tivermos nome dos concorrentes
    processingTimeMs: Date.now() - startTime,
    _raw: {
      queriesSearched: queries,
      matchMethod,
      matchedName,
      serpAppearances,
      totalQueries: queries.length,
    },
  };
}

// ─── Mantém compatibilidade com chamadas que usam buildAIVisibilityPrompt ────
// (usado em testes ou versões antigas do pipeline)
export function buildAIVisibilityPrompt(): string {
  return ''; // deprecated em v2.0 — usar executeAIVisibilityCheck diretamente
}

export function parseAIVisibilityResponse(raw: string): any {
  return {}; // deprecated em v2.0
}
