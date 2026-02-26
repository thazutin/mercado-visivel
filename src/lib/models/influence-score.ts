// ============================================================================
// Step 4e — Influence Score Composto (Modelo Proprietário)
// Combina Google + Instagram + Web num score único de influência local
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
  TermVolumeData,
} from '../types/pipeline.types';
import { CTR_BENCHMARKS } from './market-sizing';

// --- GOOGLE INFLUENCE CALCULATOR ---

/**
 * Calcula a influência do negócio no Google baseado em posição real no SERP.
 * 
 * Quando volumes reais não estão disponíveis (Google Ads KP não configurado),
 * usa proxy volume=1 pra cada termo — o score vira puramente posicional
 * (quanto CTR a posição real captura vs CTR da posição 1).
 */
export function calculateGoogleInfluence(
  serpPositions: SerpPosition[],
  mapsPresence: MapsPresence | null,
  termVolumes: TermVolumeData[],
): GoogleInfluence {
  let totalWeightedTraffic = 0;
  let businessTraffic = 0;

  // Se nenhum termo tem volume real, usa proxy=1 pra calcular score posicional
  const hasRealVolumes = termVolumes.some(tv => tv.monthlyVolume > 0);

  for (const sp of serpPositions) {
    const volumeData = termVolumes.find(tv => tv.term.toLowerCase() === sp.term.toLowerCase());
    
    // Volume: real se disponível, proxy=1 se não
    const volume = hasRealVolumes
      ? (volumeData?.monthlyVolume || 0)
      : 1;

    if (volume === 0) continue;

    const hasLocalPack = sp.serpFeatures?.includes('local_pack');
    const ctrTable = hasLocalPack 
      ? CTR_BENCHMARKS.withLocalPack 
      : CTR_BENCHMARKS.organic;

    // Total traffic available (posição 1 como teto teórico)
    totalWeightedTraffic += volume * (ctrTable[1] || 0.30);

    // Business traffic (posição real)
    if (sp.position && sp.position <= 10) {
      businessTraffic += volume * (ctrTable[sp.position] || CTR_BENCHMARKS.notFound || 0.005);
    } else {
      businessTraffic += volume * (CTR_BENCHMARKS.notFound || 0.005);
    }
  }

  // Maps presence bonus
  if (mapsPresence?.found && mapsPresence.inLocalPack && mapsPresence.localPackPosition) {
    const localPackCtr = CTR_BENCHMARKS.localPack;
    const mapsBonus = localPackCtr
      ? (localPackCtr[mapsPresence.localPackPosition] || 0)
      : 0.05;
    
    // Average volume proxy (1 if no real volumes)
    const avgVolume = hasRealVolumes
      ? termVolumes.reduce((s, t) => s + t.monthlyVolume, 0) / Math.max(termVolumes.length, 1)
      : 1;
    
    businessTraffic += avgVolume * mapsBonus * 0.5;
  }

  // Rating bonus
  let ratingMultiplier = 1.0;
  if (mapsPresence?.found && mapsPresence.rating) {
    if (mapsPresence.rating >= 4.5) ratingMultiplier = 1.06;
    else if (mapsPresence.rating >= 4.0) ratingMultiplier = 1.03;
    else if (mapsPresence.rating >= 3.5) ratingMultiplier = 1.0;
    else ratingMultiplier = 0.95;
  }

  const ctrShare = totalWeightedTraffic > 0
    ? (businessTraffic * ratingMultiplier) / totalWeightedTraffic
    : 0;

  return {
    serpPositions,
    mapsPresence,
    ctrShare: Math.min(ctrShare, 1.0),
    competitorCtrShares: [],
  };
}

// --- INSTAGRAM INFLUENCE CALCULATOR ---

/**
 * Calcula a influência do negócio no Instagram.
 * 
 * Quando não há concorrentes disponíveis, calcula um score absoluto
 * baseado em benchmarks de mercado local em vez de retornar 0.
 */
export function calculateInstagramInfluence(
  businessProfile: InstagramProfile,
  competitorProfiles: InstagramProfile[],
): InstagramInfluence {
  const allAvailable = [businessProfile, ...competitorProfiles].filter(p => p.dataAvailable);

  // Se o business profile não tem dados, retorna 0
  if (!businessProfile.dataAvailable) {
    return {
      profile: businessProfile,
      competitors: competitorProfiles,
      relativeShare: 0,
    };
  }

  // Se não há concorrentes com dados, calcula score absoluto
  if (allAvailable.length <= 1) {
    // Score absoluto baseado em métricas brutas
    // Benchmarks para negócios locais: ~500 followers = 0.2, ~2000 = 0.5, ~10000 = 0.8
    const followerScore = Math.min(businessProfile.followers / 5000, 1.0);
    
    // Engagement rate: >3% = excelente, 1-3% = bom, <1% = baixo
    const engScore = Math.min(businessProfile.engagementRate / 0.03, 1.0);
    
    // Posts frequency: >8/month = ativo, 4-8 = médio, <4 = baixo
    const freqScore = Math.min(businessProfile.postsLast30d / 8, 1.0);
    
    // Score absoluto (não relativo a concorrentes)
    const absoluteScore = followerScore * 0.4 + engScore * 0.35 + freqScore * 0.25;

    return {
      profile: businessProfile,
      competitors: competitorProfiles,
      relativeShare: Math.min(absoluteScore, 1.0),
    };
  }

  // Com concorrentes: score relativo
  const scores = allAvailable.map(profile => ({
    handle: profile.handle,
    score: calculateSingleInstagramScore(profile, allAvailable),
  }));

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const businessScore = scores.find(s => s.handle === businessProfile.handle)?.score || 0;
  const relativeShare = totalScore > 0 ? businessScore / totalScore : 0;

  return {
    profile: businessProfile,
    competitors: competitorProfiles,
    relativeShare,
  };
}

