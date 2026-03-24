// src/lib/generateImage.ts
// Geração de imagens para posts via fal.ai (Flux Schnell — ~2s, $0.003/img)

import { fal } from "@fal-ai/client"

fal.config({ credentials: process.env.FAL_API_KEY })

export async function generatePostImage(params: {
  business_name: string
  segment: string
  location: string
  post_content: string
  channel: string
  rating?: number | null
  reviewCount?: number | null
}): Promise<string | null> {
  if (!process.env.FAL_API_KEY) {
    console.warn("[generateImage] FAL_API_KEY não configurada — pulando geração de imagem")
    return null
  }

  try {
    // Build contextual style based on segment and business data
    const lower = params.segment.toLowerCase()
    let subjectMood = "authentic, trustworthy, neighborhood business"
    let subject = `${params.segment} environment, products and services`

    if (/restaurante|lanchonete|padaria|café|cafeteria|bar|pizzaria|comida|sushi/.test(lower)) {
      subject = "beautifully plated food, cozy restaurant interior, warm lighting"
      subjectMood = "appetizing, welcoming, homemade quality"
    } else if (/clínica|médic|odonto|dentist|saúde|fisio|psicol|nutri|estética/.test(lower)) {
      subject = "clean medical/wellness office, professional care, calm atmosphere"
      subjectMood = "professional, caring, trustworthy, clean"
    } else if (/salão|barbearia|beleza|cabeleir|unha|makeup|spa/.test(lower)) {
      subject = "beauty salon interior, styling tools, mirror reflection"
      subjectMood = "glamorous, inviting, self-care, confidence"
    } else if (/academia|fitness|crossfit|pilates|yoga|personal/.test(lower)) {
      subject = "gym equipment, workout space, energetic atmosphere"
      subjectMood = "energetic, motivational, healthy lifestyle"
    } else if (/advogad|contábil|contador|escritório|consultor/.test(lower)) {
      subject = "professional office, meeting room, business setting"
      subjectMood = "professional, authoritative, reliable"
    } else if (/loja|varejo|moda|roupa|calçado|acessório/.test(lower)) {
      subject = "retail store display, products on shelves, shopping experience"
      subjectMood = "curated, trendy, inviting storefront"
    } else if (/pet|veterinár|animal|cachorro|gato/.test(lower)) {
      subject = "cute pets, veterinary care, animal wellness"
      subjectMood = "loving, caring, playful, trustworthy"
    }

    const hasReputation = params.rating && params.rating >= 4 && params.reviewCount && params.reviewCount > 10

    const prompt = `Professional social media image for a local Brazilian business.
Business: ${params.business_name}, ${params.segment} in ${params.location}.
Subject: ${subject}.
Mood: ${subjectMood}.
Style: warm, inviting, local business in Brazil. ${hasReputation ? "Well-established, trusted by community." : "Authentic, neighborhood feel."}
No text overlays, no watermarks. Suitable for ${params.channel}.
High quality, 1:1 aspect ratio, photorealistic.`

    const result = await fal.run("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: "square_hd",
        num_inference_steps: 4,
        num_images: 1,
      },
    }) as { data: { images: Array<{ url: string }> } }

    const url = result.data?.images?.[0]?.url ?? null
    if (url) {
      console.log(`[generateImage] Imagem gerada para ${params.channel}: ${url.slice(0, 80)}...`)
    }
    return url
  } catch (err) {
    console.error("[generateImage] Erro:", err)
    return null
  }
}
