// src/lib/pipeline/relatorio-setorial.ts
// Geração de relatório setorial via web search + síntese Claude.
// Usado no pós-pagamento (plan/generate) e no cron semanal.

import Anthropic from "@anthropic-ai/sdk";

export async function generateRelatorioSetorial(
  product: string,
  region: string,
  clientType: string,
): Promise<any> {
  const claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const shortRegion = region.split(',')[0].trim();
  const isNacional = /brasil|nacional/i.test(region);
  const geoContext = isNacional ? 'Brasil' : shortRegion;

  try {
    // Etapa 1: Web search para tendências reais do setor
    const searchResponse = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
      messages: [{
        role: 'user',
        content: `Busque informações relevantes sobre o mercado de "${product}" em ${geoContext} nos últimos 3 meses. Inclua: tendências de consumo, movimentos dos principais players, sazonalidade atual, dados econômicos relevantes para o setor. Foque em informações práticas e acionáveis para um pequeno negócio local.`,
      }],
    });

    const searchContext = searchResponse.content
      .map((b: any) => b.type === 'text' ? b.text : '')
      .filter(Boolean)
      .join('\n')
      .slice(0, 3000);

    // Etapa 2: Síntese em formato estruturado
    const synthesisResponse = await claudeClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `Com base nos dados do mercado de "${product}" em ${geoContext}:

DADOS COLETADOS:
${searchContext}

Gere um relatório setorial para o dono deste negócio. Linguagem simples, direta, sem jargão.

Responda APENAS em JSON:
{
  "titulo": "O mercado de [setor] em [região] — semana de [data atual]",
  "destaque": "1 frase com o insight mais relevante desta semana para este negócio",
  "tendencias": [
    {
      "titulo": "Tendência curta",
      "descricao": "O que está acontecendo e o que significa para o negócio (2-3 frases)",
      "relevancia": "alta|media|baixa",
      "acao_sugerida": "O que fazer agora (1 frase concreta)"
    }
  ],
  "oportunidade_da_semana": "Uma oportunidade específica baseada no contexto atual — o que fazer esta semana para aproveitar",
  "contexto_competitivo": "O que os líderes do setor estão fazendo que é relevante observar (2-3 frases)",
  "data_ref": "semana de [data atual]",
  "fontes_resumo": "breve descrição das fontes consultadas"
}`,
      }],
    });

    const synthesisText = synthesisResponse.content
      .filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const relatorio = JSON.parse(synthesisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    console.log(`[RelatorioSetorial] "${relatorio.destaque?.slice(0, 60)}..."`);
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
    };
  }
}
