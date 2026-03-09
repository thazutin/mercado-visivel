// ============================================================================
// Step 1 — Term Generation (simplified input compatible)
// ============================================================================

import type { FormInput, GeneratedTerm, Step1Output, TermIntent } from '../types/pipeline.types';

export const TERM_GEN_PROMPT_VERSION = 'term-gen-v2.0-simplified';

export const INTENT_WEIGHTS: Record<TermIntent, number> = {
  transactional: 1.0,
  navigational: 0.7,
  consideration: 0.35,
  informational: 0.1,
};

export function buildTermGenerationPrompt(input: FormInput): string {
  // Build context from whatever is available
  const context = [
    `NEGÓCIO: ${input.product}`,
    input.differentiator ? `DIFERENCIAL: ${input.differentiator}` : null,
    `REGIÃO: ${input.region}`,
    input.address ? `ENDEREÇO: ${input.address}` : null,
    input.customerDescription ? `COMO O CLIENTE DESCREVE: ${input.customerDescription}` : null,
    input.ticket ? `TICKET MÉDIO: R$${input.ticket}` : null,
  ].filter(Boolean).join('\n');

  return `Você é um especialista em marketing local e comportamento de busca do consumidor brasileiro.

CONTEXTO:
${context}

TAREFA:
Gere 25-30 termos de busca que pessoas reais usariam no Google quando procuram este tipo de negócio nesta região.

REGRAS:
1. Linguagem natural — como uma pessoa digitaria no Google
2. Inclua variações com cidade, bairro e "perto de mim"
3. HEAD TERMS obrigatórios: a categoria genérica + região (ex: "dentista mauá") deve vir primeiro
4. Considere a tensão: o dono diz "clínica de estética avançada", o cliente busca "botox preço campinas"

DISTRIBUIÇÃO:
- TRANSACIONAIS (8-12): prontos para comprar. "[serviço] [cidade]", "agendar [serviço]", "preço [serviço]"
- NAVEGACIONAIS (4-6): comparando. "melhor [categoria] [cidade]", "[categoria] recomendado"
- CONSIDERAÇÃO (4-6): pesquisando. "quanto custa [serviço]", "[serviço] vale a pena"
- INFORMACIONAIS (2-3): aprendendo. "o que é [procedimento]"
- TENSÃO (2-3): insatisfação. "[serviço] ruim [cidade]", "reclamação [categoria]"

FORMATO (JSON, sem markdown):
{
  "terms": [
    { "term": "botox preço campinas", "intent": "transactional", "category": "core", "rationale": "Alta intenção + preço + cidade" }
  ]
}

Categories: "core", "branded", "comparative", "tension"
Gere APENAS o JSON.`;
}

export function parseTermGenerationResponse(rawResponse: string): GeneratedTerm[] {
  const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: { terms: Array<{
    term: string; intent: TermIntent;
    category: 'core' | 'branded' | 'comparative' | 'tension';
    rationale: string;
  }> };

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse term generation response: ${e}`);
  }

  if (!parsed.terms || !Array.isArray(parsed.terms)) {
    throw new Error('Response missing "terms" array');
  }

  return parsed.terms.map(t => ({
    term: t.term.toLowerCase().trim(),
    intent: t.intent,
    intentWeight: INTENT_WEIGHTS[t.intent] ?? 0.1,
    category: t.category,
    rationale: t.rationale,
  }));
}

export function validateTerms(terms: GeneratedTerm[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (terms.length < 15) issues.push(`Poucos termos: ${terms.length}`);
  if (terms.length > 35) issues.push(`Muitos termos: ${terms.length}`);
  const transactional = terms.filter(t => t.intent === 'transactional');
  if (transactional.length < 5) issues.push(`Poucos transacionais: ${transactional.length}`);
  const unique = new Set(terms.map(t => t.term));
  if (unique.size !== terms.length) issues.push(`Duplicados detectados`);
  return { valid: issues.length === 0, issues };
}

export async function executeStep1(
  input: FormInput,
  claudeClient: { createMessage: (params: any) => Promise<any> },
  options?: { model?: string; maxRetries?: number }
): Promise<Step1Output> {
  const startTime = Date.now();
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';
  const maxRetries = options?.maxRetries ?? 2;

  const prompt = buildTermGenerationPrompt(input);
  let terms: GeneratedTerm[] = [];
  let attempts = 0;

  while (attempts <= maxRetries) {
    try {
      const response = await claudeClient.createMessage({
        model, max_tokens: 4000, temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      terms = parseTermGenerationResponse(text);
      const validation = validateTerms(terms);
      if (validation.valid) break;

      console.warn(`[Step1] Attempt ${attempts + 1} issues:`, validation.issues);
      attempts++;
    } catch (err) {
      console.error(`[Step1] Attempt ${attempts + 1} failed:`, err);
      attempts++;
      if (attempts > maxRetries) throw err;
    }
  }

  return {
    terms,
    termCount: terms.length,
    generationModel: model,
    promptVersion: TERM_GEN_PROMPT_VERSION,
    processingTimeMs: Date.now() - startTime,
  };
}
