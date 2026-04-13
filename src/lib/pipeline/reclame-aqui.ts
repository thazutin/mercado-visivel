// ============================================================================
// Virô Radar — Reclame Aqui Integration
// Busca reputação de um negócio no Reclame Aqui (scrape via fetch).
// ============================================================================

export interface ReclameAquiResult {
  found: boolean;
  companyName?: string;
  score?: number;                  // 0-10
  totalComplaints?: number;
  responseRate?: number;           // 0-100%
  resolutionRate?: number;         // 0-100%
  wouldBuyAgain?: number;          // 0-100%
  reputation?: string;            // "Ótimo", "Bom", "Regular", "Ruim", "Não Recomendada"
  url?: string;
  topComplaints?: string[];        // Top 3 motivos de reclamação
}

/**
 * Busca reputação no Reclame Aqui.
 * Usa a API pública de busca do RA (mesmo endpoint que o site usa).
 * Custo: $0 (scrape direto).
 */
export async function searchReclameAqui(
  businessName: string,
): Promise<ReclameAquiResult> {
  try {
    const searchUrl = `https://www.reclameaqui.com.br/busca/?q=${encodeURIComponent(businessName)}`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[ReclameAqui] Search returned ${res.status}`);
      return { found: false };
    }

    const html = await res.text();

    // Tenta extrair dados do JSON embutido na página
    const scriptMatch = html.match(/__NEXT_DATA__.*?>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      try {
        const nextData = JSON.parse(scriptMatch[1]);
        const companies = nextData?.props?.pageProps?.companies || [];
        if (companies.length > 0) {
          const company = companies[0];
          return {
            found: true,
            companyName: company.companyName || company.name,
            score: company.score || null,
            totalComplaints: company.complaintsCount || null,
            responseRate: company.responsePercentage || null,
            resolutionRate: company.solutionPercentage || null,
            wouldBuyAgain: company.dealAgainPercentage || null,
            reputation: company.reputation || null,
            url: company.uri ? `https://www.reclameaqui.com.br${company.uri}` : null,
          };
        }
      } catch {
        // JSON parse failed, try regex fallback
      }
    }

    // Regex fallback pra extrair dados básicos
    const nameMatch = html.match(/data-company-name="([^"]+)"/);
    const scoreMatch = html.match(/data-company-score="([^"]+)"/);
    const reputationMatch = html.match(/class="reputation[^"]*"[^>]*>([^<]+)</);

    if (nameMatch) {
      return {
        found: true,
        companyName: nameMatch[1],
        score: scoreMatch ? parseFloat(scoreMatch[1]) : undefined,
        reputation: reputationMatch ? reputationMatch[1].trim() : undefined,
        url: searchUrl,
      };
    }

    return { found: false };
  } catch (err) {
    console.warn(`[ReclameAqui] Error searching "${businessName}":`, (err as Error).message);
    return { found: false };
  }
}
