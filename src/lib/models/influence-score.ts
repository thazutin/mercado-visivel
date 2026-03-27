// ============================================================================
// Step 4e — Posição Competitiva Local — Modelo de 4 Dimensões
// D1 Descoberta · D2 Credibilidade · D3 Presença · D4 Reputação
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

// ─── D1: Descoberta (SERP + Maps + AI) ─────────────────────────────────────
// Mede: conseguem te encontrar quando buscam?
function scoreD1_descoberta(
  serpPositions: SerpPosition[],
  mapsPresence: MapsPresence | null,
  aiVisibility: { score: number; likelyMentioned: boolean } | null,
  mapsCompetitors: Array<{ rating?: number; reviewCount?: number }>,
  clientType: string,
  linkedinPresent: boolean,
): number {
  // SERP: posição ponderada por volume relativo
  let serpTotal = 0;
  for (const sp of serpPositions) {
    if (sp.position && sp.position <= 3) serpTotal += 100;
    else if (sp.position && sp.position <= 10) serpTotal += 50;
    else if (sp.position && sp.position <= 20) serpTotal += 15;
  }
  const serpScore = serpPositions.length > 0 ? serpTotal / serpPositions.length : 0;

  // Maps: presença + posição no local pack
  let mapsScore = 0;
  if (mapsPresence?.found) {
    mapsScore = 40;
    if (mapsPresence.inLocalPack) mapsScore = 70;
    if (mapsPresence.localPackPosition && mapsPresence.localPackPosition <= 3) mapsScore = 90;
  }

  // Relativização Maps vs concorrentes
  if (mapsPresence?.found && mapsCompetitors.length > 0) {
    const myReviews = mapsPresence.reviewCount || 0;
    const competitorAvgReviews = mapsCompetitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / mapsCompetitors.length;
    if (competitorAvgReviews > 0) {
      const reviewRatio = myReviews / (myReviews + competitorAvgReviews);
      const relativePenalty = 0.5 + (reviewRatio * 0.5);
      mapsScore = Math.round(mapsScore * relativePenalty);
    }
  }

  // AI: visibilidade em ferramentas de IA
  let aiScore = 0;
  if (aiVisibility?.likelyMentioned) {
    aiScore = Math.min(aiVisibility.score, 100);
  }

  // LinkedIn para B2B (substitui parcialmente Maps)
  let linkedinScore = 0;
  if ((clientType === 'b2b') && linkedinPresent) {
    linkedinScore = 50;
  }

  if (clientType === 'b2b') {
    // B2B: SERP 40% + LinkedIn 30% + AI 20% + Maps 10%
    return serpScore * 0.40 + linkedinScore * 0.30 + aiScore * 0.20 + mapsScore * 0.10;
  }
  // B2C: SERP 50% + Maps 30% + AI 20%
  return serpScore * 0.50 + mapsScore * 0.30 + aiScore * 0.20;
}

// ─── D2: Credibilidade (avaliações + engajamento + website) ──────────────────
// Mede: quando te encontram, confiam em você?
function scoreD2_credibilidade(
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
    const maxCompetitorReviews = Math.max(...mapsCompetitors.map(c => c.reviewCount || 0), 1);
    const maxCompetitorPhotos = Math.max(...mapsCompetitors.map(c => c.photoCount || 0), 1);
    const avgCompetitorRating = mapsCompetitors.reduce((s, c) => s + (c.rating || 0), 0) / mapsCompetitors.length;

    const reviewRatio = myReviews / (myReviews + maxCompetitorReviews);
    const photoRatio = myPhotos / (myPhotos + maxCompetitorPhotos);
    const ratingRelative = avgCompetitorRating > 0
      ? Math.min(myRating / avgCompetitorRating, 1.5) / 1.5
      : 0.5;

    const relativeScore = reviewRatio * 0.50 + ratingRelative * 0.30 + photoRatio * 0.20;
    reviewScore = Math.round(relativeScore * 100);

    if (myResponseRate > 0.8) reviewScore = Math.min(100, reviewScore + 10);
    else if (myResponseRate > 0.5) reviewScore = Math.min(100, reviewScore + 5);
  } else {
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
    if (engRate >= 0.05) engagementScore = 80;
    else if (engRate >= 0.03) engagementScore = 55;
    else if (engRate >= 0.01) engagementScore = 30;
    else if (engRate > 0) engagementScore = 10;

    const hasRecentPosts = (igProfile.recentPostsCount ?? 0) > 0;
    if (!hasRecentPosts) engagementScore = Math.round(engagementScore * 0.5);
  }
  if ((clientType === 'b2b' || clientType === 'b2g') && linkedinPresent) {
    engagementScore = Math.max(engagementScore, 35);
  }

  // Website
  const websiteScore = hasWebsite ? 40 : 0;

  // Ponderação: reviews 40% + engajamento 35% + website 25%
  return reviewScore * 0.40 + engagementScore * 0.35 + websiteScore * 0.25;
}

