// ============================================================================
// Virô Radar — LinkedIn Integration (DADOS REAIS)
// Busca company page e founder via Google search.
// Sem inferência. Dados reais ou not_found.
// ============================================================================

export interface LinkedInResult {
  companyPage: {
    found: boolean;
    url?: string;
    name?: string;
  };
  founderProfile: {
    found: boolean;
    url?: string;
    name?: string;
  };
  source: 'google_search' | 'form_input' | 'not_found';
}

/**
 * Busca presença no LinkedIn via Google search.
 * Se o dono informou LinkedIn no form, usa direto.
 */
export async function searchLinkedIn(
  businessName: string,
  linkedinInput?: string,
  founderName?: string,
): Promise<LinkedInResult> {
  const result: LinkedInResult = {
    companyPage: { found: false },
    founderProfile: { found: false },
    source: 'not_found',
  };

  // Se o dono informou LinkedIn no form, usa direto
  if (linkedinInput && linkedinInput.includes('linkedin.com')) {
    if (linkedinInput.includes('/company/')) {
      result.companyPage = { found: true, url: linkedinInput };
      result.source = 'form_input';
    } else if (linkedinInput.includes('/in/')) {
      result.founderProfile = { found: true, url: linkedinInput };
      result.source = 'form_input';
    }
  }

  // Busca company page via Google
  if (!result.companyPage.found) {
    try {
      const query = `site:linkedin.com/company "${businessName}"`;
      const html = await googleSearch(query);
      const companyMatch = html.match(/https?:\/\/[a-z]{2,3}\.linkedin\.com\/company\/[^\s"<>&]+/);
      if (companyMatch) {
        result.companyPage = {
          found: true,
          url: companyMatch[0].replace(/&amp;/g, '&'),
          name: businessName,
        };
        result.source = 'google_search';
      }
    } catch { /* fall through */ }
  }

  // Busca founder via Google (se temos nome)
  if (!result.founderProfile.found && founderName) {
    try {
      const query = `site:linkedin.com/in "${founderName}" "${businessName}"`;
      const html = await googleSearch(query);
      const profileMatch = html.match(/https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[^\s"<>&]+/);
      if (profileMatch) {
        result.founderProfile = {
          found: true,
          url: profileMatch[0].replace(/&amp;/g, '&'),
          name: founderName,
        };
        if (result.source === 'not_found') result.source = 'google_search';
      }
    } catch { /* fall through */ }
  }

  return result;
}

async function googleSearch(query: string): Promise<string> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=3&hl=pt-BR`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  return await res.text();
}
