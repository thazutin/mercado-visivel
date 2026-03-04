// ============================================================================
// AI Visibility Check
// Uses Claude to assess whether a business would appear in AI search responses
// (ChatGPT, Perplexity, Gemini, etc.)
// Cost: ~0.01 USD per call (Haiku) — no external API needed
// ============================================================================

export interface AIVisibilityResult {
  score: number;                      // 0-100
  summary: string;                    // "Seu negócio provavelmente não aparece em respostas de AI para buscas locais"
  likelyMentioned: boolean;           // Would AI tools mention this business?
  factors: {
    factor: string;                   // "Presença web", "Reviews", "Autoridade"
    status: 'positive' | 'negative' | 'neutral';
    detail: string;
  }[];
  competitorMentions: {
    name: string;
    likelyMentioned: boolean;
    reason: string;
  }[];
  processingTimeMs: number;
}

export const AI_VISIBILITY_PROMPT_VERSION = 'ai-visibility-v1.0';

export function buildAIVisibilityPrompt(
  product: string,
  region: string,
  businessName: string,
  differentiator: string,
  hasWebsite: boolean,
  hasMapsProfile: boolean,
  mapsRating: number | null,
  mapsReviews: number | null,
  serpPositions: number,          // how many terms ranked in top 10
  serpTotal: number,              // how many terms scraped
  competitors: { name: string; instagram?: string }[],
): string {
  return `Você é um especialista em visibilidade digital. Analise se o negócio abaixo provavelmente apareceria em respostas de ferramentas de AI (ChatGPT, Perplexity, Gemini, Claude) quando um usuário pergunta sobre "${product}" em "${region}".

NEGÓCIO:
  Nome/Produto: ${businessName || product}
  Diferencial: "${differentiator}"
  Tem website: ${hasWebsite ? 'Sim' : 'Não'}
  Google Maps: ${hasMapsProfile ? `Sim, rating ${mapsRating || 'N/A'}, ${mapsReviews || 0} avaliações` : 'Não encontrado'}
  Aparece no Google: ${serpPositions} de ${serpTotal} termos no top 10

CONCORRENTES DECLARADOS:
${competitors.map(c => `  - ${c.name}${c.instagram ? ` (@${c.instagram})` : ''}`).join('\n') || '  Nenhum informado'}

CONTEXTO: Ferramentas de AI como ChatGPT, Perplexity e Gemini usam dados da web (sites, reviews, menções, autoridade de domínio) para gerar respostas. Negócios com forte presença web, muitas avaliações positivas e menções em diretórios/artigos têm mais chance de serem citados. Negócios sem website, sem reviews e sem presença digital dificilmente aparecem.

TAREFA: Avalie a probabilidade deste negócio aparecer em respostas de AI e responda em JSON:

{
  "score": 0-100,
  "summary": "Uma frase descrevendo a situação",
  "likelyMentioned": true/false,
  "factors": [
    { "factor": "Nome do fator", "status": "positive/negative/neutral", "detail": "Explicação" }
  ],
  "competitorMentions": [
    { "name": "Concorrente", "likelyMentioned": true/false, "reason": "Por quê" }
  ]
}

REGRAS:
- Seja realista. Maioria dos negócios locais pequenos NÃO aparece em AI.
- Score 0-20: Muito improvável. 20-50: Possível mas raro. 50-80: Provável. 80-100: Quase certo.
- Negócio sem website = score máximo 30.
- Negócio sem reviews = penalize -20 pontos.
- Fatores importantes: website com conteúdo, reviews Google, menções em diretórios, autoridade de domínio, presença em redes sociais com conteúdo relevante.
- Gere APENAS o JSON, sem texto adicional.`;
}

export function parseAIVisibilityResponse(rawResponse: string): Omit<AIVisibilityResult, 'processingTimeMs'> {
  const cleaned = rawResponse
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    score: Math.min(100, Math.max(0, parsed.score || 0)),
    summary: parsed.summary || '',
    likelyMentioned: parsed.likelyMentioned || false,
    factors: (parsed.factors || []).map((f: any) => ({
      factor: f.factor || '',
      status: f.status || 'neutral',
      detail: f.detail || '',
    })),
    competitorMentions: (parsed.competitorMentions || []).map((c: any) => ({
      name: c.name || '',
      likelyMentioned: c.likelyMentioned || false,
      reason: c.reason || '',
    })),
  };
}

export async function executeAIVisibilityCheck(
  product: string,
  region: string,
  businessName: string,
  differentiator: string,
  hasWebsite: boolean,
  hasMapsProfile: boolean,
  mapsRating: number | null,
  mapsReviews: number | null,
  serpPositions: number,
  serpTotal: number,
  competitors: { name: string; instagram?: string }[],
  claudeClient: { createMessage: (params: any) => Promise<any> },
): Promise<AIVisibilityResult> {
  const startTime = Date.now();

  const prompt = buildAIVisibilityPrompt(
    product, region, businessName, differentiator,
    hasWebsite, hasMapsProfile, mapsRating, mapsReviews,
    serpPositions, serpTotal, competitors,
  );

  const response = await claudeClient.createMessage({
    model: 'claude-haiku-4-5-20251001',  // Fast + cheap for this task
    max_tokens: 2000,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');

  const result = parseAIVisibilityResponse(text);

  return {
    ...result,
    processingTimeMs: Date.now() - startTime,
  };
}
