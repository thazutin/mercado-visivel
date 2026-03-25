// src/lib/generateImage.ts
// Geração de imagens tipográficas para posts via @vercel/og (ImageResponse)
// Pipeline: Brand Research (Claude Haiku) → Typographic Image Generation

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

// ── ETAPA 1: Brand Research ────────────────────────────────────────────────

async function researchBrand(params: GenerateImageParams): Promise<BrandColors> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const contextParts: string[] = [
    `Negócio: ${params.business_name}`,
    `Setor: ${params.segment}`,
    `Localização: ${params.location}`,
    `Diferencial: ${params.differentiator || 'não informado'}`,
  ]

  if (params.site) contextParts.push(`Site: ${params.site}`)
  if (params.instagram) contextParts.push(`Instagram: @${params.instagram}`)

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Você é um diretor de arte especialista em identidade visual de negócios locais brasileiros.

${contextParts.join('\n')}

Defina 4 cores em hex para a identidade visual deste negócio.
- primary_color: cor principal do background (escura ou vibrante, que funcione como fundo)
- secondary_color: cor secundária complementar
- text_color: cor do texto principal — DEVE ter alto contraste com primary_color (#ffffff ou #000000 na maioria dos casos)
- accent: cor de destaque para detalhes (localização, segmento)

Responda APENAS em JSON:
{"primary_color": "#hex", "secondary_color": "#hex", "text_color": "#hex", "accent": "#hex"}

Gere APENAS o JSON.`
    }]
  })

  const text = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean)
}

// ── ETAPA 2: Typographic Image Generation ─────────────────────────────────

function extractHook(content: string): string {
  // Pega a primeira linha não-vazia como hook, ou primeiros 120 chars
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  const hook = lines[0] || content
  // Limita a ~100 chars para caber em 3 linhas
  if (hook.length > 100) return hook.slice(0, 97) + '...'
  return hook
}

export async function generatePostImage(
  params: GenerateImageParams
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[generateImage] ANTHROPIC_API_KEY não configurada — pulando geração de imagem")
    return null
  }

  try {
    // Etapa 1: Brand research via Claude Haiku
    let colors: BrandColors
    try {
      colors = await researchBrand(params)
      console.log(`[generateImage] Brand colors OK: bg=${colors.primary_color} text=${colors.text_color}`)
    } catch (researchErr) {
      console.warn('[generateImage] Brand research falhou, usando fallback:', (researchErr as Error).message)
      colors = {
        primary_color: '#1a1a2e',
        secondary_color: '#16213e',
        text_color: '#ffffff',
        accent: '#e94560',
      }
    }

    // Etapa 2: Render typographic image via ImageResponse
    const isStory = params.channel === 'instagram_stories'
    const width = 1080
    const height = isStory ? 1920 : 1080
    const hookFontSize = isStory ? 80 : 72
    const padding = 80

    const hook = extractHook(params.post_content)

    // Fetch Inter Bold font for ImageResponse
    const fontData = await fetch(
      'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2'
    ).then(r => r.arrayBuffer())

    const element = (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          backgroundColor: colors.primary_color,
          padding: `${padding}px`,
          fontFamily: 'Inter',
        }}
      >
        {/* Topo: nome do negócio */}
        <div
          style={{
            fontSize: 24,
            color: colors.text_color,
            opacity: 0.6,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
          }}
        >
          {params.business_name}
        </div>

        {/* Centro: hook do post */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: hookFontSize,
              fontWeight: 700,
              color: colors.text_color,
              lineHeight: 1.2,
              textAlign: 'center',
              width: '100%',
            }}
          >
            {hook}
          </div>
        </div>

        {/* Rodapé: localização + segmento */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: 22,
            color: colors.accent,
            opacity: 0.8,
          }}
        >
          <span>{params.location}</span>
          <span>{params.segment}</span>
        </div>
      </div>
    )

    const response = new ImageResponse(element, {
      width,
      height,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    })

    const buffer = await response.arrayBuffer()
    const base64 = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`
    console.log(`[generateImage] Typographic image OK: ${width}x${height}, ${Math.round(buffer.byteLength / 1024)}KB`)
    return base64
  } catch (err) {
    console.error('[generateImage] Erro:', err)
    return null
  }
}