// ─── D3: Presença (Instagram + conteúdo + LinkedIn) ─────────────────────────
// Mede: o negócio mantém relacionamento com quem já conhece?
function scoreD3_presenca(
  igProfile: InstagramProfile | null,
  linkedinPresent: boolean,
  clientType: string,
): number {
  let score = 0;

  if (igProfile?.dataAvailable) {
    const followers = igProfile.followers || 0;
    const postsLast30d = igProfile.postsLast30d || 0;
    const hasRecentPosts = (igProfile.recentPostsCount ?? 0) > 0;
    const avgReach = igProfile.reachAbsolute || 0;
    const reachRate = followers > 0 ? avgReach / followers : 0;

    // Frequência de postagem (0-40pts)
    let freqScore = 0;
    if (postsLast30d >= 12) freqScore = 40;      // 3x/semana+
    else if (postsLast30d >= 8) freqScore = 30;   // 2x/semana
    else if (postsLast30d >= 4) freqScore = 20;   // 1x/semana
    else if (postsLast30d >= 1) freqScore = 10;

    // Recência (sem posts recentes = corte severo)
    if (!hasRecentPosts) freqScore = Math.round(freqScore * 0.3);

    // Alcance relativo (0-40pts)
    let reachScore = 0;
    if (reachRate >= 0.15) reachScore = 40;
    else if (reachRate >= 0.08) reachScore = 30;
    else if (reachRate >= 0.03) reachScore = 20;
    else if (reachRate > 0) reachScore = 10;
    else if (followers >= 500) reachScore = 5;

    // Tamanho da audiência (0-20pts)
    let audienceScore = 0;
    if (followers >= 5000) audienceScore = 20;
    else if (followers >= 1000) audienceScore = 15;
    else if (followers >= 500) audienceScore = 10;
    else if (followers >= 100) audienceScore = 5;

    score = freqScore + reachScore + audienceScore;
  }

  // LinkedIn para B2B
  if (clientType === 'b2b') {
    const linkedinBonus = linkedinPresent ? 30 : 0;
    if (igProfile?.dataAvailable) {
      score = Math.round(score * 0.5) + linkedinBonus;
    } else {
      score = linkedinBonus;
    }
  }

  return Math.min(100, score);
}

