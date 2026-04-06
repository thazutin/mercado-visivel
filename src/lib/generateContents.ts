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
  levers?: Array<{ dimension: string; action: string; impact: number }>
}

export interface GeneratedPost {
  channel: string
  channel_key: string
  content: string
  hashtags: string[]
  best_time: string
  tip: string
  hook: string
  strategic_intent: string
  image_url?: string
}

export interface GenerateResult {
  posts: GeneratedPost[]
  strategy_note: string
}

// ─── Specs por canal ──────────────────────────────────────────────────────────

const CHANNEL_SPECS_B2C: Record<string, { label: string; spec: string }> = {
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
};

const CHANNEL_SPECS_B2B: Record<string, { label: string; spec: string }> = {
  linkedin_post: {
    label: 'LinkedIn Post',
    spec: '200-400 palavras. Tom profissional mas acessível. Comece com dado ou insight. Termine com pergunta ou CTA para DM. 3-5 hashtags de nicho.',
  },
  linkedin_article: {
    label: 'LinkedIn Article',
    spec: '400-600 palavras. Artigo de autoridade. Baseado em dados reais. Estrutura: gancho → contexto → solução → CTA. Tom de especialista.',
  },
  google_business: {
    label: 'Google Business',
    spec: '100-150 palavras. Foque em credenciais e resultados. Mencione a cidade/região de atuação. CTA para agendamento ou contato.',
  },
  email_newsletter: {
    label: 'Email Newsletter',
    spec: 'Subject line (max 50 chars) + corpo de 200-300 palavras. Valor primeiro, venda depois. Um insight útil + CTA claro. Tom consultivo.',
  },
};

function getChannelSpecs(clientType: string, hasLinkedIn: boolean, hasInstagram: boolean): Record<string, { label: string; spec: string }> {
  if (clientType === 'b2b') {
    // B2B: LinkedIn-first se declarado, senão adapta
    if (hasLinkedIn) return CHANNEL_SPECS_B2B;
    if (hasInstagram) return {
      ...CHANNEL_SPECS_B2C,
      linkedin_post: CHANNEL_SPECS_B2B.linkedin_post, // adiciona LinkedIn mesmo sem declarar
    };
    return CHANNEL_SPECS_B2B; // default B2B
  }
  return CHANNEL_SPECS_B2C; // B2C
}

// ─── Geração via Claude ───────────────────────────────────────────────────────

export async function generateContentsForLead(
  lead: LeadContext,
  tone = 'próximo e informal',
  objective = 'atrair novos clientes',
  relatorioContext?: { destaque: string; oportunidade_da_semana: string } | null,
): Promise<GenerateResult> {
  const competitors =
    Array.isArray(lead.competitors)
      ? lead.competitors.join(', ')
      : lead.competitors ?? 'não informado'

  const lowScore =
    lead.influence_score != null && lead.influence_score < 50

  // Canais adaptáveis ao tipo de negócio
  const clientType = (lead as any).client_type || 'b2c';
  const hasLinkedIn = !!(lead as any).linkedin;
  const hasInstagram = !!(lead as any).instagram;
  const CHANNEL_SPECS = getChannelSpecs(clientType, hasLinkedIn, hasInstagram);

  const prompt = `Você é especialista em marketing ${clientType === 'b2b' ? 'B2B' : 'local'} para ${clientType === 'b2b' ? 'empresas' : 'pequenas empresas'} brasileiras.

Negócio: ${lead.name}
Segmento: ${lead.segment}
Localização: ${lead.location}
Volume de buscas/mês: ${lead.search_volume ?? 'não informado'}
Score de influência atual: ${lead.influence_score != null ? lead.influence_score + '%' : 'não informado'}
Concorrentes identificados: ${competitors}

Tom de voz: ${tone}
Objetivo: ${objective}

${lowScore ? `CONTEXTO ESTRATÉGICO: este negócio aparece para apenas ${lead.influence_score}% da demanda local. O conteúdo deve ajudar a recuperar presença digital — foco em diferenciação e proximidade com a comunidade local.` : ''}

${relatorioContext?.destaque ? `CONTEXTO DO MERCADO ESTA SEMANA: ${relatorioContext.destaque}` : ''}
${relatorioContext?.oportunidade_da_semana ? `OPORTUNIDADE DA SEMANA: ${relatorioContext.oportunidade_da_semana}` : ''}

IMPORTANTE — Propósito dos conteúdos:
Cada post deve ser criado com intenção clara de aumentar a probabilidade de venda futura. Não é conteúdo genérico — é conteúdo que:
1. Reduz fricção de decisão (mostra que o negócio é confiável e próximo)
2. Antecipa objeções comuns do cliente local
3. Posiciona o negócio como a escolha óbvia na região

REGRAS OBRIGATÓRIAS:
- Use o produto/serviço REAL (${lead.segment}), a região REAL (${lead.location}), e o diferencial REAL do negócio
- Cite dados reais quando disponíveis (ex: "${lead.search_volume ? `${lead.search_volume} pessoas buscam isso por mês na sua região` : 'volume de buscas disponível'}")
- Cada post deve ter um objetivo de negócio claro: atrair novo cliente / converter quem já conhece / fidelizar quem já comprou
- NUNCA gere post genérico de "dica do dia" sem conexão com o negócio real
- O "hook" deve ser a primeira frase que para o scroll — baseada no que o público-alvo REAL se preocupa

${relatorioContext ? `
CONTEXTO DO MERCADO ESTA SEMANA:
${relatorioContext.destaque}
Oportunidade: ${relatorioContext.oportunidade_da_semana}
Os posts desta semana devem ser conectados a este contexto —
não posts genéricos, posts que fazem sentido AGORA dado o momento do mercado.
` : ''}

${lead.levers && lead.levers.length > 0
  ? `ORIENTAÇÃO ESTRATÉGICA (baseada no score de influência):
As principais lacunas deste negócio são:
${lead.levers.slice(0, 3).map((l: any) => `- ${l.dimension}: ${l.action}`).join('\n')}
Os conteúdos devem endereçar indiretamente essas lacunas — ex: se a lacuna é "poucos
avaliações no Maps", gere um post que incentive clientes a deixar avaliação.`
  : ''}

