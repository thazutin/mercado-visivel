// ============================================================================
// Step 5 — Gap Analysis (Claude-powered)
// Cruza dados reais com declarações do formulário pra detectar gaps
// ============================================================================

import type {
  FormInput,
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  Step5Output,
  GapAnalysis,
} from '../types/pipeline.types';

export const GAP_ANALYSIS_PROMPT_VERSION = 'gap-analysis-v1.2';

// --- PROMPT BUILDER ---

export function buildGapAnalysisPrompt(
  input: FormInput,
  terms: Step1Output,
  volumes: Step2Output,
  sizing: Step3Output,
  influence: Step4Output,
): string {
  // Compilar dados relevantes num formato legível pro Claude
  const topTermsByVolume = volumes.termVolumes
    .sort((a, b) => b.monthlyVolume - a.monthlyVolume)
    .slice(0, 10)
    .map(t => `  "${t.term}" — ${t.monthlyVolume} buscas/mês`)
    .join('\n');

  const zeroInfluenceTerms = influence.influence.rawGoogle.serpPositions
    .filter(sp => !sp.position || sp.position > 10)
    .map(sp => `  "${sp.term}" — negócio NÃO aparece nos resultados`)
    .join('\n');

  const instagramData = influence.influence.rawInstagram;
  const businessIg = instagramData.profile;
  
  let instagramSection = 'DADOS DE INSTAGRAM: Indisponíveis';
  if (businessIg.dataAvailable) {
    const competitorIgLines = instagramData.competitors
      .filter(c => c.dataAvailable)
      .map(c => `  @${c.handle}: ${c.followers} seguidores, ${c.avgViewsReelsLast30d} views/reel, ${c.avgLikesLast30d} likes/post`)
      .join('\n');

    instagramSection = `DADOS DE INSTAGRAM DO NEGÓCIO:
  @${businessIg.handle}: ${businessIg.followers} seguidores, ${businessIg.avgViewsReelsLast30d} views/reel, ${businessIg.avgLikesLast30d} likes/post
  Bio: "${businessIg.bio}"
  Temas dos últimos posts: ${businessIg.lastPostsCaptions.slice(0, 5).map(c => `"${c.slice(0, 80)}..."`).join(', ')}
  
DADOS DE INSTAGRAM DOS CONCORRENTES:
${competitorIgLines || '  Nenhum concorrente com dados disponíveis'}`;
  }

  return `Você é Vero, o agente de inteligência de mercado do Virô. Você analisa dados reais — não opina, não especula. Seu tom é preciso, fundamentado, sem floreio. Direto ao ponto que importa.

Analise os dados abaixo e detecte os 3-5 gaps mais relevantes entre a posição declarada pelo dono e a realidade que os dados mostram.

DECLARAÇÕES DO DONO:
  Produto/Serviço: ${input.product}
  ${input.customerDescription ? `Como o cliente descreve: ${input.customerDescription}` : ''}
  Diferencial declarado: "${input.differentiator}"
  Maior desafio: "${input.challenge}"
  Canais de aquisição: ${input.customerSources.join(', ')}
  Ticket médio: R$${input.ticket}
  ${input.freeText ? `Contexto adicional: "${input.freeText}"` : ''}

DADOS REAIS DE MERCADO:
  Volume total de busca: ${volumes.totalMonthlyVolume} buscas/mês
  Volume ponderado por intenção: ${volumes.weightedMonthlyVolume} buscas/mês
  Mercado potencial anual: R$${sizing.sizing.marketPotential.low.toLocaleString()} — R$${sizing.sizing.marketPotential.high.toLocaleString()}
  Influência digital total: ${influence.influence.totalInfluence}%

TERMOS DE MAIOR VOLUME:
${topTermsByVolume}

TERMOS ONDE O NEGÓCIO NÃO APARECE:
${zeroInfluenceTerms || '  Negócio aparece em todos os termos principais'}

INFLUÊNCIA POR CANAL:
  Google: ${influence.influence.google.score}% (peso ${(influence.influence.google.weight * 100).toFixed(0)}%)
  Instagram: ${influence.influence.instagram.available ? `${influence.influence.instagram.score}%` : 'indisponível'} (peso ${(influence.influence.instagram.weight * 100).toFixed(0)}%)
  Web: ${influence.influence.web.available ? `${influence.influence.web.score}%` : 'indisponível'} (peso ${(influence.influence.web.weight * 100).toFixed(0)}%)

${instagramSection}

TAREFA:
1. Identifique o PADRÃO PRINCIPAL que melhor descreve a situação deste negócio. Escolha UM entre:
   - "narrative_gap": Tem diferencial real mas não comunica (expertise real, narrativa genérica)
   - "demand_gap": Demanda existe mas o negócio não é encontrado (demanda existe, influência não)
   - "asset_gap": Tem ativos (reviews, história, localização) mas não ativa (ativos subutilizados)
   - "frequency_gap": Concorrência constrói presença consistente, negócio não acompanha
   - "positioning_gap": Posicionamento confuso — diz uma coisa, comunica outra, mercado entende outra

2. Identifique 3-5 GAPS específicos, cada um com:
   - Tipo (positioning, presence, content, reputation, frequency)
   - Severidade (critical, important, opportunity)
   - Título curto e direto (max 5 palavras)
   - Evidência: conecte uma declaração do dono com um dado real que contradiz ou expõe um gap
   - Data points: 2-3 dados específicos que sustentam o gap

3. Crie o HEADLINE INSIGHT — UMA frase que o dono vai lembrar. Deve ser factual, impactante, e baseada nos dados. Exemplos do tom certo:
   - "2.400 pessoas buscam o que você faz todo mês. Você aparece pra 168."
   - "Seu diferencial é invisível: nenhum dos seus últimos 20 posts menciona o que te faz diferente."
   - "Seu concorrente principal alcança 6x mais pessoas que você no Instagram."

4. Se dados de Instagram estiverem disponíveis, inclua ANÁLISE DE CONTEÚDO:
   - Temas que o negócio comunica
   - Temas que os concorrentes comunicam
   - Temas demandados (pelos termos de busca) mas não comunicados por ninguém
   - Alinhamento narrativo (0-100): quanto o conteúdo real reflete o diferencial declarado

REGRAS:
- NUNCA dê recomendações ou sugira ações. O Momento 1 MOSTRA, não aconselha. O "como resolver" é do diagnóstico pago.
- Cada gap deve ter evidência concreta — se não tem dado pra sustentar, não inclua.
- Use números reais, não genéricos. "7%" é melhor que "baixo". "2.400 buscas" é melhor que "volume alto".
- O tom é Vero: preciso, fundamentado, sem floreio. Sem adjetivos de marketing.

FORMATO DE RESPOSTA (JSON estrito, sem markdown):
{
  "primaryPattern": {
    "id": "demand_gap",
    "title": "Demanda existe, influência não",
    "description": "2-3 frases descrevendo o padrão detectado"
  },
  "headlineInsight": "A frase que o dono vai lembrar",
  "gaps": [
    {
      "type": "presence",
      "severity": "critical",
      "title": "Invisível na busca local",
      "evidence": "Declaração do dono vs dado real",
      "dataPoints": ["dado 1", "dado 2"]
    }
  ],
  "contentAnalysis": {
    "businessThemes": ["tema1", "tema2"],
    "competitorThemes": ["tema1", "tema2"],
    "marketGapThemes": ["tema1", "tema2"],
    "narrativeAlignment": 35
  }
}

Se dados de Instagram não estiverem disponíveis, omita o campo "contentAnalysis".
Gere APENAS o JSON. Sem texto antes ou depois.`;
}