// ─── D4: Reputação (avaliações volume + recência + respostas do dono) ───────
// Mede: a base de clientes te recomenda ativamente?
function scoreD4_reputacao(
  mapsPresence: MapsPresence | null,
  mapsCompetitors: Array<{ rating?: number; reviewCount?: number; photoCount?: number }>,
  clientType: string,
): number {
  const myReviews = mapsPresence?.reviewCount || 0;
  const myRating = mapsPresence?.rating || 0;
  const myResponseRate = mapsPresence?.ownerResponseRate || 0;

  if (!mapsPresence?.found) return 0;

  // Volume de avaliações relativizado (0-40pts)
  let volumeScore = 0;
  if (mapsCompetitors.length > 0) {
    const maxCompetitorReviews = Math.max(...mapsCompetitors.map(c => c.reviewCount || 0), 1);
    const reviewRatio = myReviews / (myReviews + maxCompetitorReviews);
    volumeScore = Math.round(reviewRatio * 80);
    if (myReviews >= 100) volumeScore = Math.min(40, volumeScore + 10);
    else if (myReviews >= 50) volumeScore = Math.min(40, volumeScore + 5);
  } else {
    if (myReviews >= 100) volumeScore = 40;
    else if (myReviews >= 50) volumeScore = 30;
    else if (myReviews >= 20) volumeScore = 20;
    else if (myReviews >= 5) volumeScore = 10;
    else if (myReviews > 0) volumeScore = 5;
  }

  // Nota relativizada (0-30pts)
  let ratingScore = 0;
  if (mapsCompetitors.length > 0) {
    const avgCompetitorRating = mapsCompetitors.reduce((s, c) => s + (c.rating || 0), 0) / mapsCompetitors.length;
    if (avgCompetitorRating > 0) {
      const ratingRatio = Math.min(myRating / avgCompetitorRating, 1.3);
      ratingScore = Math.round((ratingRatio / 1.3) * 30);
    }
  } else {
    if (myRating >= 4.8) ratingScore = 30;
    else if (myRating >= 4.5) ratingScore = 25;
    else if (myRating >= 4.0) ratingScore = 15;
    else if (myRating >= 3.5) ratingScore = 8;
    else if (myRating > 0) ratingScore = 3;
  }

  // Respostas do dono (0-30pts)
  let responseScore = 0;
  if (myResponseRate >= 0.9) responseScore = 30;
  else if (myResponseRate >= 0.7) responseScore = 22;
  else if (myResponseRate >= 0.5) responseScore = 15;
  else if (myResponseRate >= 0.2) responseScore = 8;

  return Math.min(100, volumeScore + ratingScore + responseScore);
}

// ─── Pesos por clientType (4 dimensões) ──────────────────────────────────────
const WEIGHTS: Record<string, { d1: number; d2: number; d3: number; d4: number }> = {
  b2c: { d1: 0.30, d2: 0.25, d3: 0.25, d4: 0.20 },
  // B2C: descoberta importante, credibilidade e presença equilibradas, reputação como diferencial
  b2b: { d1: 0.35, d2: 0.35, d3: 0.20, d4: 0.10 },
  // B2B: descoberta e credibilidade dominam, presença via LinkedIn, reputação menos pública
  b2g: { d1: 0.30, d2: 0.25, d3: 0.25, d4: 0.20 },
  // B2G: mesmo que B2C como fallback
};

// ─── Interface de breakdown ──────────────────────────────────────────────────
export interface InfluenceBreakdown {
  total: number;
  d1_descoberta: number;   // Aparece quando buscam (SERP + Maps + AI)
  d2_credibilidade: number; // Convence quem encontra (avaliações + site)
  d3_presenca: number;     // Mantém relacionamento (Instagram + conteúdo)
  d4_reputacao: number;    // Base te recomenda (volume avaliações + recência + respostas)
  // Compat fields
  d1_discovery: number;
  d2_credibility: number;
  d3_reach: number;
  d4_ai_visibility: number;
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

// ─── Composite Influence (4D model) ──────────────────────────────────────────

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

  // 4 dimensões
  const d1 = scoreD1_descoberta(
    google.serpPositions,
    google.mapsPresence,
    aiVisibility || null,
    mapsCompetitors,
    ct,
    linkedinPresent || false,
  );

  const d2 = scoreD2_credibilidade(
    google.mapsPresence,
    hasWebsite,
    igProfile,
    linkedinPresent || false,
    ct,
    mapsCompetitors,
  );

  const d3 = scoreD3_presenca(
    igProfile,
    linkedinPresent || false,
    ct,
  );

  const d4 = scoreD4_reputacao(
    google.mapsPresence,
    mapsCompetitors,
    ct,
  );

  const rawInfluence = Math.round(
    d1 * weights.d1 + d2 * weights.d2 + d3 * weights.d3 + d4 * weights.d4
  );

  // Cap realista com raiz quadrada
  const totalInfluence = Math.round(Math.sqrt(rawInfluence / 100) * 40);

