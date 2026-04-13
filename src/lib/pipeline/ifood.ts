// ============================================================================
// Virô Radar — iFood Integration
// Busca dados do negócio no iFood (se aplicável).
// Usa a API pública do iFood (mesma que o app/site usa pra busca).
// ============================================================================

export interface IFoodResult {
  found: boolean;
  restaurantName?: string;
  rating?: number;               // 0-5
  reviewCount?: number;
  deliveryTime?: string;         // "30-40 min"
  deliveryFee?: number;          // em reais
  isOpen?: boolean;
  categories?: string[];
  priceRange?: string;           // "$", "$$", "$$$"
  url?: string;
  topCategories?: string[];
}

/**
 * Busca restaurante no iFood pela API de busca pública.
 * Custo: $0 (API pública).
 * Nota: iFood bloqueia muitas requests — usar com parcimônia.
 */
export async function searchIFood(
  businessName: string,
  city: string,
): Promise<IFoodResult> {
  try {
    // iFood API v1 — busca por nome + cidade
    // Nota: essa API pode mudar ou bloquear. Fallback: Apify scraper.
    const searchUrl = `https://marketplace.ifood.com.br/v1/merchant-list/text-search?term=${encodeURIComponent(businessName)}&size=5&latitude=-23.5505&longitude=-46.6333`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
        'platform': 'Desktop',
        'app_version': '9.0.0',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Fallback: busca via Google com site:ifood.com.br
      return await searchIFoodViaGoogle(businessName, city);
    }

    const data = await res.json();
    const merchants = data?.merchants || data?.results || [];

    if (merchants.length === 0) {
      return { found: false };
    }

    // Tenta encontrar o match mais relevante
    const normalizedName = businessName.toLowerCase().replace(/[^a-zà-ú0-9\s]/g, '');
    const best = merchants.find((m: any) => {
      const mName = (m.name || '').toLowerCase().replace(/[^a-zà-ú0-9\s]/g, '');
      return mName.includes(normalizedName) || normalizedName.includes(mName);
    }) || merchants[0];

    return {
      found: true,
      restaurantName: best.name,
      rating: best.userRating || best.rating,
      reviewCount: best.userRatingCount,
      deliveryTime: best.deliveryTime
        ? `${best.deliveryTime.min || '?'}-${best.deliveryTime.max || '?'} min`
        : undefined,
      deliveryFee: best.deliveryFee?.value,
      isOpen: best.available ?? best.isOpen,
      categories: (best.mainCategory ? [best.mainCategory] : [])
        .concat(best.categories?.map((c: any) => c.name || c) || []),
      url: best.slug
        ? `https://www.ifood.com.br/delivery/${best.slug}`
        : undefined,
    };
  } catch (err) {
    console.warn(`[iFood] Error searching "${businessName}":`, (err as Error).message);
    return { found: false };
  }
}

async function searchIFoodViaGoogle(businessName: string, city: string): Promise<IFoodResult> {
  // Se a API do iFood falhou, usa Claude pra inferir presença
  // Abordagem: verificar se o negócio é do tipo que deveria estar no iFood
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `"${businessName}" em ${city} — é o tipo de negócio que deveria estar no iFood (restaurante, lanchonete, doceria, etc)? Responda APENAS: {"should_be_on_ifood": true/false, "reason": "motivo em 1 frase"}`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (!parsed.should_be_on_ifood) {
        return { found: false };
      }
    }
  } catch {
    // If Claude fails, skip
  }

  return { found: false };
}
