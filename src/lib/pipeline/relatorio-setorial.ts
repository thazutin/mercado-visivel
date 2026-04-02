// src/lib/pipeline/relatorio-setorial.ts
// Geração de relatório setorial via web search + síntese Claude.
// Usado no pós-pagamento (plan/generate) e no cron semanal.

import Anthropic from "@anthropic-ai/sdk";

export async function generateRelatorioSetorial(
  product: string,
  region: string,
  clientType: string,
  instagramData?: { handle?: string; recentPosts?: { caption: string; date?: string }[]; followers?: number; engagementRate?: number } | null,
): Promise<any> {
  const claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const shortRegion = region.split(',')[0].trim();
  const isNacional = /brasil|nacional/i.test(region);
  const geoContext = isNacional ? 'Brasil' : shortRegion;

  try {
    // Etapa 1: Web search para dados reais
    const searchResponse = await claudeClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
      messages: [{
        role: 'user',
        content: `Busque dados REAIS desta semana sobre "${product}" em ${geoContext}:
1. "${product} Brasil 2026" — tendências recentes
2. "mercado ${product} ${geoContext}" — dados atuais
3. Feriados ou eventos relevantes para ${product} nos próximos 7 dias
Foque em dados verificáveis com fonte.`,
      }],
    });

    const searchContext = searchResponse.content
      .map((b: any) => b.type === 'text' ? b.text : '')
      .filter(Boolean)
      .join('\n')
      .slice(0, 3000);

    // Contexto de Instagram (se disponível)
    const igContext = instagramData?.recentPosts?.length
      ? `\n\nÚLTIMOS POSTS DO INSTAGRAM (@${instagramData.handle || '?'}, ${instagramData.followers?.toLocaleString('pt-BR') || '?'} seguidores, engagement ${((instagramData.engagementRate || 0) * 100).toFixed(1)}%):\n${instagramData.recentPosts.slice(0, 5).map((p, i) => `${i + 1}. ${p.caption?.slice(0, 150) || '(sem legenda)'}${p.date ? ` (${p.date})` : ''}`).join('\n')}`
      : '';

    // Etapa 2: Síntese com Sonnet (qualidade importa) + dados de Instagram
    const synthesisResponse = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      system: 'Responda APENAS com JSON válido. Seja um analista de mercado senior.',
      messages: [{
        role: 'user',
        content: `Com base APENAS nos dados encontrados sobre "${product}" em ${geoContext}:

${searchContext}${igContext}

Retorne JSON:
{
  "titulo": "O mercado de ${product} em ${geoContext}",
  "destaque": "insight mais importante — 1 frase com dado real e fonte",
  "tendencias": [{"titulo":"...","descricao":"...","relevancia":"alta|media|baixa","acao_sugerida":"..."}],
  "oportunidade_da_semana": "ação específica baseada no que está acontecendo",
  "contexto_competitivo": "o que players do setor estão fazendo",
  "data_ref": "${new Date().toLocaleDateString('pt-BR')}",
  "fontes_resumo": "fontes consultadas",
  "confianca": "alta|media|baixa"
}

SE não encontrou dados reais para algum campo, use: "Sem dados verificados esta semana."
NÃO invente tendências ou percentuais sem fonte.`,
      }],
    });

    const synthesisText = synthesisResponse.content
      .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');

    let relatorio: any;
    try {
      const cleaned = synthesisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      relatorio = JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
    } catch {
      relatorio = {
        titulo: `Mercado de ${product} em ${geoContext}`,
        destaque: synthesisText.slice(0, 300),
        tendencias: [],
        oportunidade_da_semana: '',
        contexto_competitivo: '',
        data_ref: new Date().toLocaleDateString('pt-BR'),
        fontes_resumo: '',
        confianca: 'baixa',
      };
    }

    // Flag de dados limitados
    const semDados = relatorio.confianca === 'baixa' ||
      (relatorio.destaque || '').includes('Sem dados verificados');
    if (semDados) relatorio.dadosLimitados = true;

    console.log(`[RelatorioSetorial] "${relatorio.destaque?.slice(0, 60)}..." confianca=${relatorio.confianca || 'unknown'}`);

    // Etapa 3: Gerar briefings para distribuição
    try {
      const resBriefings = await claudeClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0.6,
        system: 'Responda APENAS com JSON válido. Você é um diretor de conteúdo que conhece o negócio profundamente.',
        messages: [{ role: 'user', content: `Contexto desta semana para "${product}" em ${geoContext}:

DESTAQUE: ${relatorio.destaque}
OPORTUNIDADE: ${relatorio.oportunidade_da_semana}
CONTEXTO COMPETITIVO: ${relatorio.contexto_competitivo || 'N/A'}
TENDÊNCIAS: ${(relatorio.tendencias || []).map((t: any) => t.titulo).join(', ') || 'N/A'}
${igContext || ''}

Gere 3 briefings DETALHADOS e ACIONÁVEIS:

1. briefing_equipe (200+ palavras, tom operacional):
   - O que mudou no mercado esta semana
   - 3-5 ações concretas com prazo (ex: "até quinta-feira")
   - Métricas para acompanhar
   - Por que cada ação importa agora

2. briefing_agencia (250+ palavras, tom estratégico):
   - Cenário competitivo atualizado
   - Oportunidade de posicionamento identificada
   - Direcionamento de conteúdo com formatos específicos
   - Referências de abordagem (sem mencionar marcas)
   - KPIs esperados

3. briefing_afiliado (200+ palavras, tom comercial):
   - Por que é bom momento para indicar este negócio
   - Argumentos de venda baseados em dados reais
   - Perfil do cliente ideal para indicação
   - Comissão/benefício para o afiliado

JSON: {"briefing_equipe":"...","briefing_agencia":"...","briefing_afiliado":"..."}` }],
      });
      const briefText = resBriefings.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
      const briefCleaned = briefText.slice(briefText.indexOf('{'), briefText.lastIndexOf('}') + 1);
      relatorio.briefings = JSON.parse(briefCleaned);
      console.log('[RelatorioSetorial] Briefings gerados');
    } catch (briefErr) {
      console.warn('[RelatorioSetorial] Briefings falhou (non-fatal):', (briefErr as Error).message);
      relatorio.briefings = null;
    }

    return relatorio;

  } catch (err) {
    console.error('[RelatorioSetorial] Falhou:', (err as Error).message);
    return {
      titulo: `Mercado de ${product} em ${geoContext}`,
      destaque: 'Relatório setorial em processamento.',
      tendencias: [],
      oportunidade_da_semana: '',
      contexto_competitivo: '',
      data_ref: new Date().toLocaleDateString('pt-BR'),
      fontes_resumo: '',
      dadosLimitados: true,
      briefings: null,
    };
  }
}
