// ============================================================================
// Virô Radar — Google Trends Integration (DADOS REAIS)
// Busca sazonalidade real via Apify Google Trends scraper.
// Sem inferência, sem Claude. Só dados reais do Google Trends.
// ============================================================================

export interface TrendData {
  term: string;
  monthlyTrend: { month: string; interest: number }[];
  peakMonth: string;
  lowMonth: string;
  isRising: boolean;
  averageInterest: number;
}

export interface SeasonalityResult {
  terms: TrendData[];
  bestMonths: string[];
  worstMonths: string[];
  seasonalityStrength: 'high' | 'medium' | 'low';
  summary: string;
  source: 'google_trends_apify' | 'unavailable';
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Busca dados reais do Google Trends via Apify actor.
 * Actor: "emastra/google-trends-scraper" (grátis no plano Apify)
 */
async function fetchTrendsApify(terms: string[], geo: string = 'BR'): Promise<any[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn('[GoogleTrends] APIFY_API_TOKEN not set');
    return [];
  }

  try {
    // Inicia o actor
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/emastra~google-trends-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: terms,
          geo,
          timeRange: 'past12Months',
          category: '',
          isMultiple: terms.length > 1,
          maxItems: 100,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!runRes.ok) {
      console.warn(`[GoogleTrends] Apify returned ${runRes.status}`);
      return [];
    }

    const items = await runRes.json();
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn('[GoogleTrends] Apify error:', (err as Error).message);
    return [];
  }
}

/**
 * Analisa sazonalidade com dados reais do Google Trends.
 * Se Apify falhar, retorna resultado vazio (não inventa dados).
 */
export async function analyzeSeasonality(
  terms: string[],
  geo: string = 'BR',
): Promise<SeasonalityResult> {
  const topTerms = terms.slice(0, 3);
  const items = await fetchTrendsApify(topTerms, geo);

  if (items.length === 0) {
    return {
      terms: [],
      bestMonths: [],
      worstMonths: [],
      seasonalityStrength: 'low',
      summary: 'Dados de sazonalidade não disponíveis no momento.',
      source: 'unavailable',
    };
  }

  // Processa dados do Apify — formato varia por actor, normalizar
  const trendResults: TrendData[] = [];
  const monthlyAggregate: Record<string, number[]> = {};

  for (const item of items) {
    const term = item.searchTerm || item.keyword || topTerms[0] || '';
    const timeline = item.timelineData || item.interestOverTime || [];

    if (!Array.isArray(timeline) || timeline.length === 0) continue;

    const monthly: { month: string; interest: number }[] = [];

    for (const point of timeline) {
      const date = new Date(point.date || point.time || '');
      if (isNaN(date.getTime())) continue;
      const monthLabel = MONTHS_PT[date.getMonth()];
      const interest = point.value?.[0] ?? point.interest ?? point.value ?? 0;
      monthly.push({ month: monthLabel, interest });

      if (!monthlyAggregate[monthLabel]) monthlyAggregate[monthLabel] = [];
      monthlyAggregate[monthLabel].push(interest);
    }

    if (monthly.length === 0) continue;

    const sorted = [...monthly].sort((a, b) => b.interest - a.interest);
    const avg = Math.round(monthly.reduce((s, m) => s + m.interest, 0) / monthly.length);
    const lastThree = monthly.slice(-3);
    const firstThree = monthly.slice(0, 3);
    const isRising = lastThree.reduce((s, m) => s + m.interest, 0) / 3 >
      firstThree.reduce((s, m) => s + m.interest, 0) / 3;

    trendResults.push({
      term,
      monthlyTrend: monthly,
      peakMonth: sorted[0]?.month || 'Dez',
      lowMonth: sorted[sorted.length - 1]?.month || 'Jul',
      isRising,
      averageInterest: avg,
    });
  }

  // Agrega meses
  const monthScores = MONTHS_PT.map(month => ({
    month,
    score: monthlyAggregate[month]
      ? Math.round(monthlyAggregate[month].reduce((a, b) => a + b, 0) / monthlyAggregate[month].length)
      : 50,
  }));

  const sorted = [...monthScores].sort((a, b) => b.score - a.score);
  const bestMonths = sorted.slice(0, 3).map(m => m.month);
  const worstMonths = sorted.slice(-3).map(m => m.month);

  const maxScore = sorted[0]?.score || 50;
  const minScore = sorted[sorted.length - 1]?.score || 50;
  const diff = maxScore - minScore;
  const strength = diff > 40 ? 'high' : diff > 20 ? 'medium' : 'low';

  const summary = trendResults.length === 0
    ? 'Dados de sazonalidade não disponíveis.'
    : strength === 'low'
    ? `Demanda relativamente estável ao longo do ano para seus termos.`
    : `${bestMonths[0]} é o pico de demanda (${maxScore}% do interesse máximo). ${worstMonths[0]} é o vale (${minScore}%). Fonte: Google Trends.`;

  return {
    terms: trendResults,
    bestMonths,
    worstMonths,
    seasonalityStrength: strength,
    summary,
    source: 'google_trends_apify',
  };
}
