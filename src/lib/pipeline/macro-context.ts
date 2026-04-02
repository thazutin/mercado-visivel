// src/lib/pipeline/macro-context.ts
// Geração de macro context via web search + síntese Claude.
// Substitui a inferência pura por dados reais do setor.

import Anthropic from "@anthropic-ai/sdk";

export interface MacroContext {
  summary: string;
  indicators: { name: string; value: string; trend: 'up' | 'down' | 'stable' }[];
  outlook: 'positive' | 'neutral' | 'negative';
  key_opportunity: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
}

const FALLBACK: MacroContext = {
  summary: 'Contexto não disponível.',
  indicators: [],
  outlook: 'neutral',
  key_opportunity: '',
  sources: [],
  confidence: 'low',
};

export async function generateMacroContext(
  product: string,
  region: string,
  clientType: string = 'b2c',
): Promise<MacroContext> {
  const claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const shortRegion = region.split(',')[0].trim();
  const isNacional = /brasil|nacional/i.test(region);
  const geoContext = isNacional ? 'Brasil' : shortRegion;

  try {
    // Etapa 1: Web search para dados reais do setor
    const searchResponse = await claudeClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
      messages: [{
        role: 'user',
        content: `Busque dados REAIS e RECENTES sobre o mercado de "${product}" em ${geoContext}:
1. Tendências do setor em 2025-2026
2. Nível de digitalização e presença online do segmento
3. Oportunidades identificadas por fontes de mercado
Foque em dados verificáveis com fonte.`,
      }],
    });

    const searchContext = searchResponse.content
      .map((b: any) => b.type === 'text' ? b.text : '')
      .filter(Boolean)
      .join('\n')
      .slice(0, 3000);

    // Se não encontrou nada relevante, retorna fallback
    if (!searchContext || searchContext.length < 50) {
      console.warn('[MacroContext] Web search returned insufficient data');
      return FALLBACK;
    }

    // Etapa 2: Síntese com exigência de dados reais
    const synthesisResponse = await claudeClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.2,
      system: 'Responda APENAS com JSON válido. Não invente dados.',
      messages: [{
        role: 'user',
        content: `Com base APENAS nos dados encontrados sobre "${product}" em ${geoContext}:

${searchContext}

Retorne JSON:
{
  "summary": "3-4 frases diretas sobre o cenário do mercado. Cite dados reais encontrados.",
  "indicators": [{"name":"indicador","value":"valor","trend":"up|down|stable"}],
  "outlook": "positive|neutral|negative",
  "key_opportunity": "1 oportunidade específica baseada nos dados reais encontrados",
  "sources": ["fonte1", "fonte2"],
  "confidence": "high|medium|low"
}

SE não encontrou dados reais para algum campo, use valores vazios.
NÃO invente tendências ou percentuais sem fonte.`,
      }],
    });

    const synthesisText = synthesisResponse.content
      .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');

    try {
      const cleaned = synthesisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      const parsed = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
      return {
        summary: parsed.summary || FALLBACK.summary,
        indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
        outlook: ['positive', 'neutral', 'negative'].includes(parsed.outlook) ? parsed.outlook : 'neutral',
        key_opportunity: parsed.key_opportunity || '',
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
      };
    } catch {
      return { ...FALLBACK, summary: synthesisText.slice(0, 500) };
    }
  } catch (err) {
    console.error('[MacroContext] Failed:', (err as Error).message);
    return FALLBACK;
  }
}
