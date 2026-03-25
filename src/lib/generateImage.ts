// src/lib/generateImage.ts
// Geração de imagens para posts via fal.ai (Flux Schnell)
// Pipeline de 3 etapas: Brand Research (Claude) → Prompt Generation → Image Generation (fal.ai)

import { fal } from "@fal-ai/client"
import Anthropic from "@anthropic-ai/sdk"

fal.config({ credentials: process.env.FAL_API_KEY })

export interface GenerateImageParams {
  business_name: string
  segment: string
  location: string
  post_content: string
  channel: string
  rating?: number | null
  reviewCount?: number | null
  site?: string
  instagram?: string
  differentiator?: string
  post_objective?: string   // awareness | consideracao | decisao | retencao
  visual_style?: string     // produto | lifestyle | emocional | minimalista | bold_graphic
}

// ── ETAPA 1: Brand Research ────────────────────────────────────────────────

async function researchBrand(params: GenerateImageParams): Promise<any> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const contextParts: string[] = [
    `Negócio: ${params.business_name}`,
    `Setor: ${params.segment}`,
    `Localização: ${params.location}`,
    `Diferencial: ${params.differentiator || 'não informado'}`,
  ]

  if (params.site) contextParts.push(`Site: ${params.site}`)
  if (params.instagram) contextParts.push(`Instagram: @${params.instagram}`)
  if (params.rating) contextParts.push(`Avaliação Google: ${params.rating}★ (${params.reviewCount || 0} avaliações)`)

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Você é um diretor de arte especialista em identidade visual de negócios locais brasileiros.

${contextParts.join('\n')}
Conteúdo do post: "${params.post_content.slice(0, 300)}"
Objetivo do post: ${params.post_objective || 'awareness'}

Analise este negócio e defina em JSON:
{
  "visual_identity": {
    "primary_color": "cor principal inferida do setor/marca (ex: verde-esmeralda, azul-royal, terracota)",
    "secondary_color": "cor secundária complementar",
    "mood": "atmosfera visual (ex: acolhedor e familiar, profissional e clean, vibrante e energético)",
    "lighting": "tipo de iluminação ideal (ex: luz natural suave, iluminação de estúdio quente, luz dourada de fim de tarde)",
    "setting": "cenário ideal para o negócio (ex: cozinha moderna bem equipada, consultório clean com plantas, salão de beleza com espelhos e luz quente)"
  },
  "subject": "o que deve aparecer na imagem — seja específico (ex: prato de macarrão artesanal com molho vermelho e manjericão fresco, não apenas 'comida')",
  "composition": "como a imagem deve ser composta (ex: close-up do produto com fundo desfocado, pessoa satisfeita em primeiro plano, produto em destaque com ambiente ao fundo)",
  "avoid": "o que evitar (ex: stock photos genéricas, pessoas com rostos visíveis, elementos que remetam a franquias)"
}

Gere APENAS o JSON.`
    }]
  })

  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean)
}

// ── ETAPA 2: Prompt Generation ─────────────────────────────────────────────

function buildImagePrompt(brandResearch: any, params: GenerateImageParams): string {
  const style = params.visual_style || 'lifestyle'
  const isStory = params.channel === 'instagram_stories'

  const styleDirectives: Record<string, string> = {
    produto: 'product photography, hero shot, clean background, professional lighting',
    lifestyle: 'lifestyle photography, authentic moment, warm atmosphere, real environment',
    emocional: 'emotional photography, human connection, genuine expression, soft focus background',
    minimalista: 'minimalist composition, negative space, single subject, clean aesthetic',
    bold_graphic: 'bold composition, high contrast, striking visual, graphic elements',
  }

  const vi = brandResearch.visual_identity || {}

  return [
    brandResearch.subject || `${params.segment} em ${params.location}`,
    brandResearch.composition || 'composição equilibrada, sujeito em destaque',
    `Color palette: ${vi.primary_color || 'warm tones'} and ${vi.secondary_color || 'neutral'}.`,
    `Mood: ${vi.mood || 'acolhedor e profissional'}.`,
    `Lighting: ${vi.lighting || 'luz natural suave'}.`,
    `Setting: ${vi.setting || `ambiente típico de ${params.segment}`}.`,
    styleDirectives[style] || styleDirectives.lifestyle,
    'photorealistic, high quality, sharp focus, 8k resolution',
    isStory ? '9:16 vertical format' : '1:1 square format',
    'no text overlays, no watermarks, no logos',
    `avoid: ${brandResearch.avoid || 'stock photos genéricas'}`,
    'Brazilian local business aesthetic, authentic and trustworthy',
  ].join('. ')
}

// ── ETAPA 3: Image Generation ──────────────────────────────────────────────

export async function generatePostImage(
  params: GenerateImageParams
): Promise<string | null> {
  if (!process.env.FAL_API_KEY) {
    console.warn("[generateImage] FAL_API_KEY não configurada — pulando geração de imagem")
    return null
  }

  try {
    // Etapa 1: Brand research via Claude Haiku
    let brandResearch: any
    try {
      brandResearch = await researchBrand(params)
      console.log(`[generateImage] Brand research OK: mood="${brandResearch.visual_identity?.mood}"`)
    } catch (researchErr) {
      console.warn('[generateImage] Brand research falhou, usando fallback:', (researchErr as Error).message)
      brandResearch = {
        subject: `${params.segment} em ${params.location}, cena autêntica brasileira`,
        composition: 'composição equilibrada, sujeito em destaque',
        visual_identity: {
          primary_color: 'warm amber',
          secondary_color: 'cream white',
          mood: 'acolhedor e profissional',
          lighting: 'luz natural suave',
          setting: `ambiente típico de ${params.segment}`,
        },
        avoid: 'stock photos genéricas, cenários estrangeiros',
      }
    }

    // Etapa 2: Build prompt
    const prompt = buildImagePrompt(brandResearch, params)
    console.log(`[generateImage] Prompt (${prompt.length} chars): ${prompt.slice(0, 120)}...`)

    // Etapa 3: Generate image via fal.ai Flux Schnell
    const isStory = params.channel === 'instagram_stories'
    const result = await fal.run("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: isStory ? 'portrait_4_3' : 'square_hd',
        num_inference_steps: 6,
        num_images: 1,
      },
    }) as { data: { images: Array<{ url: string }> } }

    const url = result.data?.images?.[0]?.url ?? null
    if (url) {
      console.log(`[generateImage] OK: ${url.slice(0, 80)}...`)
    }
    return url
  } catch (err) {
    console.error('[generateImage] Erro:', err)
    return null
  }
}