  const breakdown: InfluenceBreakdown = {
    total: totalInfluence,
    d1_descoberta: Math.round(d1),
    d2_credibilidade: Math.round(d2),
    d3_presenca: Math.round(d3),
    d4_reputacao: Math.round(d4),
    // Compat fields (mantém para não quebrar outros componentes)
    d1_discovery: Math.round(d1),
    d2_credibility: Math.round(d2),
    d3_reach: Math.round(d3),
    d4_ai_visibility: Math.round(d1), // AI está dentro de D1 agora
  };

  console.log(`[PosComp 4D] Raw=${rawInfluence}% → Realistic=${totalInfluence}% | D1_Descoberta=${Math.round(d1)} D2_Credibilidade=${Math.round(d2)} D3_Presença=${Math.round(d3)} D4_Reputação=${Math.round(d4)} | Concorrentes: ${mapsCompetitors.length}`);

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
      weight: weights.d1,
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
      weight: weights.d3,
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
  console.log(`[PosComp 4D] Levers gerados: ${levers.length} alavancas`);

  return {
    influence,
    processingTimeMs: Date.now() - startTime,
    sourcesUsed,
    sourcesUnavailable,
  };
}

// ─── Influence Levers — Ações acionáveis por dimensão ────────────────────────

export interface InfluenceLever {
  dimension: 'descoberta' | 'credibilidade' | 'presenca' | 'reputacao';
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

  // ── DESCOBERTA (D1) ─────────────────────────────────────────────────────

  const rankedTerms = serpPositions.filter(sp => sp.position && sp.position <= 10).length;

  if (!mapsPresence?.found) {
    levers.push({
      dimension: 'descoberta',
      action: 'Criar e verificar perfil no Google Meu Negócio',
      impact: Math.round(weights.d1 * 18),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Negócio não encontrado no Google Maps',
      targetValue: 'Perfil verificado com fotos, horário e categoria',
    });
  } else if (!mapsPresence.inLocalPack) {
    const myReviewsD1 = mapsPresence.reviewCount || 0;
    const avgCompetitorReviews = mapsCompetitors.length > 0
      ? mapsCompetitors.reduce((s, c) => s + (c.reviewCount || 0), 0) / mapsCompetitors.length : 0;
    levers.push({
      dimension: 'descoberta',
      action: 'Aumentar avaliações no Google Maps — solicitar ativamente após cada atendimento',
      impact: Math.round(weights.d1 * 12),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: `${myReviewsD1} avaliações (concorrentes: média ${Math.round(avgCompetitorReviews)})`,
      targetValue: 'Entrar no pacote local (top 3 no Maps)',
    });
  }

  if (rankedTerms === 0 && !hasWebsite) {
    levers.push({
      dimension: 'descoberta',
      action: 'Criar página no Google Sites ou site simples com palavras-chave locais',
      impact: Math.round(weights.d1 * 8),
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
      impact: Math.round(weights.d1 * 5),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Negócio não aparece em buscas de IA (ChatGPT, Perplexity)',
      targetValue: 'Mencionado como opção local em respostas de IA',
    });
  }

  // ── CREDIBILIDADE (D2) ──────────────────────────────────────────────────

  const myReviews = mapsPresence?.reviewCount || 0;
  const myPhotos = mapsPresence?.photoCount || 0;
  const maxCompetitorPhotos = mapsCompetitors.length > 0
    ? Math.max(...mapsCompetitors.map(c => c.photoCount || 0)) : 0;

