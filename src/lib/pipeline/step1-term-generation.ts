// ============================================================================
// Step 1 — Term Generation + clientType Inference
// ============================================================================

import type { FormInput, GeneratedTerm, Step1Output, TermIntent } from '../types/pipeline.types';

export const TERM_GEN_PROMPT_VERSION = 'term-gen-v2.1-clienttype';

export const INTENT_WEIGHTS: Record<TermIntent, number> = {
  transactional: 1.0,
  navigational: 0.7,
  consideration: 0.35,
  informational: 0.1,
};

// Language-specific prompt configuration for term generation
const LOCALE_PROMPTS: Record<string, {
  expertRole: string;
  nearMe: string;
  nearMeVariations: string;
  ticketPrefix: string;
  b2gExamples: string;
  b2bExamples: string;
}> = {
  'pt-BR': {
    expertRole: 'especialista em marketing local e comportamento de busca do consumidor brasileiro',
    nearMe: 'perto de mim',
    nearMeVariations: '"perto de mim", "na minha região", "próximo"',
    ticketPrefix: 'R$',
    b2gExamples: '"licitação [produto]", "pregão [serviço]", "fornecedor [produto] governo", "ata de registro de preços [produto]"',
    b2bExamples: '"contabilidade para empresas", "fornecedor [produto] atacado"',
  },
  'en': {
    expertRole: 'expert in local marketing and consumer search behavior',
    nearMe: 'near me',
    nearMeVariations: '"near me", "in my area", "nearby", "close to me"',
    ticketPrefix: '$',
    b2gExamples: '"government contract [product]", "RFP [service]", "[product] supplier government", "federal procurement [product]"',
    b2bExamples: '"[product] for businesses", "[product] wholesale supplier", "B2B [service] provider"',
  },
  'es': {
    expertRole: 'experto en marketing local y comportamiento de búsqueda del consumidor',
    nearMe: 'cerca de mí',
    nearMeVariations: '"cerca de mí", "en mi zona", "próximo", "cercano"',
    ticketPrefix: '€',
    b2gExamples: '"licitación [producto]", "contratación pública [servicio]", "proveedor [producto] gobierno"',
    b2bExamples: '"[producto] para empresas", "proveedor [producto] al por mayor"',
  },
};

export function buildTermGenerationPrompt(input: FormInput): string {
  const lp = LOCALE_PROMPTS[input.locale] || LOCALE_PROMPTS['pt-BR'];

  const context = [
    `NEGÓCIO: ${input.product}`,
    input.differentiator ? `DIFERENCIAL: ${input.differentiator}` : null,
    `REGIÃO: ${input.region}`,
    input.address ? `ENDEREÇO: ${input.address}` : null,
    input.customerDescription ? `COMO O CLIENTE DESCREVE: ${input.customerDescription}` : null,
    input.ticket ? `TICKET MÉDIO: ${lp.ticketPrefix}${input.ticket}` : null,
    `IDIOMA DO MERCADO: ${input.locale}`,
    `PAÍS: ${input.countryCode}`,
  ].filter(Boolean).join('\n');

  return `Você é um ${lp.expertRole}.

CONTEXTO:
${context}

TAREFA:
1. Classifique o tipo de cliente deste negócio: "b2c", "b2b" ou "b2g"
2. Gere 25-30 termos de busca que pessoas reais usariam no Google NO IDIOMA "${input.locale}"

CLASSIFICAÇÃO clientType:
- "b2c" se vende para pessoas físicas/consumidores (ex: clínica, salão, restaurante, academia, arquiteto residencial, loja)
- "b2b" se o negócio vende predominantemente para OUTRAS EMPRESAS (ex: contabilidade, assessoria jurídica empresarial, software para empresas, distribuidora, consultoria, RH, TI empresarial, fornecedores)
- "b2g" se vende predominantemente para GOVERNO / setor público (ex: fornecedor de licitações, empresa de obras públicas, TI para governo, uniformes para prefeituras, serviços de engenharia para órgãos públicos)

REGRAS para termos:
1. Linguagem natural — como uma pessoa digitaria no Google NO IDIOMA "${input.locale}"
2. NÃO inclua nomes de cidades, bairros ou regiões nos termos — a localização é configurada separadamente via geo-targeting
3. HEAD TERMS obrigatórios: categoria genérica + "${lp.nearMe}" (ex: "[category] ${lp.nearMe}") deve vir primeiro
4. Use variações genéricas de proximidade: ${lp.nearMeVariations} — os termos devem ser o que alguém JÁ NAQUELA LOCALIZAÇÃO digitaria
5. Considere a tensão: o dono diz "clínica de estética avançada", o cliente busca "botox preço"
6. Se b2b: gere termos que empresários e decisores buscam ao contratar (ex: ${lp.b2bExamples}). Evite termos de consumidor final.
7. Se b2g: gere termos que gestores públicos e equipes de compras buscam (ex: ${lp.b2gExamples}). Inclua termos de compliance e certificação.
8. TODOS os termos devem estar no idioma "${input.locale}" — não misture idiomas

DISTRIBUIÇÃO:
- TRANSACIONAIS (8-12): prontos para comprar/contratar
- NAVEGACIONAIS (4-6): comparando opções
- CONSIDERAÇÃO (4-6): pesquisando
- INFORMACIONAIS (2-3): aprendendo
- TENSÃO (2-3): insatisfação/reclamação

FORMATO (JSON estrito, sem markdown):
{
  "clientType": "b2c",
  "terms": [
    { "term": "botox preço ${lp.nearMe}", "intent": "transactional", "category": "core", "rationale": "Alta intenção + preço + proximidade" }
  ]
}

Categories: "core", "branded", "comparative", "tension"
Gere APENAS o JSON.`;
}

export function parseTermGenerationResponse(rawResponse: string): { terms: GeneratedTerm[]; clientType: 'b2c' | 'b2b' | 'b2g' } {
  const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: {
    clientType?: 'b2c' | 'b2b' | 'b2g';
    terms: Array<{
      term: string; intent: TermIntent;
      category: 'core' | 'branded' | 'comparative' | 'tension';
      rationale: string;
    }>;
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse term generation response: ${e}`);
  }

  if (!parsed.terms || !Array.isArray(parsed.terms)) {
    throw new Error('Response missing "terms" array');
  }

  const clientType = parsed.clientType === 'b2b' ? 'b2b' : parsed.clientType === 'b2g' ? 'b2g' : 'b2c';

  const terms = parsed.terms.map(t => ({
    term: t.term.toLowerCase().trim(),
    intent: t.intent,
    intentWeight: INTENT_WEIGHTS[t.intent] ?? 0.1,
    category: t.category,
    rationale: t.rationale,
  }));

  return { terms, clientType };
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
): Promise<Step1Output & { inferredClientType: 'b2c' | 'b2b' | 'b2g' }> {
  const startTime = Date.now();
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';
  const maxRetries = options?.maxRetries ?? 2;

  const prompt = buildTermGenerationPrompt(input);
  let terms: GeneratedTerm[] = [];
  let inferredClientType: 'b2c' | 'b2b' | 'b2g' = 'b2c';
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

      const result = parseTermGenerationResponse(text);
      terms = result.terms;
      inferredClientType = result.clientType;
      console.log(`[Step1] Inferred clientType: ${inferredClientType}`);

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
    inferredClientType,
  };
}
