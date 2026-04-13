// ============================================================================
// Virô Radar — Blueprint Classifier
// Classifica um negócio no blueprint mais adequado.
// 1) Keyword matching local (rápido, sem API, ~1ms)
// 2) Claude Haiku como fallback (quando keywords não são suficientes, ~500ms)
// ============================================================================

import { BLUEPRINT_CATALOG, ALL_KEYWORDS, DEFAULT_BLUEPRINT_ID, BLUEPRINT_MAP } from './catalog';
import type { Blueprint } from './types';

interface ClassificationInput {
  businessName: string;
  product: string;
  clientType?: string;        // 'b2c' | 'b2b' | 'b2g'
  salesChannel?: string;      // 'loja_fisica' | 'online' | 'servico' | 'marketplace' | 'direto'
  region?: string;
  instagram?: string;
  site?: string;
}

interface ClassificationResult {
  blueprint: Blueprint;
  confidence: 'high' | 'medium' | 'low';
  method: 'keyword' | 'claude' | 'default';
  matchedKeywords?: string[];
}

/**
 * Classifica o negócio por keyword matching.
 * Retorna null se confiança for baixa (< 2 matches).
 */
function classifyByKeywords(input: ClassificationInput): ClassificationResult | null {
  const text = `${input.businessName} ${input.product}`.toLowerCase();

  // Conta matches por blueprint
  const scores: Record<string, { count: number; keywords: string[] }> = {};

  for (const { keyword, blueprintId } of ALL_KEYWORDS) {
    if (text.includes(keyword)) {
      if (!scores[blueprintId]) scores[blueprintId] = { count: 0, keywords: [] };
      scores[blueprintId].count++;
      scores[blueprintId].keywords.push(keyword);
    }
  }

  // Boost por clientType match
  if (input.clientType) {
    for (const bp of BLUEPRINT_CATALOG) {
      if (scores[bp.id] && bp.primaryClientType === input.clientType) {
        scores[bp.id].count += 0.5;
      }
    }
  }

  // Boost por canal de venda
  if (input.salesChannel) {
    const channelBoosts: Record<string, string[]> = {
      marketplace: ['ecommerce_marketplace'],
      online: ['ecommerce_marketplace', 'criador_cpf', 'b2b_tecnologia'],
      loja_fisica: ['varejo_local', 'restaurante_food', 'beleza_estetica'],
      servico: ['servicos_local', 'profissional_liberal', 'b2b_servicos'],
      direto: ['b2b_servicos', 'b2b_industria', 'b2b_energia'],
    };
    for (const bpId of channelBoosts[input.salesChannel] || []) {
      if (scores[bpId]) scores[bpId].count += 0.5;
    }
  }

  // Pega o melhor
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b.count - a.count);

  if (sorted.length === 0) return null;

  const [bestId, best] = sorted[0];
  const blueprint = BLUEPRINT_MAP[bestId];
  if (!blueprint) return null;

  // Confiança baseada em matches (incluindo boosts)
  const confidence = best.count >= 3 ? 'high' : best.count >= 1.5 ? 'medium' : 'low';

  // Se menos de 1 keyword real (sem boosts), não confia
  const realKeywordCount = best.keywords.length;
  if (realKeywordCount === 0) return null;

  // Se 1+ keyword real + qualquer boost, aceita com medium
  if (best.count < 1.0) return null;

  return {
    blueprint,
    confidence,
    method: 'keyword',
    matchedKeywords: best.keywords,
  };
}

/**
 * Classifica via Claude Haiku (fallback).
 * Custo: ~$0.0003 por classificação.
 */
async function classifyByClaude(input: ClassificationInput): Promise<ClassificationResult> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const blueprintOptions = BLUEPRINT_CATALOG
      .map(bp => `${bp.id}: ${bp.label} — ${bp.description}`)
      .join('\n');

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Classifique este negócio no blueprint MAIS ESPECÍFICO.

Negócio: "${input.businessName}"
Produto/serviço: "${input.product}"
${input.clientType ? `Tipo de cliente: ${input.clientType}` : ''}
${input.salesChannel ? `Canal de venda: ${input.salesChannel}` : ''}

ATENÇÃO:
- Barbearia, salão, estética = beleza_estetica (NÃO restaurante)
- Advogado, escritório advocacia = juridico_advocacia (NÃO profissional_liberal)
- Contador, contabilidade = contabilidade (NÃO b2b_servicos)
- Pet shop, veterinário = pet_veterinario (NÃO varejo_local)
- Oficina, mecânica = automotivo (NÃO servicos_local)

Blueprints:
${blueprintOptions}

Responda APENAS com o ID (ex: beleza_estetica). Nada mais.`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
    const cleanId = text.replace(/[^a-z_]/g, '');
    const blueprint = BLUEPRINT_MAP[cleanId];

    if (blueprint) {
      return { blueprint, confidence: 'medium', method: 'claude' };
    }
  } catch (err) {
    console.warn('[Classifier] Claude fallback failed:', (err as Error).message);
  }

  // Ultimate fallback
  return {
    blueprint: BLUEPRINT_MAP[DEFAULT_BLUEPRINT_ID]!,
    confidence: 'low',
    method: 'default',
  };
}

/**
 * Classifica um negócio no blueprint mais adequado.
 * Tenta keyword matching primeiro (grátis, <1ms).
 * Se não confia, usa Claude Haiku (~$0.0003, ~500ms).
 */
export async function classifyBusiness(
  input: ClassificationInput,
): Promise<ClassificationResult> {
  // 1. Keyword matching
  const keywordResult = classifyByKeywords(input);
  if (keywordResult && keywordResult.confidence !== 'low') {
    console.log(
      `[Classifier] ${input.product} → ${keywordResult.blueprint.id} (keyword, ${keywordResult.confidence}, matched: ${keywordResult.matchedKeywords?.join(', ')})`,
    );
    return keywordResult;
  }

  // 2. Claude fallback
  console.log(`[Classifier] Keywords insuficientes pra "${input.product}", usando Claude...`);
  const claudeResult = await classifyByClaude(input);
  console.log(
    `[Classifier] ${input.product} → ${claudeResult.blueprint.id} (${claudeResult.method}, ${claudeResult.confidence})`,
  );
  return claudeResult;
}

/**
 * Classifica síncronamente por keywords (sem Claude).
 * Usa quando não pode esperar ou não tem API key.
 * Retorna default se não encontrar match.
 */
export function classifyBusinessSync(input: ClassificationInput): ClassificationResult {
  const keywordResult = classifyByKeywords(input);
  if (keywordResult) return keywordResult;
  return {
    blueprint: BLUEPRINT_MAP[DEFAULT_BLUEPRINT_ID]!,
    confidence: 'low',
    method: 'default',
  };
}
