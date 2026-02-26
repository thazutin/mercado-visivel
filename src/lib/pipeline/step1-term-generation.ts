// ============================================================================
// Step 1 — Geração Inteligente de Termos de Busca
// Prompt versionado + lógica de execução
// ============================================================================

import type { FormInput, GeneratedTerm, Step1Output, TermIntent } from '../types/pipeline.types';

// --- PROMPT VERSION CONTROL ---

export const TERM_GEN_PROMPT_VERSION = 'term-gen-v1.3';

// --- INTENT WEIGHTS (modelo proprietário) ---

export const INTENT_WEIGHTS: Record<TermIntent, number> = {
  transactional: 1.0,
  navigational: 0.7,
  consideration: 0.35,
  informational: 0.1,
};

// --- PROMPT BUILDER ---

export function buildTermGenerationPrompt(input: FormInput): string {
  const competitorNames = input.competitors.map(c => c.name).join(', ');
  
  // Monta o contexto do negócio de forma estruturada
  const businessContext = [
    `NEGÓCIO: ${input.businessName || input.product}`,
    `PRODUTO/SERVIÇO: ${input.product}`,
    input.customerDescription 
      ? `COMO O CLIENTE DESCREVE: ${input.customerDescription}` 
      : null,
    `REGIÃO: ${input.region}`,
    input.address ? `ENDEREÇO: ${input.address}` : null,
    `DIFERENCIAL DECLARADO: ${input.differentiator}`,
    `CONCORRENTES: ${competitorNames || 'Não informados'}`,
    `TICKET MÉDIO: R$${input.ticket}`,
    `CANAIS DE AQUISIÇÃO: ${input.customerSources.join(', ')}`,
    input.challenge ? `MAIOR DESAFIO: ${input.challenge}` : null,
    input.freeText ? `CONTEXTO ADICIONAL: ${input.freeText}` : null,
  ].filter(Boolean).join('\n');

  return `Você é um especialista em marketing local e comportamento de busca do consumidor brasileiro. Sua tarefa é gerar os termos de busca que o mercado real usa quando procura o tipo de negócio descrito abaixo.

CONTEXTO DO NEGÓCIO:
${businessContext}

TAREFA:
Gere entre 20 e 30 termos de busca que pessoas reais usariam no Google quando estão em diferentes estágios de decisão de compra para este tipo de negócio nesta região.

REGRAS IMPORTANTES:
1. Use linguagem natural — como uma pessoa digitaria no Google, não como um profissional de marketing escreveria
2. Inclua variações com a cidade, bairro e "perto de mim" onde fizer sentido
3. Considere a tensão entre como o DONO descreve o negócio e como o CLIENTE busca
4. Se o dono diz "clínica de estética avançada", o cliente busca "botox preço [cidade]"
5. NÃO gere termos que ninguém buscaria — cada termo deve ter chance real de volume
6. OBRIGATÓRIO: inclua 3-5 termos HEAD (amplos, alto volume genérico). Estes são os termos mais buscados e devem vir PRIMEIRO na lista:
   a) Gere termos a partir do PRODUTO/SERVIÇO: se o negócio é "implantes dentários em Mauá", inclua "dentista mauá", "clínica odontológica mauá", "dentista perto de mim"
   b) Gere termos a partir de COMO O CLIENTE DESCREVE: se o cliente descreve como "dentista de implante", inclua "dentista de implante mauá", "dentista implante perto de mim"
   c) A categoria genérica do negócio + região é SEMPRE um head term (ex: "dentista [cidade]", "barbearia [cidade]", "padaria [bairro]")
   d) Termos head devem ter intent "transactional" e category "core"

CATEGORIAS OBRIGATÓRIAS:

## TRANSACIONAIS (peso 1.0) — 8 a 12 termos
Pessoa pronta para comprar, contratar ou agendar. Alta intenção comercial.
Padrões: "[serviço] [cidade]", "[serviço] perto de mim", "agendar [serviço]", "[serviço] preço", "melhor [serviço] [bairro]"

## NAVEGACIONAIS (peso 0.7) — 4 a 6 termos
Pessoa comparando opções ou buscando negócios específicos da categoria.
Padrões: "melhor [categoria] [cidade]", "[categoria] recomendado [região]", "[concorrente] avaliação", "alternativa a [concorrente]"

## CONSIDERAÇÃO (peso 0.35) — 4 a 6 termos
Pessoa pesquisando antes de decidir. Está no caminho da compra mas ainda não escolheu.
Padrões: "quanto custa [serviço]", "[serviço] vale a pena", "como escolher [categoria]", "[serviço] antes e depois"

## INFORMACIONAIS (peso 0.1) — 2 a 3 termos
Pessoa aprendendo, longe da compra. Volume alto mas conversão baixa.
Padrões: "o que é [procedimento]", "benefícios de [serviço]"

## TENSÃO (categoria especial) — 3 a 5 termos
Termos que revelam insatisfação do mercado. Volume geralmente baixo mas valor diagnóstico altíssimo.
Padrões: "reclamação [concorrente]", "[serviço] ruim [cidade]", "cancelar [serviço]", "[concorrente] não recomendo"

FORMATO DE RESPOSTA (JSON estrito, sem markdown):
{
  "terms": [
    {
      "term": "botox preço campinas",
      "intent": "transactional",
      "category": "core",
      "rationale": "Termo direto de alta intenção combinando serviço principal + preço + cidade"
    }
  ]
}

Categorias possíveis para "category": "core" (termo fundamental do negócio), "branded" (envolve nome de concorrente), "comparative" (comparação), "tension" (insatisfação/problema).

Gere APENAS o JSON. Sem texto antes ou depois.`;
}