// --- RESPONSE PARSER ---

export function parseGapAnalysisResponse(rawResponse: string): GapAnalysis {
  const cleaned = rawResponse
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse gap analysis response: ${e}`);
  }

  // Validate required fields
  if (!parsed.primaryPattern || !parsed.headlineInsight || !parsed.gaps) {
    throw new Error('Gap analysis response missing required fields');
  }

  return {
    primaryPattern: parsed.primaryPattern,
    headlineInsight: parsed.headlineInsight,
    gaps: parsed.gaps.map((g: any) => ({
      type: g.type,
      severity: g.severity,
      title: g.title,
      evidence: g.evidence,
      dataPoints: g.dataPoints || [],
    })),
    contentAnalysis: parsed.contentAnalysis || undefined,
  };
}

// --- STEP EXECUTOR ---

export async function executeStep5(
  input: FormInput,
  terms: Step1Output,
  volumes: Step2Output,
  sizing: Step3Output,
  influence: Step4Output,
  claudeClient: { createMessage: (params: any) => Promise<any> },
  options?: { model?: string }
): Promise<Step5Output> {
  const startTime = Date.now();
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';

  const prompt = buildGapAnalysisPrompt(input, terms, volumes, sizing, influence);

  const response = await claudeClient.createMessage({
    model,
    max_tokens: 4000,
    temperature: 0.2,  // Muito baixa — queremos precisão, não criatividade
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');

  const analysis = parseGapAnalysisResponse(text);

  return {
    analysis,
    promptVersion: GAP_ANALYSIS_PROMPT_VERSION,
    processingTimeMs: Date.now() - startTime,
  };
}
