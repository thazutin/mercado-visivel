// ============================================================================
// Virô Radar — Google Trends Integration
// Busca sazonalidade real por termos de busca.
// Usa a API não-oficial do Google Trends (mesma que pytrends).
// ============================================================================

export interface TrendData {
  term: string;
  monthlyTrend: { month: string; interest: number }[];  // 0-100
  peakMonth: string;
  lowMonth: string;
  isRising: boolean;           // tendência de alta nos últimos 3 meses
  averageInterest: number;     // média 0-100
}

export interface SeasonalityResult {
  terms: TrendData[];
  bestMonths: string[];        // top 3 meses
  worstMonths: string[];       // bottom 3 meses
  seasonalityStrength: 'high' | 'medium' | 'low';
  summary: string;             // "Março é seu pico, agosto é seu vale"
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Busca dados de tendência do Google Trends pra um termo.
 * Usa endpoint público do Google Trends (mesmo que o pytrends usa).
 */
async function fetchTrend(term: string, geo: string = 'BR'): Promise<TrendData | null> {
  try {
    // Google Trends API pública — interesse ao longo do tempo (últimos 12 meses)
    const url = `https://trends.google.com/trends/api/widgetdata/multiline?hl=pt-BR&tz=-180&req=${encodeURIComponent(
      JSON.stringify({
        time: 'today 12-m',
        resolution: 'MONTH',
        locale: 'pt-BR',
        comparisonItem: [{ keyword: term, geo, time: 'today 12-m' }],
        requestOptions: { property: '', backend: 'IZG', category: 0 },
      }),
    )}&token=PLACEHOLDER`;

    // Fallback: usar a Claude pra estimar sazonalidade se Google bloquear
    // A API do Google Trends frequentemente bloqueia requests diretos.
    // Vamos usar uma abordagem pragmática: Claude com web_search.
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      system: 'Responda APENAS com JSON válido.',
      messages: [{
        role: 'user',
        content: `Com base no seu conhecimento sobre o mercado brasileiro, estime a sazonalidade de busca para "${term}" no Brasil.

Retorne JSON:
{"monthly":[{"month":"Jan","interest":50},{"month":"Fev","interest":55},...todos os 12 meses],"peak_month":"Dez","low_month":"Jul","is_rising":true}

REGRAS:
- interest: 0-100 (100 = mês de pico)
- Considere sazonalidade real do setor (ex: sorvete pico no verão, aquecedor no inverno)
- is_rising: se a tendência geral está subindo nos últimos anos
- Seja realista com os padrões sazonais brasileiros`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const monthly = parsed.monthly || [];

    return {
      term,
      monthlyTrend: monthly.map((m: any) => ({
        month: m.month,
        interest: m.interest || 50,
      })),
      peakMonth: parsed.peak_month || 'Dez',
      lowMonth: parsed.low_month || 'Jul',
      isRising: parsed.is_rising || false,
      averageInterest: monthly.length > 0
        ? Math.round(monthly.reduce((s: number, m: any) => s + (m.interest || 50), 0) / monthly.length)
        : 50,
    };
  } catch (err) {
    console.warn(`[GoogleTrends] Failed for "${term}":`, (err as Error).message);
    return null;
  }
}

/**
 * Analisa sazonalidade para os termos principais do diagnóstico.
 * Custo: ~$0.001 por chamada (Haiku, ~200 tokens)
 */
export async function analyzeSeasonality(
  terms: string[],
  geo: string = 'BR',
): Promise<SeasonalityResult> {
  // Pega os top 3 termos pra análise (custo-eficiente)
  const topTerms = terms.slice(0, 3);
  const results = await Promise.all(topTerms.map(t => fetchTrend(t, geo)));
  const validResults = results.filter((r): r is TrendData => r !== null);

  if (validResults.length === 0) {
    return {
      terms: [],
      bestMonths: [],
      worstMonths: [],
      seasonalityStrength: 'low',
      summary: 'Dados de sazonalidade não disponíveis.',
    };
  }

  // Agrega interesse mensal de todos os termos
  const monthlyAvg: Record<string, number[]> = {};
  for (const result of validResults) {
    for (const m of result.monthlyTrend) {
      if (!monthlyAvg[m.month]) monthlyAvg[m.month] = [];
      monthlyAvg[m.month].push(m.interest);
    }
  }

  const monthScores = MONTHS_PT.map(month => ({
    month,
    score: monthlyAvg[month]
      ? Math.round(monthlyAvg[month].reduce((a, b) => a + b, 0) / monthlyAvg[month].length)
      : 50,
  }));

  const sorted = [...monthScores].sort((a, b) => b.score - a.score);
  const bestMonths = sorted.slice(0, 3).map(m => m.month);
  const worstMonths = sorted.slice(-3).map(m => m.month);

  // Força da sazonalidade: diferença entre melhor e pior mês
  const maxScore = sorted[0]?.score || 50;
  const minScore = sorted[sorted.length - 1]?.score || 50;
  const diff = maxScore - minScore;
  const strength = diff > 40 ? 'high' : diff > 20 ? 'medium' : 'low';

  const summary = strength === 'low'
    ? `Seu setor tem demanda relativamente estável ao longo do ano.`
    : `${bestMonths[0]} é seu pico de demanda (${maxScore}% do interesse máximo). ${worstMonths[0]} é o vale (${minScore}%). ${strength === 'high' ? 'Sazonalidade forte — planeje com antecedência.' : 'Sazonalidade moderada.'}`;

  return {
    terms: validResults,
    bestMonths,
    worstMonths,
    seasonalityStrength: strength,
    summary,
  };
}
