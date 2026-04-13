// ============================================================================
// Virô Radar — Mercado Livre Integration (DADOS REAIS)
// API pública do ML: busca vendedores, reputação, vendas.
// Sem inferência. Dados reais ou not_found.
// ============================================================================

export interface MLSellerResult {
  found: boolean;
  sellerName?: string;
  sellerId?: string;
  reputation?: {
    level: string;           // "5_green", "4_light_green", etc
    powerSellerStatus?: string; // "platinum", "gold", etc
    transactions?: number;
    ratings?: { positive: number; neutral: number; negative: number };
  };
  activeListings?: number;
  permalink?: string;
  source: 'ml_api' | 'google_search' | 'not_found';
}

/**
 * Busca vendedor no Mercado Livre pela API pública.
 * ML API é aberta, não precisa de token pra buscas públicas.
 */
export async function searchMercadoLivre(
  businessName: string,
  product?: string,
): Promise<MLSellerResult> {
  // Estratégia 1: busca por produto pra encontrar vendedores
  try {
    const searchTerm = product ? `${product} ${businessName}` : businessName;
    const apiUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&limit=10`;

    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];

      // Procura vendedor cujo nome contenha o businessName
      const normalizedName = businessName.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúüç0-9\s]/g, '');
      for (const item of results) {
        const seller = item.seller;
        if (!seller) continue;

        const sellerName = (seller.nickname || '').toLowerCase();
        if (sellerName.includes(normalizedName.slice(0, 8)) || normalizedName.includes(sellerName.slice(0, 8))) {
          // Encontrou! Busca detalhes do vendedor
          return await fetchSellerDetails(seller.id, seller.nickname);
        }
      }

      // Se não encontrou pelo nome, busca pelo nome direto
      return await searchSellerByName(businessName);
    }
  } catch (err) {
    console.warn(`[ML] API search error:`, (err as Error).message);
  }

  // Fallback: Google search
  return await searchMLViaGoogle(businessName);
}

async function fetchSellerDetails(sellerId: number, sellerName: string): Promise<MLSellerResult> {
  try {
    const res = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const user = await res.json();
      const rep = user.seller_reputation || {};
      const transactions = rep.transactions?.total || 0;
      const ratings = rep.transactions?.ratings || {};

      return {
        found: true,
        sellerName: user.nickname || sellerName,
        sellerId: String(sellerId),
        reputation: {
          level: rep.level_id || 'unknown',
          powerSellerStatus: rep.power_seller_status || null,
          transactions,
          ratings: {
            positive: Math.round((ratings.positive || 0) * 100),
            neutral: Math.round((ratings.neutral || 0) * 100),
            negative: Math.round((ratings.negative || 0) * 100),
          },
        },
        activeListings: user.seller_reputation?.transactions?.total || 0,
        permalink: user.permalink || `https://www.mercadolivre.com.br/perfil/${user.nickname}`,
        source: 'ml_api',
      };
    }
  } catch (err) {
    console.warn(`[ML] Seller details error:`, (err as Error).message);
  }

  return { found: true, sellerName, sellerId: String(sellerId), source: 'ml_api' };
}

async function searchSellerByName(name: string): Promise<MLSellerResult> {
  try {
    // ML não tem endpoint de busca por vendedor. Usa busca por produto do vendedor.
    const res = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?nickname=${encodeURIComponent(name)}&limit=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]?.seller) {
        const seller = data.results[0].seller;
        return await fetchSellerDetails(seller.id, seller.nickname);
      }
    }
  } catch { /* fall through */ }
  return { found: false, source: 'not_found' };
}

async function searchMLViaGoogle(businessName: string): Promise<MLSellerResult> {
  try {
    const query = `site:mercadolivre.com.br/perfil "${businessName}"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=3&hl=pt-BR`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const html = await res.text();
      const mlUrlMatch = html.match(/https?:\/\/www\.mercadolivre\.com\.br\/perfil\/[^\s"<>]+/);
      if (mlUrlMatch) {
        const url = mlUrlMatch[0].replace(/&amp;/g, '&');
        const nickname = url.split('/perfil/')[1]?.split(/[?#]/)[0] || '';
        console.log(`[ML] Found via Google: ${url}`);
        return {
          found: true,
          sellerName: nickname.replace(/[+_-]/g, ' '),
          permalink: url,
          source: 'google_search',
        };
      }
    }
  } catch { /* fall through */ }

  return { found: false, source: 'not_found' };
}
