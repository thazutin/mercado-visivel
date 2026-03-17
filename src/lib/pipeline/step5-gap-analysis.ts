// ============================================================================
// Step 5 — Gap Analysis + Rotas de Trabalho (Claude-powered)
// Cruza dados reais com declarações do formulário pra detectar gaps
// E gera rotas de trabalho priorizadas baseadas no desafio declarado
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

export const GAP_ANALYSIS_PROMPT_VERSION = 'gap-analysis-v2.0-routes';

// --- PROMPT BUILDER ---

export function buildGapAnalysisPrompt(
  input: FormInput,
  terms: Step1Output,
  volumes: Step2Output,
  sizing: Step3Output,
  influence: Step4Output,
  aiVisibility?: { score: number; summary: string; likelyMentioned: boolean } | null,
  competitionIndex?: { label: string; indexValue: number; activeCompetitors: number; totalCompetitors: number } | null,
  pncp?: { totalEncontradas: number; valorTotalEstimado: number; modalidades: { modalidade: string; count: number }[]; orgaosUnicos: number } | null,
): string {
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

  const aiVisibilitySection = aiVisibility
    ? `VISIBILIDADE EM AI (ChatGPT, Perplexity, etc.):
  Score: ${aiVisibility.score}/100
  Resumo: ${aiVisibility.summary}
  Provavelmente mencionado: ${aiVisibility.likelyMentioned ? 'Sim' : 'Não'}`
    : 'VISIBILIDADE EM AI: Não avaliada';

  const competitionSection = competitionIndex
    ? `ÍNDICE DE SATURAÇÃO:
  Concorrentes no Maps: ${competitionIndex.totalCompetitors}
  Concorrentes ativos (com site ou Instagram): ${competitionIndex.activeCompetitors}
  Classificação: ${competitionIndex.label} (${competitionIndex.indexValue} buscas por concorrente ativo)`
    : '';

  const isB2B = input.clientType === 'b2b';
  const isB2G = input.clientType === 'b2g';

  return `Você é Vero, o agente de inteligência de mercado do Virô. Você analisa dados reais — não opina, não especula. Seu tom é preciso, fundamentado, sem floreio. Direto ao ponto que importa.

Analise os dados abaixo e:
1. Detecte os gaps mais relevantes entre a posição declarada e a realidade
2. Gere ROTAS DE TRABALHO PRIORIZADAS que conectam o desafio declarado com os dados reais

DECLARAÇÕES DO DONO:
  Produto/Serviço: ${input.product}
  ${input.customerDescription ? `Como o cliente descreve: ${input.customerDescription}` : ''}
  Diferencial declarado: "${input.differentiator}"
  Maior desafio: "${input.challenge}"
  Canais de aquisição: ${input.customerSources.join(', ')}
  ${input.ticket > 0 ? `Ticket médio: R$${input.ticket}` : ''}
  ${input.freeText ? `Contexto adicional: "${input.freeText}"` : ''}

DADOS REAIS DE MERCADO:
  Volume total de busca: ${volumes.totalMonthlyVolume} buscas/mês
  Volume ponderado por intenção: ${volumes.weightedMonthlyVolume} buscas/mês
  Mercado potencial mensal: R$${sizing.sizing.marketPotential.low.toLocaleString()} — R$${sizing.sizing.marketPotential.high.toLocaleString()}
  Influência digital total: ${influence.influence.totalInfluence}%

TERMOS DE MAIOR VOLUME:
${topTermsByVolume}

TERMOS ONDE O NEGÓCIO NÃO APARECE:
${zeroInfluenceTerms || '  Negócio aparece em todos os termos principais'}

INFLUÊNCIA POR CANAL:
  Google: ${influence.influence.google.score}%
  Instagram: ${influence.influence.instagram.available ? `${influence.influence.instagram.score}%` : 'indisponível'}
  Web: ${influence.influence.web.available ? `${influence.influence.web.score}%` : 'indisponível'}

${instagramSection}

${aiVisibilitySection}

${competitionSection}

TAREFA:

PARTE A — GAPS (mesmo formato anterior)
1. Identifique o PADRÃO PRINCIPAL (narrative_gap, demand_gap, asset_gap, frequency_gap, positioning_gap)
2. Identifique 3-5 GAPS específicos com tipo, severidade, título, evidência, data points
3. Crie o HEADLINE INSIGHT — UMA frase factual e impactante que o dono vai lembrar

PARTE B — ROTAS DE TRABALHO PRIORIZADAS (NOVO)
Dado que o principal desafio declarado é "${input.challenge}", e os dados mostram o cenário acima, gere 3 ROTAS DE TRABALHO priorizadas por impacto.

Cada rota deve:
- Ter um título claro e orientado a ação (ex: "Aparecer no Google Maps primeiro")
- Conectar EXPLICITAMENTE um dado real com uma ação concreta
- Explicar POR QUE é prioridade (baseado no dado, não em opinião)
- Indicar o horizonte de impacto: "curto prazo" (1-4 semanas), "médio prazo" (1-3 meses), "longo prazo" (3-6 meses)
- Ser específica para ESTE negócio, não genérica

IMPORTANTE para as rotas:
- Rota 1 deve ser a de MAIOR IMPACTO com MENOR ESFORÇO (quick win)
- Rota 2 deve ser a de MAIOR IMPACTO no desafio declarado
- Rota 3 deve ser a que CONSTRÓI VANTAGEM COMPETITIVA a longo prazo
- Cada rota deve citar pelo menos 1 dado específico (número) como fundamento
- O tom é: "dado o que vemos nos dados, o caminho mais eficiente é..."

4. Se dados de Instagram estiverem disponíveis, inclua ANÁLISE DE CONTEÚDO

REGRAS:
- Cada gap e rota deve ter evidência concreta — se não tem dado pra sustentar, não inclua
- Use números reais, não genéricos. "7%" é melhor que "baixo". "2.400 buscas" é melhor que "volume alto"
- O tom é Vero: preciso, fundamentado, sem floreio. Sem adjetivos de marketing
- As rotas podem ser específicas e acionáveis — diferente dos gaps, aqui queremos MOSTRAR o caminho
- NUNCA mencione pesos percentuais internos da metodologia. Não revele como os scores são ponderados.
  ERRADO: "Google representa 49% da influência digital"
  ERRADO: "Instagram vale 20% do score"
  ERRADO: "O Google tem peso de 60% no cálculo"
  CERTO: "Você não aparece no Google, que é onde a maioria dos clientes começa a busca"
  CERTO: "Seu Instagram tem engajamento baixo comparado aos concorrentes da região"
- Revise o português antes de retornar. Nunca use palavras cortadas, incompletas ou inventadas. Todas as frases devem estar gramaticalmente corretas em português brasileiro
- Escreva todas as frases por extenso — sem abreviações obscuras ou palavras truncadas
- Use o índice de saturação para contextualizar as rotas: se subatendido, enfatize captura de demanda existente; se saturado, enfatize diferenciação e nicho. NUNCA mencione o valor numérico do índice nem os pesos percentuais internos no texto gerado
${isB2G ? `- CONTEXTO B2G: Este negócio vende para GOVERNO / setor público. As rotas devem focar em: cadastro em portais de compras (ComprasNet, BEC, licitações estaduais), registro no SICAF, visibilidade em buscas de licitação, site com documentação técnica/certidões, presença em associações setoriais, e credibilidade institucional.${pncp ? ` Dados PNCP: ${pncp.totalEncontradas} contratações recentes no segmento (R$${(pncp.valorTotalEstimado / 1000).toFixed(0)}k total, ${pncp.orgaosUnicos} órgãos). Modalidades mais comuns: ${pncp.modalidades.slice(0, 3).map(m => m.modalidade).join(', ')}.` : ''}` : ''}
${isB2B ? `- CONTEXTO B2B: Este negócio vende para OUTRAS EMPRESAS, não consumidores finais. As rotas devem focar em: autoridade setorial, cases de empresas atendidas, presença em diretórios profissionais (OAB, CRC, CRM etc.), LinkedIn como canal primário, e indicação estruturada. Evite recomendar conteúdo de bastidores pessoal ou estratégias voltadas a consumidor final.` : ''}

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
  "workRoutes": [
    {
      "priority": 1,
      "title": "Título orientado a ação",
      "rationale": "Por que esta é a prioridade #1, com dados",
      "connection": "Desafio declarado: X → Dado real: Y → Por isso: Z",
      "horizon": "curto prazo",
      "expectedImpact": "O que muda se executar esta rota"
    }
  ],
  "contentAnalysis": {
    "businessThemes": ["tema1"],
    "competitorThemes": ["tema1"],
    "marketGapThemes": ["tema1"],
    "narrativeAlignment": 35
  }
}

Se dados de Instagram não estiverem disponíveis, omita o campo "contentAnalysis".
Gere APENAS o JSON. Sem texto antes ou depois.`;
}

// --- RESPONSE PARSER ---

export function parseGapAnalysisResponse(rawResponse: string): GapAnalysis & { workRoutes?: any[] } {
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
    workRoutes: (parsed.workRoutes || []).map((r: any) => ({
      priority: r.priority,
      title: r.title,
      rationale: r.rationale,
      connection: r.connection,
      horizon: r.horizon,
      expectedImpact: r.expectedImpact,
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
  options?: {
    model?: string;
    aiVisibility?: { score: number; summary: string; likelyMentioned: boolean } | null;
    competitionIndex?: { label: string; indexValue: number; activeCompetitors: number; totalCompetitors: number } | null;
    pncp?: { totalEncontradas: number; valorTotalEstimado: number; modalidades: { modalidade: string; count: number }[]; orgaosUnicos: number } | null;
  }
): Promise<Step5Output> {
  const startTime = Date.now();
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';

  const prompt = buildGapAnalysisPrompt(
    input, terms, volumes, sizing, influence,
    options?.aiVisibility,
    options?.competitionIndex,
    options?.pncp,
  );

  const response = await claudeClient.createMessage({
    model,
    max_tokens: 4000,
    temperature: 0.2,
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
