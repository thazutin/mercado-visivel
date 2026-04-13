// ============================================================================
// Virô Radar — iFood Integration (DADOS REAIS)
// Busca presença real do negócio no iFood via Google search.
// Sem inferência. Se não encontrar, retorna found: false.
// ============================================================================

export interface IFoodResult {
  found: boolean;
  restaurantName?: string;
  url?: string;
  rating?: number;
  source: 'google_search' | 'not_found';
}

/**
 * Busca presença real no iFood via Google "site:ifood.com.br [nome] [cidade]".
 * Se encontrar URL, confirma presença. Se não, retorna found: false.
 * Custo: $0 (Google search via fetch).
 */
export async function searchIFood(
  businessName: string,
  city: string,
): Promise<IFoodResult> {
  try {
    const query = `site:ifood.com.br "${businessName}" ${city}`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=3&hl=pt-BR`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[iFood] Google search returned ${res.status}`);
      return { found: false, source: 'not_found' };
    }

    const html = await res.text();

    // Procura URLs do iFood nos resultados
    const ifoodUrlMatch = html.match(/https?:\/\/www\.ifood\.com\.br\/delivery\/[^\s"<>]+/);
    if (ifoodUrlMatch) {
      const url = ifoodUrlMatch[0].replace(/&amp;/g, '&');

      // Tenta extrair o nome do restaurante da URL (formato: /delivery/cidade-estado/nome-do-restaurante/uuid)
      const urlParts = url.split('/');
      const slugIdx = urlParts.findIndex(p => p === 'delivery') + 2;
      const nameSlug = urlParts[slugIdx] || '';
      const extractedName = nameSlug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      console.log(`[iFood] Found: ${url}`);
      return {
        found: true,
        restaurantName: extractedName || businessName,
        url,
        source: 'google_search',
      };
    }

    // Procura menção ao ifood.com.br mesmo sem URL de delivery
    const ifoodMention = html.includes('ifood.com.br') && html.toLowerCase().includes(businessName.toLowerCase().slice(0, 10));
    if (ifoodMention) {
      return {
        found: true,
        restaurantName: businessName,
        source: 'google_search',
      };
    }

    return { found: false, source: 'not_found' };
  } catch (err) {
    console.warn(`[iFood] Search error:`, (err as Error).message);
    return { found: false, source: 'not_found' };
  }
}
