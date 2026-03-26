// ============================================================================
// Step 4e — Influence Score — Modelo de 3 Dimensões
// D1 Alcance · D2 Descoberta (Google + AI) · D3 Credibilidade
// ============================================================================

import type {
  GoogleInfluence,
  InstagramInfluence,
  InstagramProfile,
  WebInfluence,
  InfluenceScore,
  Step4Output,
  SerpPosition,
  MapsPresence,
  OrganicPresence,
  TermVolumeData,
} from '../types/pipeline.types';
import { CTR_BENCHMARKS } from './market-sizing';

// ─── D1: Alcance (reach real, não followers) ──────────────────────────────────
// Mede alcance efetivo: views/reach recente > followers bruto.
// Recência aplicada agressivamente: sem posts recentes = penalização forte.
function scoreD1_reach(
  igProfile: InstagramProfile | null,
  linkedinPresent: boolean,
  clientType: string,
): number {
  const scores: number[] = [];

  if (igProfile?.dataAvailable) {
    const followers = igProfile.followers || 0;
    const avgReach = igProfile.reachAbsolute || igProfile.avgViewsReelsLast30d || igProfile.avgLikesLast30d || 0;
    const recentReach = igProfile.recentAvgReach ?? 0;
    const hasRecentPosts = (igProfile.recentPostsCount ?? 0) > 0;

    // Alcance real (views/reach), não followers
    // Benchmark: alcance de 10% dos followers é bom para negócio local
    let reachScore = 0;
    if (avgReach > 0 && followers > 0) {
      const reachRate = avgReach / followers;
      if (reachRate >= 0.15) reachScore = 80;
      else if (reachRate >= 0.08) reachScore = 55;
      else if (reachRate >= 0.03) reachScore = 35;
      else reachScore = 15;
    } else if (followers >= 1000) {
      reachScore = 25; // tem seguidores mas sem dados de reach
    } else if (followers > 0) {
      reachScore = 10;
    }

    // Recência: sem posts nos últimos 15 dias = corte de 60%
    if (!hasRecentPosts) {
      reachScore = Math.round(reachScore * 0.4);
    } else if (recentReach > 0 && followers > 0) {
      // Boost se reach recente é bom
      const recentRate = recentReach / followers;
      if (recentRate >= 0.10) reachScore = Math.min(100, reachScore + 15);
    }

    scores.push(Math.max(0, Math.min(100, reachScore)));
  }

  // LinkedIn (B2B/B2G)
  if (clientType === 'b2b' || clientType === 'b2g') {
    scores.push(linkedinPresent ? 40 : 0);
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── D2: Descoberta (Google SERP + Maps + AI) ────────────────────────────────
// Mede: conseguem te encontrar quando buscam?
// Inclui busca orgânica, Maps e visibilidade em AI.
function scoreD2_discovery(
  serpPositions: SerpPosition[],
  mapsPresence: MapsPresence | null,
  aiVisibility: { score: number; likelyMentioned: boolean } | null,
  mapsCompetitors?: Array<{ rating?: number; reviewCount?: number }>,
): number {
  // SERP: posição ponderada
  let serpTotal = 0;
  for (const sp of serpPositions) {
    if (sp.position && sp.position <= 3) serpTotal += 100;
    else if (sp.position && sp.position <= 10) serpTotal += 50;
    else if (sp.position && sp.position <= 20) serpTotal += 15;
    // posição > 20 ou sem posição = 0
  }
  const serpScore = serpPositions.length > 0 ? serpTotal / serpPositions.length : 0;

  // Maps: presença + posição no local pack
  let mapsScore = 0;
  if (mapsPresence?.found) {
    mapsScore = 40;
    if (mapsPresence.inLocalPack) mapsScore = 70;
    if (mapsPresence.localPackPosition && mapsPresence.localPackPosition <= 3) mapsScore = 85;
  }

  // Relativização: se concorrentes têm mais avaliações, penaliza Maps score
  if (mapsPresence?.found && mapsCompetitors && mapsCompetitors.length > 0) {
    const myReviews = mapsPresence.reviewCount || 0;
    const competitorAvgReviews = mapsCompetitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / mapsCompetitors.length;

    // Penaliza se concorrentes têm significativamente mais avaliações
    if (competitorAvgReviews > 0) {
      const reviewRatio = myReviews / (myReviews + competitorAvgReviews);
      // reviewRatio = 0.5 se igual, < 0.5 se atrás, > 0.5 se na frente
      // Aplica como multiplicador: 0.5 ratio = 85% do score, 0.2 ratio = 60% do score
      const relativePenalty = 0.5 + (reviewRatio * 0.5); // range 0.5-1.0
      mapsScore = Math.round(mapsScore * relativePenalty);
    }
  }

  // AI: visibilidade em ferramentas de IA
  let aiScore = 0;
  if (aiVisibility) {
    aiScore = aiVisibility.likelyMentioned ? Math.min(aiVisibility.score, 100) : 0;
  }

  // Ponderação: SERP 50% + Maps 30% + AI 20%
  return serpScore * 0.50 + mapsScore * 0.30 + aiScore * 0.20;
}

// ─── D3: Credibilidade (avaliações + engajamento + website) ──────────────────
// Mede: quando te encontram, confiam em você?
// Reviews + engagement rate (IG/LinkedIn) + presença de website.
function scoreD3_credibility(
  mapsPresence: MapsPresence | null,
  hasWebsite: boolean,
  igProfile: InstagramProfile | null,
  linkedinPresent: boolean,
  clientType: string,
  mapsCompetitors?: Array<{ rating?: number; reviewCount?: number; photoCount?: number }>,
): number {
  // Reviews relativizados contra concorrentes
  let reviewScore = 0;
  const myReviews = mapsPresence?.reviewCount || 0;
  const myRating = mapsPresence?.rating || 0;
  const myPhotos = mapsPresence?.photoCount || 0;
  const myResponseRate = mapsPresence?.ownerResponseRate || 0;

  if (mapsCompetitors && mapsCompetitors.length > 0) {
    // Score relativo: onde estou em relação ao melhor concorrente?
    const maxCompetitorReviews = Math.max(...mapsCompetitors.map(c => c.reviewCount || 0), 1);
    const maxCompetitorPhotos = Math.max(...mapsCompetitors.map(c => c.photoCount || 0), 1);
    const avgCompetitorRating = mapsCompetitors.reduce((s, c) => s + (c.rating || 0), 0) / mapsCompetitors.length;

    // Ratio de avaliações vs melhor concorrente (0-1)
    const reviewRatio = myReviews / (myReviews + maxCompetitorReviews);
    // Ratio de fotos vs melhor concorrente (0-1)
    const photoRatio = myPhotos / (myPhotos + maxCompetitorPhotos);
    // Rating relativo (-1 a +1 convertido para 0-1)
    const ratingRelative = avgCompetitorRating > 0
      ? Math.min(myRating / avgCompetitorRating, 1.5) / 1.5
      : 0.5;

    // Combina: reviews 50% + rating 30% + fotos 20%
    const relativeScore = reviewRatio * 0.50 + ratingRelative * 0.30 + photoRatio * 0.20;
    reviewScore = Math.round(relativeScore * 100);

    // Bonus por responder avaliações (diferenciador)
    if (myResponseRate > 0.8) reviewScore = Math.min(100, reviewScore + 10);
    else if (myResponseRate > 0.5) reviewScore = Math.min(100, reviewScore + 5);
  } else {
    // Sem concorrentes: usa thresholds absolutos (código original)
    if (myReviews >= 50 && myRating >= 4.5) reviewScore = 100;
    else if (myReviews >= 50) reviewScore = 80;
    else if (myReviews >= 20 && myRating >= 4.0) reviewScore = 60;
    else if (myReviews >= 20) reviewScore = 45;
    else if (myReviews >= 5) reviewScore = 25;
    else if (myReviews > 0) reviewScore = 10;
  }

  // Engajamento social (IG ou LinkedIn)
  let engagementScore = 0;
  if (igProfile?.dataAvailable) {
    const engRate = igProfile.engagementRate || 0;
    // Benchmark: 3% é bom para negócio local
    if (engRate >= 0.05) engagementScore = 80;
    else if (engRate >= 0.03) engagementScore = 55;
    else if (engRate >= 0.01) engagementScore = 30;
    else if (engRate > 0) engagementScore = 10;

    // Recência penaliza engajamento também
    const hasRecentPosts = (igProfile.recentPostsCount ?? 0) > 0;
    if (!hasRecentPosts) engagementScore = Math.round(engagementScore * 0.5);
  }
  if ((clientType === 'b2b' || clientType === 'b2g') && linkedinPresent) {
    engagementScore = Math.max(engagementScore, 35); // LinkedIn ativo = baseline
  }

  // Website
  const websiteScore = hasWebsite ? 40 : 0;

  // Ponderação: reviews 40% + engajamento 35% + website 25%
  return reviewScore * 0.40 + engagementScore * 0.35 + websiteScore * 0.25;
}

// ─── Pesos por clientType (3 dimensões) ──────────────────────────────────────
const WEIGHTS: Record<string, { d1: number; d2: number; d3: number }> = {
  b2c: { d1: 0.30, d2: 0.40, d3: 0.30 },  // descoberta mais importante
  b2b: { d1: 0.20, d2: 0.35, d3: 0.45 },  // credibilidade crucial
  b2g: { d1: 0.15, d2: 0.45, d3: 0.40 },  // descoberta + credibilidade
};

// ─── Interface de breakdown ──────────────────────────────────────────────────
export interface InfluenceBreakdown {
  total: number;
  d1_discovery: number;   // agora = Alcance (reach)
  d2_credibility: number; // agora = Descoberta (Google + AI)
  d3_reach: number;       // agora = Credibilidade (reviews + engajamento)
  d4_ai_visibility: number; // mantido para compat, sempre = d2 (merged)
}

// ─── Google Influence Calculator (preservado para compatibilidade) ────────────

export function calculateGoogleInfluence(
  serpPositions: SerpPosition[],
  mapsPresence: MapsPresence | null,
  termVolumes: TermVolumeData[],
): GoogleInfluence {
  let totalWeightedTraffic = 0;
  let businessTraffic = 0;
  const hasRealVolumes = termVolumes.some(tv => tv.monthlyVolume > 0);

  for (const sp of serpPositions) {
    const volumeData = termVolumes.find(tv => tv.term.toLowerCase() === sp.term.toLowerCase());
    const volume = hasRealVolumes ? (volumeData?.monthlyVolume || 0) : 1;
    if (volume === 0) continue;

    const hasLocalPack = sp.serpFeatures?.includes('local_pack');
    const ctrTable = hasLocalPack ? CTR_BENCHMARKS.withLocalPack : CTR_BENCHMARKS.organic;
    totalWeightedTraffic += volume * (ctrTable[1] || 0.30);

    if (sp.position && sp.position <= 10) {
      businessTraffic += volume * (ctrTable[sp.position] || CTR_BENCHMARKS.notFound || 0.005);
    } else {
      businessTraffic += volume * (CTR_BENCHMARKS.notFound || 0.005);
    }
  }

  if (mapsPresence?.found && mapsPresence.inLocalPack && mapsPresence.localPackPosition) {
    const localPackCtr = CTR_BENCHMARKS.localPack;
    const mapsBonus = localPackCtr ? (localPackCtr[mapsPresence.localPackPosition] || 0) : 0.05;
    const avgVolume = hasRealVolumes
      ? termVolumes.reduce((s, t) => s + t.monthlyVolume, 0) / Math.max(termVolumes.length, 1) : 1;
    businessTraffic += avgVolume * mapsBonus * 0.5;
  }

  const ctrShare = totalWeightedTraffic > 0 ? businessTraffic / totalWeightedTraffic : 0;

  return {
    serpPositions,
    mapsPresence,
    ctrShare: Math.min(ctrShare, 1.0),
    competitorCtrShares: [],
  };
}

// ─── Instagram Influence Calculator (preservado) ─────────────────────────────

export function calculateInstagramInfluence(
  businessProfile: InstagramProfile,
  competitorProfiles: InstagramProfile[],
): InstagramInfluence {
  if (!businessProfile.dataAvailable) {
    return { profile: businessProfile, competitors: competitorProfiles, relativeShare: 0 };
  }

  const allAvailable = [businessProfile, ...competitorProfiles].filter(p => p.dataAvailable);

  if (allAvailable.length <= 1) {
    const followerScore = Math.min(businessProfile.followers / 5000, 1.0);
    const engScore = Math.min(businessProfile.engagementRate / 0.03, 1.0);
    const freqScore = Math.min(businessProfile.postsLast30d / 8, 1.0);
    const absoluteScore = followerScore * 0.4 + engScore * 0.35 + freqScore * 0.25;
    const recencyAdjusted = applyRecencyFactor(absoluteScore, businessProfile);
    return { profile: businessProfile, competitors: competitorProfiles, relativeShare: Math.min(recencyAdjusted, 1.0) };
  }

  const scores = allAvailable.map(profile => ({
    handle: profile.handle,
    score: calculateSingleInstagramScore(profile, allAvailable),
  }));
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const businessScore = scores.find(s => s.handle === businessProfile.handle)?.score || 0;
  const relativeShare = totalScore > 0 ? businessScore / totalScore : 0;
  const recencyAdjusted = applyRecencyFactor(relativeShare, businessProfile);

  return { profile: businessProfile, competitors: competitorProfiles, relativeShare: recencyAdjusted };
}

function applyRecencyFactor(historicalScore: number, profile: InstagramProfile): number {
  const hasRecentPosts = (profile.recentPostsCount ?? 0) > 0;
  if (!hasRecentPosts) return historicalScore * 0.5;
  const recentReach = profile.recentAvgReach ?? 0;
  const recentEng = profile.recentEngagementRate ?? 0;
  const recentReachScore = profile.followers > 0 ? Math.min(recentReach / profile.followers, 1.0) : 0;
  const recentEngScore = Math.min(recentEng / 0.03, 1.0);
  const recentScore = recentReachScore * 0.6 + recentEngScore * 0.4;
  return recentScore * 0.6 + historicalScore * 0.4;
}

function calculateSingleInstagramScore(profile: InstagramProfile, allProfiles: InstagramProfile[]): number {
  if (!profile.dataAvailable) return 0;
  const maxReachAbsolute = Math.max(...allProfiles.map(p => p.reachAbsolute), 1);
  const reachAbsoluteNormalized = profile.reachAbsolute / maxReachAbsolute;
  const reachRelative = profile.followers > 0 ? Math.min(profile.reachAbsolute / profile.followers, 1.0) : 0;
  const engagementRate = profile.reachAbsolute > 0 ? Math.min(profile.avgLikesLast30d / profile.reachAbsolute, 0.3) : 0;
  const maxEngagement = Math.max(...allProfiles.map(p =>
    p.reachAbsolute > 0 ? Math.min(p.avgLikesLast30d / p.reachAbsolute, 0.3) : 0
  ), 0.01);
  return reachAbsoluteNormalized * 0.55 + reachRelative * 0.25 + (engagementRate / maxEngagement) * 0.20;
}

export function calculateWebInfluence(
  webData: WebInfluence,
  competitorWebData: WebInfluence[],
): { score: number; available: boolean } {
  if (!webData.available || !webData.monthlyVisits) return { score: 0, available: false };
  const allVisits = [webData.monthlyVisits, ...competitorWebData.filter(c => c.available && c.monthlyVisits).map(c => c.monthlyVisits!)];
  const maxVisits = Math.max(...allVisits, 1);
  const score = (webData.monthlyVisits / maxVisits) * 0.60 + ((webData.authorityScore || 0) / 100) * 0.40;
  return { score: Math.min(score, 1.0), available: true };
}

// ─── Composite Influence (3D model) ──────────────────────────────────────────

export function calculateCompositeInfluence(
  google: GoogleInfluence,
  instagram: InstagramInfluence,
  webData: WebInfluence,
  organicPresence?: OrganicPresence | null,
  clientType?: 'b2c' | 'b2b' | 'b2g',
  linkedinPresent?: boolean,
  aiVisibility?: { score: number; likelyMentioned: boolean } | null,
): Step4Output {
  const startTime = Date.now();
  const ct = clientType || 'b2c';
  const weights = WEIGHTS[ct] || WEIGHTS.b2c;

  // Has website?
  const hasWebsite = !!(
    (organicPresence?.available && organicPresence.totalRanked > 0) ||
    google.mapsPresence?.website ||
    (webData.available && webData.monthlyVisits)
  );

  const igProfile = instagram.profile.dataAvailable ? instagram.profile : null;
  const mapsCompetitors = google.mapsPresence?.mapsCompetitors || [];

  // 3 dimensões
  const d1 = scoreD1_reach(igProfile, linkedinPresent || false, ct);
  const d2 = scoreD2_discovery(google.serpPositions, google.mapsPresence, aiVisibility || null, mapsCompetitors);
  const d3 = scoreD3_credibility(google.mapsPresence, hasWebsite, igProfile, linkedinPresent || false, ct, mapsCompetitors);

  const rawInfluence = Math.round(
    d1 * weights.d1 + d2 * weights.d2 + d3 * weights.d3
  );

  // Cap realista: negócio local raramente captura mais de 35% da demanda ativa
  // Usa raiz quadrada para comprimir scores altos sem achatar os baixos
  const totalInfluence = Math.round(Math.sqrt(rawInfluence / 100) * 40);

  // Breakdown: mantém nomes de campo para compat, mas semantica mudou:
  // d1_discovery → Alcance, d2_credibility → Descoberta, d3_reach → Credibilidade
  // d4_ai_visibility mantido como alias de d2 (AI está dentro de Descoberta)
  const breakdown: InfluenceBreakdown = {
    total: totalInfluence,
    d1_discovery: Math.round(d1),    // Alcance (reach real)
    d2_credibility: Math.round(d2),  // Descoberta (Google + AI)
    d3_reach: Math.round(d3),        // Credibilidade (reviews + engajamento)
    d4_ai_visibility: Math.round(d2), // alias de d2 (AI merged)
  };

  console.log(`[Influence 3D] Raw=${rawInfluence}% → Realistic=${totalInfluence}% | Concorrentes Maps: ${mapsCompetitors.length} | Alcance=${Math.round(d1)} Descoberta=${Math.round(d2)} Credibilidade=${Math.round(d3)}`);

  // Backward-compat: old-style scores
  const googleScore = google.ctrShare;
  const instagramScore = instagram.relativeShare;
  const instagramAvailable = instagram.profile.dataAvailable;

  const sourcesUsed: string[] = ['google_serp'];
  const sourcesUnavailable: string[] = [];
  if (google.mapsPresence?.found) sourcesUsed.push('google_maps');
  if (instagramAvailable) sourcesUsed.push('instagram');
  else sourcesUnavailable.push('instagram');

  const influence: InfluenceScore = {
    totalInfluence,
    google: {
      score: Math.round(googleScore * 100),
      weight: weights.d2,
      available: true,
      organic: organicPresence?.available ? {
        totalRanked: organicPresence.totalRanked,
        avgPosition: organicPresence.avgPosition,
        topPosition: organicPresence.topPosition,
        bonus: 0,
      } : undefined,
    },
    instagram: {
      score: Math.round(instagramScore * 100),
      weight: weights.d1,
      available: instagramAvailable,
    },
    web: {
      score: 0,
      weight: 0,
      available: false,
    },
    competitorScores: [],
    rawGoogle: google,
    rawInstagram: instagram,
    rawWeb: webData,
    // @ts-ignore — extending with breakdown
    breakdown,
  };

  const levers = generateInfluenceLevers(
    igProfile,
    google.mapsPresence,
    google.serpPositions,
    hasWebsite,
    aiVisibility || null,
    ct,
    mapsCompetitors,
  );
  (breakdown as any).levers = levers;
  console.log(`[Influence 3D] Levers gerados: ${levers.length} alavancas`);

  return {
    influence,
    processingTimeMs: Date.now() - startTime,
    sourcesUsed,
    sourcesUnavailable,
  };
}

// ─── Influence Levers — Ações acionáveis por dimensão ────────────────────────

export interface InfluenceLever {
  dimension: 'alcance' | 'descoberta' | 'credibilidade';
  action: string;
  impact: number;
  effort: 'baixo' | 'médio' | 'alto';
  horizon: '1-2 semanas' | '1-2 meses' | '3-6 meses';
  currentValue?: string;
  targetValue?: string;
}

export function generateInfluenceLevers(
  igProfile: InstagramProfile | null,
  mapsPresence: MapsPresence | null,
  serpPositions: SerpPosition[],
  hasWebsite: boolean,
  aiVisibility: { score: number; likelyMentioned: boolean } | null,
  clientType: 'b2c' | 'b2b' | 'b2g',
  mapsCompetitors: Array<{ rating?: number; reviewCount?: number; photoCount?: number }>,
): InfluenceLever[] {
  const levers: InfluenceLever[] = [];
  const weights = WEIGHTS[clientType] || WEIGHTS.b2c;

  // ── ALCANCE (D1) ──────────────────────────────────────────────────────────

  if (!igProfile?.dataAvailable || igProfile.followers === 0) {
    levers.push({
      dimension: 'alcance',
      action: 'Criar e configurar perfil profissional no Instagram',
      impact: Math.round(weights.d1 * 15),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Sem perfil detectado',
      targetValue: 'Perfil ativo com bio, link e categoria',
    });
  } else if ((igProfile.recentPostsCount ?? 0) === 0) {
    levers.push({
      dimension: 'alcance',
      action: 'Retomar postagens — mínimo 2x por semana por 30 dias',
      impact: Math.round(weights.d1 * 12),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: '0 posts nos últimos 15 dias (perfil inativo)',
      targetValue: '8+ posts/mês com alcance recente',
    });
  } else {
    const reachRate = igProfile.reachAbsolute > 0 && igProfile.followers > 0
      ? igProfile.reachAbsolute / igProfile.followers : 0;
    if (reachRate < 0.08) {
      levers.push({
        dimension: 'alcance',
        action: 'Aumentar frequência de Reels — formato com maior alcance orgânico',
        impact: Math.round(weights.d1 * 8),
        effort: 'médio',
        horizon: '1-2 meses',
        currentValue: `Alcance médio: ${(reachRate * 100).toFixed(0)}% dos seguidores`,
        targetValue: 'Alcance acima de 8% dos seguidores',
      });
    }
  }

  // ── DESCOBERTA (D2) ───────────────────────────────────────────────────────

  const rankedTerms = serpPositions.filter(sp => sp.position && sp.position <= 10).length;

  if (!mapsPresence?.found) {
    levers.push({
      dimension: 'descoberta',
      action: 'Criar e verificar perfil no Google Meu Negócio',
      impact: Math.round(weights.d2 * 18),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Negócio não encontrado no Google Maps',
      targetValue: 'Perfil verificado com fotos, horário e categoria',
    });
  } else if (!mapsPresence.inLocalPack) {
    const myReviewsD2 = mapsPresence.reviewCount || 0;
    const avgCompetitorReviews = mapsCompetitors.length > 0
      ? mapsCompetitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / mapsCompetitors.length : 0;
    levers.push({
      dimension: 'descoberta',
      action: 'Aumentar avaliações no Google Maps — solicitar ativamente após cada atendimento',
      impact: Math.round(weights.d2 * 12),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: `${myReviewsD2} avaliações (concorrentes: média ${Math.round(avgCompetitorReviews)})`,
      targetValue: 'Entrar no pacote local (top 3 no Maps)',
    });
  }

  if (rankedTerms === 0 && !hasWebsite) {
    levers.push({
      dimension: 'descoberta',
      action: 'Criar página no Google Sites ou site simples com palavras-chave locais',
      impact: Math.round(weights.d2 * 8),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: 'Sem site — invisível para buscas orgânicas',
      targetValue: 'Página indexada com nome, serviço e cidade',
    });
  }

  if (!aiVisibility?.likelyMentioned) {
    levers.push({
      dimension: 'descoberta',
      action: 'Adicionar descrição detalhada no Google Meu Negócio e responder avaliações — melhora visibilidade em IA',
      impact: Math.round(weights.d2 * 5),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Negócio não aparece em buscas de IA (ChatGPT, Perplexity)',
      targetValue: 'Mencionado como opção local em respostas de IA',
    });
  }

  // ── CREDIBILIDADE (D3) ────────────────────────────────────────────────────

  const myReviews = mapsPresence?.reviewCount || 0;
  const myPhotos = mapsPresence?.photoCount || 0;
  const maxCompetitorPhotos = mapsCompetitors.length > 0
    ? Math.max(...mapsCompetitors.map(c => c.photoCount || 0)) : 0;

  if (myReviews < 20) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Pedir avaliação para clientes satisfeitos via WhatsApp após cada atendimento',
      impact: Math.round(weights.d3 * 10),
      effort: 'baixo',
      horizon: '1-2 meses',
      currentValue: `${myReviews} avaliações no Google`,
      targetValue: '20+ avaliações com nota ≥ 4.5',
    });
  } else if ((mapsPresence?.ownerResponseRate || 0) < 0.5) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Responder todas as avaliações do Google Maps — aumenta confiança e ranking',
      impact: Math.round(weights.d3 * 5),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: `Responde ${Math.round((mapsPresence?.ownerResponseRate || 0) * 100)}% das avaliações`,
      targetValue: 'Resposta em 100% das avaliações',
    });
  }

  if (myPhotos < 10 && maxCompetitorPhotos > myPhotos) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Adicionar fotos reais do espaço, equipe e serviços no Google Maps',
      impact: Math.round(weights.d3 * 6),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: `${myPhotos} fotos (concorrente líder: ${maxCompetitorPhotos} fotos)`,
      targetValue: '20+ fotos de qualidade',
    });
  }

  return levers
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6);
}
