// ============================================================================
// Step 6 — Checklist de Melhorias (Claude-powered)
// Gera checklist prático de melhorias agrupado por categoria
// File: src/lib/pipeline/step6-checklist.ts
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import type { ChecklistItem } from '../types/pipeline.types'

interface ChecklistInput {
  name: string
  business_category: string
  region: string
  influence_score: number
  influence_breakdown: any
  client_type: 'b2c' | 'b2b' | 'b2g'
  gap_routes?: Array<{ title: string; description: string; timeframe: string }>
}

interface ChecklistResult {
  items: ChecklistItem[]
}

export async function executeStep6Checklist(
  input: ChecklistInput,
): Promise<ChecklistResult> {
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const gapContext = input.gap_routes && input.gap_routes.length > 0
      ? `\nContexto estratégico (use para enriquecer os itens do plano):\n${input.gap_routes.map(r => `- ${r.title}: ${r.description} (${r.timeframe})`).join('\n')}\n`
      : ''

    const clientTypeBlock = input.client_type === 'b2b'
      ? `\nEste negócio atende outras empresas (B2B). O plano de ação deve incluir:
- Categoria "LinkedIn e prospecção": otimizar perfil LinkedIn, criar conteúdo para tomadores de decisão, estratégia de conexão com empresas-alvo
- Substituir itens de Instagram por LinkedIn quando mais relevante
- Foco em credibilidade e autoridade, não em volume de buscas locais\n`
      : input.client_type === 'b2g'
      ? `\nEste negócio atende órgãos públicos (B2G). O plano de ação deve incluir:
- Categoria "Habilitação e licitações": SICAF atualizado, certidões em dia, cadastro em portais de licitação (ComprasNet, BLL, etc)
- Categoria "Visibilidade para gestores públicos": LinkedIn com foco em setor público, cases e referências de contratos públicos anteriores
- Não recomendar ações de Instagram como prioridade\n`
      : ''

    const prompt = `Você é especialista em presença digital para pequenas empresas brasileiras.

Negócio: ${input.name}
Segmento: ${input.business_category}
Localização: ${input.region}
Score de influência atual: ${input.influence_score}%
Tipo de cliente: ${input.client_type}
${input.influence_breakdown ? `Breakdown: Google=${input.influence_breakdown.google || 'N/A'}%, Instagram=${input.influence_breakdown.instagram || 'N/A'}%` : ''}
${gapContext}${clientTypeBlock}
Gere um plano de ação prático para este negócio aumentar sua visibilidade digital.

CATEGORIAS OBRIGATÓRIAS (gere itens para cada uma):

${input.client_type === 'b2b' ? `1. "Google Meu Negócio": descrição completa, categoria correta, solicitar reviews de clientes corporativos
2. "LinkedIn e prospecção": perfil otimizado, conteúdo para decisores, estratégia de conexões
3. "Website": SEO, autoridade, cases de sucesso, otimização para IA (AIO)
4. "Credibilidade digital": Google Ads B2B, certificações visíveis, WhatsApp Business` :
input.client_type === 'b2g' ? `1. "Habilitação e licitações": SICAF, certidões, cadastro em portais (ComprasNet, BLL)
2. "Visibilidade para gestores públicos": LinkedIn institucional, cases de contratos públicos
3. "Website": SEO institucional, portfólio de contratos, otimização para IA (AIO)
4. "Google Meu Negócio": presença atualizada, categoria correta` :
`1. "Google Meu Negócio": fotos profissionais, descrição completa, horário atualizado, categoria correta, solicitar reviews, responder reviews existentes
2. "Instagram": bio otimizada, link na bio (Linktree ou similar), alinhamento visual com proposta de valor, copies dos posts otimizadas para SEO/AIO
3. "Website": existência de site, SEO básico (title, meta description, velocidade), otimização para respostas de IA (AIO — conteúdo estruturado que IAs conseguem citar)
4. "Copies digitais": perfil no LinkedIn (especialmente B2B), WhatsApp Business com catálogo, Google Ads se aplicável ao segmento`}

REGRAS:
- Máximo 20 itens no total
- Pelo menos 3 itens com prioridade "alta"
- Prioridade "alta" = impacto imediato em captura de demanda existente
- Prioridade "média" = melhoria relevante mas não urgente
- Prioridade "baixa" = nice to have
- Cada item deve ser específico e acionável para ESTE negócio
- Não use itens genéricos que servem pra qualquer negócio

Responda APENAS em JSON válido. Sem markdown, sem texto antes ou depois.
{
  "items": [
    {
      "id": "gmb_1",
      "category": "Google Meu Negócio",
      "title": "Título curto e acionável",
      "description": "Descrição prática de como executar (1-2 frases)",
      "priority": "alta",
      "status": "pending"
    }
  ]
}`

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return { items: parsed.items || [] }
  } catch (err) {
    console.error('[step6-checklist] Falha crítica:', err)
    throw err
  }
}