// --- RESPONSE PARSER ---

export function parseTermGenerationResponse(rawResponse: string): GeneratedTerm[] {
  // Strip markdown fences if present
  const cleaned = rawResponse
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: { terms: Array<{
    term: string;
    intent: TermIntent;
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

  // Enrich with intent weights
  return parsed.terms.map(t => ({
    term: t.term.toLowerCase().trim(),
    intent: t.intent,
    intentWeight: INTENT_WEIGHTS[t.intent] ?? 0.1,
    category: t.category,
    rationale: t.rationale,
  }));
}

// --- VALIDATION ---

export function validateTerms(terms: GeneratedTerm[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (terms.length < 15) issues.push(`Poucos termos gerados: ${terms.length} (mínimo 15)`);
  if (terms.length > 35) issues.push(`Muitos termos gerados: ${terms.length} (máximo 35)`);

  const transactional = terms.filter(t => t.intent === 'transactional');
  const navigational = terms.filter(t => t.intent === 'navigational');
  const tension = terms.filter(t => t.category === 'tension');

  if (transactional.length < 6) issues.push(`Poucos termos transacionais: ${transactional.length} (mínimo 6)`);
  if (navigational.length < 3) issues.push(`Poucos termos navegacionais: ${navigational.length} (mínimo 3)`);
  if (tension.length < 2) issues.push(`Poucos termos de tensão: ${tension.length} (mínimo 2)`);

  // Check for duplicates
  const unique = new Set(terms.map(t => t.term));
  if (unique.size !== terms.length) issues.push(`Termos duplicados detectados`);

  // Check for empty terms
  if (terms.some(t => !t.term || t.term.length < 3)) issues.push(`Termos vazios ou muito curtos`);

  return { valid: issues.length === 0, issues };
}

// --- STEP EXECUTOR ---

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
        model,
        max_tokens: 4000,
        temperature: 0.3,  // Baixa pra consistência nos termos
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      terms = parseTermGenerationResponse(text);
      const validation = validateTerms(terms);

      if (validation.valid) break;
      
      // Se não passou validação, tenta de novo com temperatura um pouco maior
      console.warn(`[Step1] Attempt ${attempts + 1} validation issues:`, validation.issues);
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
