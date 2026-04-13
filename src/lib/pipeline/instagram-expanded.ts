// ============================================================================
// Virô Radar — Instagram Competitors Analysis (DADOS REAIS)
// Compara dados REAIS scraped do Instagram. Sem Claude, sem inferência.
// Cada número vem do scraping real do Apify.
// ============================================================================

export interface ExpandedInstagramAnalysis {
  handle: string;
  followers: number;
  engagementRate: number;
  postsLast30d: number;
  avgLikes: number;
  avgViews: number;
}

export interface CompetitorInsight {
  business: ExpandedInstagramAnalysis | null;
  competitors: ExpandedInstagramAnalysis[];
  gaps: string[];          // Baseados em dados reais, não inferência
  summary: string;
  source: 'apify_scrape';
}

/**
 * Compara dados REAIS do Instagram do negócio vs concorrentes.
 * Cada insight é derivado matematicamente dos dados scraped, não de IA.
 */
export function analyzeInstagramCompetitors(
  businessHandle: string | null,
  businessFollowers: number,
  businessEngagement: number,
  businessPostsLast30d: number,
  businessAvgLikes: number,
  competitors: Array<{
    handle: string;
    followers: number;
    engagementRate: number;
    postsLast30d?: number;
    avgLikes?: number;
    avgViews?: number;
  }>,
): CompetitorInsight {
  if (competitors.length === 0) {
    return {
      business: businessHandle ? {
        handle: businessHandle,
        followers: businessFollowers,
        engagementRate: businessEngagement,
        postsLast30d: businessPostsLast30d,
        avgLikes: businessAvgLikes,
        avgViews: 0,
      } : null,
      competitors: [],
      gaps: [],
      summary: 'Sem concorrentes no Instagram pra comparar.',
      source: 'apify_scrape',
    };
  }

  const compAnalysis: ExpandedInstagramAnalysis[] = competitors.map(c => ({
    handle: c.handle,
    followers: c.followers || 0,
    engagementRate: c.engagementRate || 0,
    postsLast30d: c.postsLast30d || 0,
    avgLikes: c.avgLikes || 0,
    avgViews: c.avgViews || 0,
  }));

  // Gaps baseados em dados reais (comparação matemática, sem IA)
  const gaps: string[] = [];

  // Followers
  const avgCompFollowers = Math.round(compAnalysis.reduce((s, c) => s + c.followers, 0) / compAnalysis.length);
  if (businessFollowers < avgCompFollowers * 0.5) {
    gaps.push(`Seus ${businessFollowers.toLocaleString('pt-BR')} seguidores são menos da metade da média dos concorrentes (${avgCompFollowers.toLocaleString('pt-BR')})`);
  }

  // Frequência de posts
  const avgCompPosts = Math.round(compAnalysis.reduce((s, c) => s + c.postsLast30d, 0) / compAnalysis.length);
  if (businessPostsLast30d < avgCompPosts * 0.5 && avgCompPosts > 2) {
    gaps.push(`Você postou ${businessPostsLast30d}x nos últimos 30 dias. Concorrentes: média de ${avgCompPosts}x`);
  }

  // Engajamento
  const avgCompEng = compAnalysis.reduce((s, c) => s + c.engagementRate, 0) / compAnalysis.length;
  if (businessEngagement > avgCompEng * 1.5 && businessEngagement > 0.02) {
    gaps.push(`Seu engajamento (${(businessEngagement * 100).toFixed(1)}%) é maior que a média dos concorrentes (${(avgCompEng * 100).toFixed(1)}%) — qualidade boa, falta volume`);
  } else if (businessEngagement < avgCompEng * 0.5 && avgCompEng > 0.01) {
    gaps.push(`Engajamento ${(businessEngagement * 100).toFixed(1)}% vs média dos concorrentes ${(avgCompEng * 100).toFixed(1)}%`);
  }

  // Maior concorrente
  const biggest = [...compAnalysis].sort((a, b) => b.followers - a.followers)[0];
  if (biggest && biggest.followers > businessFollowers * 3) {
    gaps.push(`@${biggest.handle} tem ${biggest.followers.toLocaleString('pt-BR')} seguidores (${Math.round(biggest.followers / Math.max(businessFollowers, 1))}x os seus)`);
  }

  const summary = gaps.length === 0
    ? `Você está competitivo no Instagram: ${businessFollowers.toLocaleString('pt-BR')} seguidores, ${businessPostsLast30d} posts/mês, ${(businessEngagement * 100).toFixed(1)}% engajamento.`
    : `${gaps.length} gap(s) detectado(s) comparando seus dados com ${compAnalysis.length} concorrente(s). Todos os números são do scraping real do Instagram.`;

  return {
    business: businessHandle ? {
      handle: businessHandle,
      followers: businessFollowers,
      engagementRate: businessEngagement,
      postsLast30d: businessPostsLast30d,
      avgLikes: businessAvgLikes,
      avgViews: 0,
    } : null,
    competitors: compAnalysis,
    gaps,
    summary,
    source: 'apify_scrape',
  };
}
