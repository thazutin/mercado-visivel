// src/lib/generateImage.ts
// Pipeline de geração de imagens para posts
// Prioridade 1: fal.ai Flux Schnell (imagem real, ~2s, $0.003/img)
// Prioridade 2: Vercel OG tipográfica (fallback gratuito)

import { ImageResponse } from 'next/og'
import Anthropic from '@anthropic-ai/sdk'

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
  post_objective?: string
  visual_style?: string
}

interface BrandColors {
  primary_color: string
  secondary_color: string
  text_color: string
  accent: string
}

// ── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

export async function generatePostImage(
  params: GenerateImageParams
): Promise<string | null> {
  // Prioridade 1: fal.ai (imagem real de alta qualidade)
  if (process.env.FAL_API_KEY) {
    try {
      const result = await generateWithFal(params)
      if (result) return result
    } catch (err) {
      console.warn('[generateImage] fal.ai failed, falling back to typographic:', (err as Error).message)
    }
  }

  // Prioridade 2: Vercel OG tipográfica (fallback)
  return generateTypographicImage(params)
}

// ── FAL.AI — Imagem real via Flux Schnell ─────────────────────────────────────

async function generateWithFal(params: GenerateImageParams): Promise<string | null> {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) return null

  const isStory = params.channel === 'instagram_stories'
  const width = 1080
  const height = isStory ? 1920 : 1080

  // Gerar prompt visual via Claude
  const visualPrompt = await generateVisualPrompt(params)
  console.log(`[generateImage/fal] Prompt: "${visualPrompt.slice(0, 100)}..."`)

  const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: visualPrompt,
      image_size: isStory ? { width: 768, height: 1344 } : { width: 1024, height: 1024 },
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    console.error(`[generateImage/fal] HTTP ${response.status}: ${await response.text()}`)
    return null
  }

  const data = await response.json()
  const imageUrl = data.images?.[0]?.url

  if (!imageUrl) {
    console.warn('[generateImage/fal] No image URL in response')
    return null
  }

  console.log(`[generateImage/fal] Image OK: ${imageUrl.slice(0, 80)}...`)
  return imageUrl
}

async function generateVisualPrompt(params: GenerateImageParams): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `Professional photograph of a ${params.segment} business in Brazil, warm lighting, inviting atmosphere, editorial style, high quality`
  }

  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0.4,
      messages: [{
        role: 'user',
        content: `Gere um prompt curto (máx 80 palavras) para gerar uma imagem profissional para este post de ${params.segment} em ${params.location}:

"${params.post_content.slice(0, 200)}"

Estilo: fotografia editorial profissional, iluminação quente, alta qualidade.
NÃO inclua texto na imagem. NÃO inclua logos ou marcas.
Foque em: ambiente, produto, pessoas reais, atmosfera.
Responda APENAS com o prompt em inglês.`
      }],
    })
    return res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim()
  } catch {
    return `Professional editorial photograph of a ${params.segment} business, warm ambient lighting, inviting atmosphere, high quality, no text overlay`
  }
}

// ── TYPOGRAPHIC IMAGE (Vercel OG fallback) ────────────────────────────────────

async function generateTypographicImage(params: GenerateImageParams): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[generateImage] ANTHROPIC_API_KEY não configurada — pulando")
    return null
  }

  try {
    let colors: BrandColors
    try {
      colors = await researchBrand(params)
    } catch {
      colors = { primary_color: '#1C1917', secondary_color: '#292524', text_color: '#FAFAF9', accent: '#C9913A' }
    }

    const isStory = params.channel === 'instagram_stories'
    const width = 1080
    const height = isStory ? 1920 : 1080
    const hookFontSize = isStory ? 80 : 72
    const hook = extractHook(params.post_content)

    const fontData = await fetch(
      'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
    ).then(r => r.arrayBuffer())

    const element = (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', alignItems: 'flex-start',
        backgroundColor: colors.primary_color, padding: '80px', fontFamily: 'Inter',
      }}>
        <div style={{ fontSize: 24, color: colors.text_color, opacity: 0.6, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
          {params.business_name}
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: hookFontSize, fontWeight: 700, color: colors.text_color, lineHeight: 1.2, textAlign: 'center', width: '100%' }}>
            {hook}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 22, color: colors.accent, opacity: 0.8 }}>
          <span>{params.location}</span>
          <span>{params.segment}</span>
        </div>
      </div>
    )

    const response = new ImageResponse(element, {
      width, height,
      fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }],
    })

    const buffer = await response.arrayBuffer()
    const base64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`
    console.log(`[generateImage] Typographic OK: ${width}x${height}, ${Math.round(buffer.byteLength / 1024)}KB`)
    return base64
  } catch (err) {
    console.error('[generateImage] Typographic error:', err)
    return null
  }
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

async function researchBrand(params: GenerateImageParams): Promise<BrandColors> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Defina 4 cores hex para ${params.business_name} (${params.segment} em ${params.location}).
primary_color: fundo escuro. secondary_color: complementar. text_color: alto contraste. accent: destaque.
JSON: {"primary_color":"#hex","secondary_color":"#hex","text_color":"#hex","accent":"#hex"}`
    }]
  })
  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
  return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())
}

function extractHook(content: string): string {
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  const hook = lines[0] || content
  if (hook.length > 100) return hook.slice(0, 97) + '...'
  return hook
}