ARCO NARRATIVO DA SEMANA (os 4 posts devem formar uma sequência estratégica):
- Post 1 (instagram_feed, segunda): AUTORIDADE — dado de mercado ou insight que posiciona o negócio como referência
- Post 2 (google_business, quarta): PROVA SOCIAL — depoimento, resultado real, antes/depois, números concretos
- Post 3 (instagram_feed, sexta): OPORTUNIDADE — conectado ao que está acontecendo esta semana no mercado/sazonalidade
- Post 4 (instagram_stories): BASTIDORES — humaniza o negócio, mostra equipe/processo/dia-a-dia

Specs por canal:
${Object.entries(CHANNEL_SPECS)
  .map(([key, ch]) => `- ${ch.label} (channel_key: "${key}"): ${ch.spec}`)
  .join('\n')}

Responda APENAS em JSON válido. Sem markdown, sem texto antes ou depois.
{
  "posts": [
    {
      "channel": "nome legível do canal",
      "channel_key": "chave_do_canal",
      "hook": "primeira frase do post — deve parar o scroll",
      "content": "texto completo do post (começando pelo hook)",
      "hashtags": ["hashtag1", "hashtag2"],
      "best_time": "ex: terça às 19h",
      "tip": "porquê estratégico deste conteúdo (1 frase)",
      "strategic_intent": "por que este conteúdo aumenta vendas + qual etapa da jornada (awareness/consideração/decisão/retenção)"
    }
  ],
  "strategy_note": "observação estratégica geral (1-2 frases)"
}`

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    temperature: 0.6,
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
  // Calcula week_number (semana do ano)
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);

  const rows = result.posts.map((p) => ({
    lead_id: leadId,
    channel: p.channel,
    channel_key: p.channel_key,
    content: p.content,
    hashtags: p.hashtags,
    best_time: p.best_time,
    tip: p.tip,
    hook: p.hook || null,
    strategic_intent: p.strategic_intent || null,
    image_url: p.image_url || null,
    tone,
    objective,
    status: 'draft',
    week_number: weekNumber,
    generation_date: now.toISOString().split('T')[0],
  }))

  // Deleta apenas conteúdos DA MESMA SEMANA (não histórico)
  await getSupabaseAdmin()
    .from('generated_contents')
    .delete()
    .eq('lead_id', leadId)
    .eq('week_number', weekNumber)

  const { error } = await getSupabaseAdmin()
    .from('generated_contents')
    .insert(rows)

  if (error) {
    console.error('[generateContents] Erro ao salvar:', error)
    throw new Error(`Falha ao salvar conteúdos gerados: ${error.message} (code: ${error.code})`)
  }
}

// ─── Disparo pós-pagamento (chamado pelo webhook do Stripe) ───────────────────

export async function triggerContentGeneration(leadId: string): Promise<void> {
  console.log('[generateContents] Buscando lead:', leadId)

  const { data: lead, error: leadError } = await getSupabaseAdmin()
    .from('leads')
    .select('id, name, product, region, competitors, site, instagram, differentiator')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    console.error('[generateContents] Lead não encontrado:', leadId, leadError?.message)
    return
  }

  console.log('[generateContents] Lead encontrado:', lead.name, '| produto:', lead.product, '| região:', lead.region)

  // Busca diagnóstico mais recente para volume, score e levers
  const { data: diagnosis } = await getSupabaseAdmin()
    .from('diagnoses')
    .select('total_volume, influence_percent, influence_breakdown')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const levers = (diagnosis?.influence_breakdown as any)?.levers || [];

  const leadContext: LeadContext = {
    id: lead.id,
    name: lead.name || lead.product,
    segment: lead.product,
    location: lead.region,
    search_volume: diagnosis?.total_volume ?? undefined,
    influence_score: diagnosis?.influence_percent ?? undefined,
    competitors: lead.competitors,
    levers: levers.slice(0, 3),
  }

  console.log('[generateContents] Gerando posts...')

  const result = await generateContentsForLead(
    leadContext,
    'próximo e informal',
    'atrair novos clientes'
  )

  console.log('[generateContents] Posts gerados:', result.posts.length)

  // Gera imagens para posts de Instagram (em paralelo)
  const instagramChannels = ['instagram_feed', 'instagram_stories']
  const imagePromises = result.posts.map(async (post) => {
    if (!instagramChannels.includes(post.channel_key)) return
    try {
      const { generatePostImage } = await import('./generateImage')
      const imageUrl = await generatePostImage({
        business_name: leadContext.name,
        segment: leadContext.segment,
        location: leadContext.location,
        post_content: post.content,
        channel: post.channel,
        site: lead.site || undefined,
        instagram: lead.instagram || undefined,
        differentiator: lead.differentiator || undefined,
        post_objective: post.strategic_intent?.split(/[—–-]/)?.[0]?.trim() || undefined,
      })
      if (imageUrl) {
        post.image_url = imageUrl
      }
    } catch (err) {
      console.warn(`[generateContents] Imagem falhou para ${post.channel_key}:`, (err as Error).message)
    }
  })
  await Promise.all(imagePromises)
  console.log('[generateContents] Imagens processadas, salvando no banco...')

  await saveGeneratedContents(leadId, result, 'próximo e informal', 'atrair novos clientes')

  console.log(
    `[generateContents] ${result.posts.length} posts salvos para lead ${leadId}`
  )

  // Gera briefings de produção (3 briefings para delegar para produtora)
  try {
    const { generateProductionBriefs } = await import('./generateProductionBriefs')


    const { data: diagData } = await getSupabaseAdmin()
      .from('diagnoses')
      .select('raw_data')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    await generateProductionBriefs(
      leadId,
      {
        product: lead.product,
        region: lead.region,
        differentiator: lead.differentiator,
        instagram: lead.instagram,
        site: lead.site,
        client_type: (lead as any).client_type,
      },
      diagData?.raw_data || {},
      1,
    )
  } catch (briefErr) {
    console.error('[ContentGen] Production briefs falhou (non-fatal):', (briefErr as Error).message)
  }
}

// ─── Disparo com contexto setorial (chamado pelo cron semanal) ────────────────

export async function triggerContentGenerationWithContext(
  leadId: string,
  relatorioSetorial: any,
): Promise<void> {
  console.log('[generateContents] Buscando lead (with context):', leadId)

  const { data: lead, error: leadError } = await getSupabaseAdmin()
    .from('leads')
    .select('id, name, product, region, competitors, site, instagram, differentiator')
    .eq('id', leadId)
    .single()

  if (leadError || !lead) {
    console.error('[generateContents] Lead não encontrado:', leadId, leadError?.message)
    return
  }

  const { data: diagnosis } = await getSupabaseAdmin()
    .from('diagnoses')
    .select('total_volume, influence_percent, influence_breakdown')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const levers = (diagnosis?.influence_breakdown as any)?.levers || []

  const leadContext: LeadContext = {
    id: lead.id,
    name: lead.name || lead.product,
    segment: lead.product,
    location: lead.region,
    search_volume: diagnosis?.total_volume ?? undefined,
    influence_score: diagnosis?.influence_percent ?? undefined,
    competitors: lead.competitors,
    levers: levers.slice(0, 3),
  }

  const relatorioContext = relatorioSetorial ? {
    destaque: relatorioSetorial.destaque,
    oportunidade_da_semana: relatorioSetorial.oportunidade_da_semana,
  } : null

  console.log('[generateContents] Gerando posts com contexto setorial...')

  const result = await generateContentsForLead(
    leadContext,
    'próximo e informal',
    'atrair novos clientes',
    relatorioContext,
  )

  console.log('[generateContents] Posts gerados:', result.posts.length)

  // Gera imagens para posts de Instagram (em paralelo)
  const instagramChannels = ['instagram_feed', 'instagram_stories']
  const imagePromises = result.posts.map(async (post) => {
    if (!instagramChannels.includes(post.channel_key)) return
    try {
      const { generatePostImage } = await import('./generateImage')
      const imageUrl = await generatePostImage({
        business_name: leadContext.name,
        segment: leadContext.segment,
        location: leadContext.location,
        post_content: post.content,
        channel: post.channel,
        site: lead.site || undefined,
        instagram: lead.instagram || undefined,
        differentiator: lead.differentiator || undefined,
        post_objective: post.strategic_intent?.split(/[—–-]/)?.[0]?.trim() || undefined,
      })
      if (imageUrl) post.image_url = imageUrl
    } catch (err) {
      console.warn(`[generateContents] Imagem falhou para ${post.channel_key}:`, (err as Error).message)
    }
  })
  await Promise.all(imagePromises)

  await saveGeneratedContents(leadId, result, 'próximo e informal', 'atrair novos clientes')

  console.log(`[generateContents] ${result.posts.length} posts salvos para lead ${leadId}`)
}