/**
 * Score individual de um perfil no Instagram.
 */
function calculateSingleInstagramScore(
  profile: InstagramProfile,
  allProfiles: InstagramProfile[],
): number {
  if (!profile.dataAvailable) return 0;

  const maxReachAbsolute = Math.max(...allProfiles.map(p => p.reachAbsolute), 1);
  const reachAbsoluteNormalized = profile.reachAbsolute / maxReachAbsolute;

  const reachRelative = profile.followers > 0
    ? Math.min(profile.reachAbsolute / profile.followers, 1.0)
    : 0;

  const engagementRate = profile.reachAbsolute > 0
    ? Math.min(profile.avgLikesLast30d / profile.reachAbsolute, 0.3)
    : 0;
  const maxEngagement = Math.max(...allProfiles.map(p => 
    p.reachAbsolute > 0 ? Math.min(p.avgLikesLast30d / p.reachAbsolute, 0.3) : 0
  ), 0.01);
  const engagementNormalized = engagementRate / maxEngagement;

  return (
    reachAbsoluteNormalized * 0.55 +
    reachRelative * 0.25 +
    engagementNormalized * 0.20
  );
}

// --- WEB INFLUENCE CALCULATOR ---

export function calculateWebInfluence(
  webData: WebInfluence,
  competitorWebData: WebInfluence[],
): { score: number; available: boolean } {
  if (!webData.available || !webData.monthlyVisits) {
    return { score: 0, available: false };
  }

  const allVisits = [
    webData.monthlyVisits,
    ...competitorWebData
      .filter(c => c.available && c.monthlyVisits)
      .map(c => c.monthlyVisits!),
  ];

  const maxVisits = Math.max(...allVisits, 1);
  const visitShare = webData.monthlyVisits / maxVisits;
  const authorityNormalized = (webData.authorityScore || 0) / 100;
  const score = visitShare * 0.60 + authorityNormalized * 0.40;

  return { score: Math.min(score, 1.0), available: true };
}

// --- COMPOSITE INFLUENCE SCORE ---

/**
 * Combina Google + Instagram + Web.
 * 
 * Aceita serpPositions como fallback para competitorWebData
 * (backward compat com analysis.ts que passa serpPositions aqui).
 */
export function calculateCompositeInfluence(
  google: GoogleInfluence,
  instagram: InstagramInfluence,
  webData: WebInfluence,
  _extra?: any, // backward compat — analysis.ts passes serpPositions here
): Step4Output {
  const startTime = Date.now();

  const googleScore = google.ctrShare;
  const instagramScore = instagram.relativeShare;
  const instagramAvailable = instagram.profile.dataAvailable;

  const webResult = calculateWebInfluence(webData, []);
  const webScore = webResult.score;
  const webAvailable = webResult.available;

  // Pesos baseados na disponibilidade
  let googleWeight: number;
  let instagramWeight: number;
  let webWeight: number;

  if (webAvailable && instagramAvailable) {
    googleWeight = 0.50;
    instagramWeight = 0.30;
    webWeight = 0.20;
  } else if (!webAvailable && instagramAvailable) {
    googleWeight = 0.60;
    instagramWeight = 0.40;
    webWeight = 0;
  } else if (webAvailable && !instagramAvailable) {
    googleWeight = 0.70;
    instagramWeight = 0;
    webWeight = 0.30;
  } else {
    googleWeight = 1.0;
    instagramWeight = 0;
    webWeight = 0;
  }

  const totalInfluence = Math.round(
    (googleScore * googleWeight +
     instagramScore * instagramWeight +
     webScore * webWeight) * 100
  );

  const sourcesUsed: string[] = ['google_serp'];
  const sourcesUnavailable: string[] = [];

  if (google.mapsPresence?.found) sourcesUsed.push('google_maps');
  if (instagramAvailable) sourcesUsed.push('instagram');
  else sourcesUnavailable.push('instagram');
  if (webAvailable) sourcesUsed.push('similarweb');
  else sourcesUnavailable.push('similarweb');

  console.log(`[Influence] Google: ${Math.round(googleScore * 100)}% (ctrShare=${google.ctrShare.toFixed(3)}) | Instagram: ${Math.round(instagramScore * 100)}% (share=${instagram.relativeShare.toFixed(3)}) | Composite: ${totalInfluence}%`);

  const influence: InfluenceScore = {
    totalInfluence,
    google: {
      score: Math.round(googleScore * 100),
      weight: googleWeight,
      available: true,
    },
    instagram: {
      score: Math.round(instagramScore * 100),
      weight: instagramWeight,
      available: instagramAvailable,
    },
    web: {
      score: Math.round(webScore * 100),
      weight: webWeight,
      available: webAvailable,
    },
    competitorScores: [],
    rawGoogle: google,
    rawInstagram: instagram,
    rawWeb: webData,
  };

  return {
    influence,
    processingTimeMs: Date.now() - startTime,
    sourcesUsed,
    sourcesUnavailable,
  };
}