  if (myReviews < 20) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Pedir avaliação para clientes satisfeitos via WhatsApp após cada atendimento',
      impact: Math.round(weights.d2 * 10),
      effort: 'baixo',
      horizon: '1-2 meses',
      currentValue: `${myReviews} avaliações no Google`,
      targetValue: '20+ avaliações com nota ≥ 4.5',
    });
  }

  if (myPhotos < 10 && maxCompetitorPhotos > myPhotos) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Adicionar fotos reais do espaço, equipe e serviços no Google Maps',
      impact: Math.round(weights.d2 * 6),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: `${myPhotos} fotos (concorrente líder: ${maxCompetitorPhotos} fotos)`,
      targetValue: '20+ fotos de qualidade',
    });
  }

  if (!hasWebsite) {
    levers.push({
      dimension: 'credibilidade',
      action: 'Criar site com depoimentos e portfólio — reforça confiança de quem pesquisa',
      impact: Math.round(weights.d2 * 7),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: 'Sem site detectado',
      targetValue: 'Site com depoimentos, portfólio e contato',
    });
  }

  // ── PRESENÇA (D3) ───────────────────────────────────────────────────────

  if (!igProfile?.dataAvailable || igProfile.followers === 0) {
    levers.push({
      dimension: 'presenca',
      action: 'Criar perfil profissional no Instagram',
      impact: Math.round(weights.d3 * 15),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: 'Sem perfil detectado',
      targetValue: 'Perfil ativo com bio, link e categoria',
    });
  } else if ((igProfile.recentPostsCount ?? 0) === 0) {
    levers.push({
      dimension: 'presenca',
      action: 'Retomar postagens — mínimo 2x por semana',
      impact: Math.round(weights.d3 * 12),
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
        dimension: 'presenca',
        action: 'Aumentar frequência de Reels — formato com maior alcance orgânico',
        impact: Math.round(weights.d3 * 8),
        effort: 'médio',
        horizon: '1-2 meses',
        currentValue: `Alcance médio: ${(reachRate * 100).toFixed(0)}% dos seguidores`,
        targetValue: 'Alcance acima de 8% dos seguidores',
      });
    }
  }

  if (clientType === 'b2b') {
    levers.push({
      dimension: 'presenca',
      action: 'Ativar LinkedIn com posts sobre cases e serviços',
      impact: Math.round(weights.d3 * 10),
      effort: 'médio',
      horizon: '1-2 meses',
      currentValue: 'LinkedIn não detectado ou inativo',
      targetValue: 'Perfil ativo com 2+ posts/semana sobre cases',
    });
  }

  // ── REPUTAÇÃO (D4) ──────────────────────────────────────────────────────

  const responseRate = mapsPresence?.ownerResponseRate || 0;
  if (responseRate < 0.5 && myReviews > 0) {
    levers.push({
      dimension: 'reputacao',
      action: 'Criar rotina de resposta às avaliações — responder 100% em 24h',
      impact: Math.round(weights.d4 * 12),
      effort: 'baixo',
      horizon: '1-2 semanas',
      currentValue: `Responde ${Math.round(responseRate * 100)}% das avaliações`,
      targetValue: 'Resposta em 100% das avaliações em até 24h',
    });
  }

  if (mapsCompetitors.length > 0) {
    const maxCompetitorReviews = Math.max(...mapsCompetitors.map(c => c.reviewCount || 0));
    if (myReviews < maxCompetitorReviews * 0.5) {
      levers.push({
        dimension: 'reputacao',
        action: 'Criar sistema de solicitação de avaliação pós-atendimento via WhatsApp',
        impact: Math.round(weights.d4 * 10),
        effort: 'médio',
        horizon: '1-2 meses',
        currentValue: `${myReviews} avaliações (líder: ${maxCompetitorReviews})`,
        targetValue: `${Math.round(maxCompetitorReviews * 0.8)}+ avaliações`,
      });
    }
  }

  const myRating = mapsPresence?.rating || 0;
  if (mapsCompetitors.length > 0 && myRating > 0) {
    const avgCompetitorRating = mapsCompetitors.reduce((s, c) => s + (c.rating || 0), 0) / mapsCompetitors.length;
    if (myRating < avgCompetitorRating - 0.2) {
      levers.push({
        dimension: 'reputacao',
        action: 'Solicitar atualização de avaliações antigas com clientes fiéis',
        impact: Math.round(weights.d4 * 6),
        effort: 'médio',
        horizon: '1-2 meses',
        currentValue: `Nota ${myRating.toFixed(1)}★ (concorrentes: ${avgCompetitorRating.toFixed(1)}★)`,
        targetValue: `${Math.min(5, avgCompetitorRating + 0.2).toFixed(1)}★ ou superior`,
      });
    }
  }

  return levers
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 6);
}
