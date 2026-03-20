// src/lib/generateContents.ts
// Serviço de geração de conteúdo para redes sociais.
// Chamado pelo webhook pós-pagamento e pela API de geração manual no dashboard.

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LeadContext {
  id: string
  name: string
  segment: string
  location: string
  search_volume?: number
  influence_score?: number
  competitors?: string | string[] | null
}

export interface GeneratedPost {
  channel: string
  channel_key: string
  content: string
  hashtags: string[]
  best_time: string
  tip: string
}

export interface GenerateResult {
  posts: GeneratedPost[]
  strategy_note: string
}

// ─── Specs por canal ──────────────────────────────────────────────────────────

const CHANNEL_SPECS: Record<string, { label: string; spec: string }> = {
  instagram_feed: {
    label: 'Instagram Feed',
    spec: 'Legenda entre 150-300 palavras. Tom conversacional. 4-6 hashtags locais no final. CTA claro (ex: "nos chama no WhatsApp", "vem nos visitar").',
  },
  instagram_stories: {
    label: 'Instagram Stories',
    spec: 'Máximo 2 frases impactantes. Direto ao ponto. Termine com uma pergunta ou enquete. Sem hashtags.',
  },
  google_business: {
    label: 'Google Business',
    spec: '100-150 palavras. Mencione a cidade/bairro. Foco em SEO local. Pode incluir horário, endereço ou promoção.',
  },
  whatsapp_status: {
    label: 'WhatsApp Status',
    spec: 'Máximo 3 linhas. Tom amigável e próximo. Um emoji no máximo. CTA simples (ex: "manda mensagem!").',
  },
}

// ─── Geração via Claude ───────────────────────────────────────────────────────

export async function generateContentsForLead(
  lead: LeadContext,
  tone = 'próximo e informal',
  objective = 'atrair novos clientes'
): Promise<GenerateResult> {
  const competitors =
    Array.isArray(lead.competitors)
      ? lead.competitors.join(', ')
      : lead.competitors ?? 'não informado'

  const lowScore =
    lead.influence_score != null && lead.influence_score < 50

  const prompt = `Você é especialista em marketing local para pequenas empresas brasileiras.

Negócio: ${lead.name}
Segmento: ${lead.segment}
Localização: ${lead.location}
Volume de buscas/mês: ${lead.search_volume ?? 'não informado'}
Score de influência atual: ${lead.influence_score != null ? lead.influence_score + '%' : 'não informado'}
Concorrentes identificados: ${competitors}

Tom de voz: ${tone}
Objetivo: ${objective}

${lowScore ? `CONTEXTO ESTRATÉGICO: este negócio aparece para apenas ${lead.influence_score}% da demanda local. O conteúdo deve ajudar a recuperar presença digital — foco em diferenciação e proximidade com a comunidade local.` : ''}

Gere um post para cada canal abaixo:
${Object.entries(CHANNEL_SPECS)
  .map(([key, ch]) => `- ${ch.label} (channel_key: "${key}"): ${ch.spec}`)
  .join('\n')}

Responda APENAS em JSON válido. Sem markdown, sem texto antes ou depois.
{
  "posts": [
    {
      "channel": "nome legível do canal",
      "channel_key": "chave_do_canal",
      "content": "texto completo do post",
      "hashtags": ["hashtag1", "hashtag2"],
      "best_time": "ex: terça às 19h",
      "tip": "dica estratégica curta (1 frase)"
    }
  ],
  "strategy_note": "observação estratégica geral (1-2 frases)"
}`

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as GenerateResult
}

// ─── Persistência ─────────────────────────────────────────────────────────────

export async function saveGeneratedContents(
  leadId: string,
  result: GenerateResult,
  tone: string,
  objective: string
): Promise<void> {
  const rows = result.posts.map((p) => ({
    lead_id: leadId,
    channel: p.channel,
    channel_key: p.channel_key,
    content: p.content,
    hashtags: p.hashtags,
    best_time: p.best_time,
    tip: p.tip,
    tone,
    objective,
    status: 'draft',
  }))

  const { error } = await getSupabaseAdmin()
    .from('generated_contents')
    .insert(rows)

  if (error) {
    console.error('[generateContents] Erro ao salvar:', error)
    throw new Error('Falha ao salvar conteúdos gerados')
  }
}

// ─── Disparo pós-pagamento (chamado pelo webhook do Stripe) ───────────────────

export async function triggerContentGeneration(leadId: string): Promise<void> {
  // Busca dados do lead com os nomes reais das colunas
  const { data: lead, error: leadError } = await getSupabaseAdmin()
    .from('leads')
    .select('id, name, business_category, region, competitors')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    console.error('[triggerContentGeneration] Lead não encontrado:', leadId)
    return
  }

  // Busca diagnóstico mais recente para volume e score
  const { data: diagnosis } = await getSupabaseAdmin()
    .from('diagnoses')
    .select('total_volume, influence_percent')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const leadContext: LeadContext = {
    id: lead.id,
    name: lead.name,
    segment: lead.business_category,
    location: lead.region,
    search_volume: diagnosis?.total_volume ?? undefined,
    influence_score: diagnosis?.influence_percent ?? undefined,
    competitors: lead.competitors,
  }

  const result = await generateContentsForLead(
    leadContext,
    'próximo e informal',
    'atrair novos clientes'
  )

  await saveGeneratedContents(leadId, result, 'próximo e informal', 'atrair novos clientes')

  console.log(
    `[triggerContentGeneration] ${result.posts.length} posts gerados para lead ${leadId}`
  )
}
