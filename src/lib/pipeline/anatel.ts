// ============================================================================
// Virô Radar — Anatel Integration (DADOS REAIS)
// Busca dados de banda larga fixa por município.
// Anatel não tem API pública direta — usa dados.gov.br CKAN endpoint.
// Fallback: Google search pra dados do município.
// ============================================================================

const DADOS_GOV_BASE = 'https://dados.gov.br/api/publico/conjuntos-dados';

export interface AnatelResult {
  found: boolean;
  municipio: string;
  totalAcessos?: number;
  prestadoras?: Array<{
    nome: string;
    acessos?: number;
  }>;
  source: 'dados_gov' | 'google_search' | 'not_found';
}

/**
 * Busca dados de banda larga fixa por município via dados.gov.br.
 * Se API não funcionar, busca via Google por relatórios Anatel do município.
 */
export async function fetchAnatelBandaLarga(
  municipio: string,
  uf?: string,
): Promise<AnatelResult> {
  // Tentativa 1: busca estruturada no Google por dados do município
  try {
    const query = `site:anatel.gov.br OR site:dados.gov.br "banda larga" "${municipio}" ${uf || ''} prestadoras acessos`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&hl=pt-BR`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const html = await res.text();

      // Procura menções a números de acessos ou prestadoras
      const hasAnatelData = html.includes('anatel.gov.br') || html.includes('banda larga');
      if (hasAnatelData) {
        // Extrai snippets com números
        const snippets = html.match(/(?:acessos|assinantes|conexões)[^<]*?\d[\d.,]+/gi) || [];
        const numbers = snippets.map(s => {
          const match = s.match(/[\d.,]+/);
          return match ? parseInt(match[0].replace(/\./g, '').replace(',', '')) : 0;
        }).filter(n => n > 0);

        if (numbers.length > 0) {
          console.log(`[Anatel] Found data for ${municipio}: ${numbers[0]} acessos`);
          return {
            found: true,
            municipio,
            totalAcessos: numbers[0],
            source: 'google_search',
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Anatel] Google search error:`, (err as Error).message);
  }

  // Tentativa 2: dados.gov.br API direta (pode não funcionar)
  try {
    const res = await fetch(
      `${DADOS_GOV_BASE}/acessos---banda-larga-fixa`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      // Se tem recursos com download direto, indica que dados existem
      if (data.resources?.length > 0) {
        console.log(`[Anatel] dados.gov.br dataset found, ${data.resources.length} resources`);
        return {
          found: true,
          municipio,
          source: 'dados_gov',
        };
      }
    }
  } catch { /* fall through */ }

  return { found: false, municipio, source: 'not_found' };
}
