// ============================================================================
// Step 4e — Influence Score — Modelo de 4 Dimensões
// D1 Descoberta · D2 Credibilidade · D3 Alcance Social · D4 Visibilidade IA
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

// ─── D1: Descoberta ──────────────────────────────────────────────────────────
function scoreD1(
  serpPositions: SerpPosition[],
  mapsPresence: MapsPresence | null,
): number {
  // SERP position score (avg across terms)
  let serpTotal = 0;
  const scoredTerms = serpPositions.filter(sp => sp.position !== null);
  for (const sp of serpPositions) {
    if (sp.position && sp.position <= 3) serpTotal += 100;
    else if (sp.position && sp.position <= 10) serpTotal += 70;
    else if (sp.position && sp.position <= 20) serpTotal += 40;
    // else 0
  }
  const serpScore = serpPositions.length > 0 ? serpTotal / serpPositions.length : 0;

  // GMB presence
  const gmbScore = mapsPresence?.found ? 60 : 0;

  // Rating bonus
  let ratingBonus = 0;
  if (mapsPresence?.found && mapsPresence.rating) {
    if (mapsPresence.rating >= 4.5) ratingBonus = 20;
    else if (mapsPresence.rating >= 4.0) ratingBonus = 10;
  }

  // Weighted: SERP 50% + GMB 30% + Rating 20%
  return serpScore * 0.5 + gmbScore * 0.3 + ratingBonus * 0.2;
}

// ─── D2: Credibilidade ───────────────────────────────────────────────────────
function scoreD2(
  mapsPresence: MapsPresence | null,
  hasWebsite: boolean,
): number {
  // Review count score
  let reviewScore = 0;
  const reviews = mapsPresence?.reviewCount || 0;
  if (reviews >= 50) reviewScore = 100;
  else if (reviews >= 20) reviewScore = 70;
  else if (reviews >= 5) reviewScore = 40;
  else if (reviews > 0) reviewScore = 10;

  // Website presence
  const websiteScore = hasWebsite ? 30 : 0;

  // Weighted: reviews 70% + website 30%
  return reviewScore * 0.7 + websiteScore * 0.3;
}

// ─── D3: Alcance Social ──────────────────────────────────────────────────────
function scoreD3(
  igProfile: InstagramProfile | null,
  linkedinPresent: boolean,
  clientType: string,
): number {
  const scores: number[] = [];

  // Instagram
  if (igProfile?.dataAvailable) {
    let igScore = 0;
    const followers = igProfile.followers || 0;
    if (followers >= 5000) igScore = 100;
    else if (followers >= 1000) igScore = 75;
    else if (followers >= 500) igScore = 50;
    else if (followers >= 100) igScore = 30;
    else igScore = 10;

    // Recency adjustment
    const hasRecentPosts = (igProfile.recentPostsCount ?? 0) > 0;
    if (hasRecentPosts) igScore += 20;
    else igScore -= 30;
    igScore = Math.max(0, Math.min(100, igScore));

    scores.push(igScore);
  }

  // LinkedIn (b2b/b2g only — simplified)
  if ((clientType === 'b2b' || clientType === 'b2g') && linkedinPresent) {
    scores.push(60); // has LinkedIn profile
  } else if (clientType === 'b2b' || clientType === 'b2g') {
    scores.push(0); // should have but doesn't
  }

  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── D4: Visibilidade em IA ──────────────────────────────────────────────────
function scoreD4(
  aiVisibility: { score: number; likelyMentioned: boolean } | null,
): number {
  if (!aiVisibility) return 0;
  return aiVisibility.likelyMentioned ? aiVisibility.score : 0;
}

// ─── Pesos por clientType ────────────────────────────────────────────────────
const WEIGHTS: Record<string, { d1: number; d2: number; d3: number; d4: number }> = {
  b2c: { d1: 0.35, d2: 0.20, d3: 0.35, d4: 0.10 },
  b2b: { d1: 0.35, d2: 0.35, d3: 0.15, d4: 0.15 },
  b2g: { d1: 0.40, d2: 0.30, d3: 0.10, d4: 0.20 },
};

// ─── Interface de breakdown ──────────────────────────────────────────────────
export interface InfluenceBreakdown {
  total: number;
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

  // Has website? Check via SERP or Maps
  const hasWebsite = !!(
    (organicPresence?.available && organicPresence.totalRanked > 0) ||
    google.mapsPresence?.website ||
    (webData.available && webData.monthlyVisits)
  );

  // Calculate 4 dimensions
  const d1 = scoreD1(google.serpPositions, google.mapsPresence);
  const d2 = scoreD2(google.mapsPresence, hasWebsite);
  const d3 = scoreD3(
    instagram.profile.dataAvailable ? instagram.profile : null,
    linkedinPresent || false,
    ct,
  );
  const d4 = scoreD4(aiVisibility || null);

  const totalInfluence = Math.round(
    d1 * weights.d1 + d2 * weights.d2 + d3 * weights.d3 + d4 * weights.d4
  );

  const breakdown: InfluenceBreakdown = {
    total: totalInfluence,
    d1_discovery: Math.round(d1),
    d2_credibility: Math.round(d2),
    d3_reach: Math.round(d3),
    d4_ai_visibility: Math.round(d4),
  };

  console.log(`[Influence 4D] D1=${breakdown.d1_discovery} D2=${breakdown.d2_credibility} D3=${breakdown.d3_reach} D4=${breakdown.d4_ai_visibility} → Total=${totalInfluence}% (${ct} weights)`);

  // Backward-compat: also compute old-style scores
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

  return {
    influence,
    processingTimeMs: Date.now() - startTime,
    sourcesUsed,
    sourcesUnavailable,
  };
}
