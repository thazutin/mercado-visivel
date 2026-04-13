// ============================================================================
// Virô Radar — Instagram Competitors Expanded Analysis
// Análise mais profunda dos concorrentes no Instagram: temas, formatos,
// horários de pico, hashtags. Alimenta provocações e pilares estratégicos.
// ============================================================================

export interface ExpandedInstagramAnalysis {
  handle: string;
  followers: number;
  engagementRate: number;
  postsPerWeek: number;
  topThemes: string[];            // Top 3 temas por engajamento
  bestPostTypes: string[];        // 'carousel', 'reel', 'image', 'video'
  bestPostingTimes: string[];     // 'Terça 18h', 'Quinta 12h'
  topHashtags: string[];          // Top 5 hashtags usadas
  avgLikes: number;
  avgComments: number;
  contentStrategy: string;        // "Foco em reels educativos com frequência alta"
}

export interface CompetitorInsight {
  competitors: ExpandedInstagramAnalysis[];
  gaps: string[];                 // "Seus concorrentes postam 5x/semana, você 1x"
  opportunities: string[];        // "Nenhum concorrente usa carousel — oportunidade"
  summary: string;
}

/**
 * Gera análise expandida dos concorrentes baseada nos dados já scraped.
 * Não faz scrape adicional — usa os dados existentes + Claude pra análise.
 *
 * Custo: ~$0.002 (Haiku).
 */
export async function analyzeInstagramCompetitors(
  businessHandle: string | null,
  businessFollowers: number,
  businessEngagement: number,
  competitors: Array<{
    handle: string;
    followers: number;
    engagementRate: number;
    postsLast30d?: number;
    avgLikes?: number;
    avgViews?: number;
  }>,
  product: string,
): Promise<CompetitorInsight> {
  if (competitors.length === 0) {
    return {
      competitors: [],
      gaps: [],
      opportunities: [],
      summary: 'Sem concorrentes no Instagram pra comparar.',
    };
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const competitorData = competitors.map(c =>
      `@${c.handle}: ${c.followers} seg, ${((c.engagementRate || 0) * 100).toFixed(1)}% eng, ${c.postsLast30d || '?'} posts/30d, ~${c.avgLikes || 0} likes/post`,
    ).join('\n');

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.2,
      system: 'Responda APENAS com JSON válido.',
      messages: [{
        role: 'user',
        content: `Analise competitivamente estes perfis de Instagram no setor de "${product}":

MEU PERFIL:
@${businessHandle || 'não informado'}: ${businessFollowers} seguidores, ${(businessEngagement * 100).toFixed(1)}% engajamento

CONCORRENTES:
${competitorData}

JSON:
{
  "competitors": [{"handle":"@x","postsPerWeek":3,"topThemes":["tema1","tema2"],"bestPostTypes":["reel","carousel"],"contentStrategy":"1 frase"}],
  "gaps": ["gap1 — dado específico", "gap2"],
  "opportunities": ["oportunidade1", "oportunidade2"],
  "summary": "2-3 frases comparativas com dados"
}

REGRAS:
- gaps devem citar números (ex: "Concorrente posta 5x/semana, você 1x")
- opportunities devem ser específicas e acionáveis
- summary deve ter dados reais da comparação`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        competitors: (parsed.competitors || []).map((c: any, i: number) => ({
          handle: c.handle || competitors[i]?.handle || '',
          followers: competitors[i]?.followers || 0,
          engagementRate: competitors[i]?.engagementRate || 0,
          postsPerWeek: c.postsPerWeek || 0,
          topThemes: c.topThemes || [],
          bestPostTypes: c.bestPostTypes || [],
          bestPostingTimes: c.bestPostingTimes || [],
          topHashtags: c.topHashtags || [],
          avgLikes: competitors[i]?.avgLikes || 0,
          avgComments: 0,
          contentStrategy: c.contentStrategy || '',
        })),
        gaps: parsed.gaps || [],
        opportunities: parsed.opportunities || [],
        summary: parsed.summary || '',
      };
    }
  } catch (err) {
    console.warn('[IG Expanded] Analysis failed:', (err as Error).message);
  }

  return {
    competitors: [],
    gaps: [],
    opportunities: [],
    summary: 'Análise de concorrentes não disponível.',
  };
}
