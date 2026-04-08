// ============================================================================
// Virô — Hunter.io integration
// Busca emails + nomes + cargos de decisores em uma empresa a partir do
// domínio. Usado para enriquecer a lista de empresas B2B (CNPJá) com
// contatos individuais acionáveis.
//
// API: https://api.hunter.io/v2/domain-search
// Auth: ?api_key=<HUNTER_API_KEY> na query string
// Custo: 1 search por empresa (plano Free = 50/mês)
// Cada search retorna até `limit` emails da empresa, gratuitamente.
// ============================================================================

const HUNTER_BASE = 'https://api.hunter.io/v2';
const TIMEOUT_MS = 10_000;

export interface HunterContact {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  position?: string | null;
  department?: string | null;
  seniority?: string | null;
  linkedinUrl?: string | null;
  confidence: number; // 0-100
}

export interface HunterDomainResult {
  organization: string;
  domain: string;
  pattern: string | null; // ex: "{first}.{last}" — padrão de construção de emails
  totalFound: number;
  contacts: HunterContact[];
}

// ─── DOMAIN EXTRACTION ──────────────────────────────────────────────────────

/**
 * Extrai o domínio limpo de uma string (email, URL ou domínio puro).
 * Retorna null se não conseguir extrair algo razoável.
 */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // Se é email: pega depois do @
  if (s.includes('@')) {
    const after = s.split('@')[1];
    return normalizeDomain(after);
  }

  // Se é URL
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s);
      return normalizeDomain(u.hostname);
    } catch {
      return null;
    }
  }

  // Domínio puro
  return normalizeDomain(s);
}

function normalizeDomain(d: string): string | null {
  const clean = d
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
  // Descarta provedores genéricos (não são domínios corporativos)
  const genericProviders = new Set([
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
    'icloud.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br',
    'live.com', 'msn.com', 'protonmail.com',
  ]);
  if (genericProviders.has(clean)) return null;
  // Validação mínima: tem pelo menos um ponto e caracteres válidos
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return null;
  return clean;
}

// ─── MAIN SEARCH ────────────────────────────────────────────────────────────

/**
 * Busca contatos de uma empresa pelo domínio via Hunter.io Domain Search.
 * Retorna null se:
 *   - HUNTER_API_KEY não está setada
 *   - API retorna erro
 *   - Domínio não tem resultados
 *
 * Consome 1 search do plano mensal (50/mês no Free).
 */
export async function searchContactsByDomain(
  domain: string,
  options?: { limit?: number; preferDecisionMakers?: boolean },
): Promise<HunterDomainResult | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.warn('[Hunter] HUNTER_API_KEY não configurada — pulando enriquecimento de contatos');
    return null;
  }

  const cleanDomain = normalizeDomain(domain);
  if (!cleanDomain) {
    console.warn(`[Hunter] Domínio inválido: "${domain}"`);
    return null;
  }

  const limit = Math.min(options?.limit || 5, 10);

  // Hunter aceita filtro por department (executive, it, finance, sales, marketing, hr, management)
  // Para decision-makers, priorizamos: executive + management + finance + sales
  const params = new URLSearchParams({
    domain: cleanDomain,
    limit: String(limit),
    api_key: apiKey,
  });
  if (options?.preferDecisionMakers) {
    // Hunter não aceita múltiplos departments em uma única chamada — escolhemos executive
    params.set('department', 'executive');
  }

  const url = `${HUNTER_BASE}/domain-search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Viro/1.0 (virolocal.com)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[Hunter] HTTP ${response.status} para ${cleanDomain}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();

    // Checa erros estruturados do Hunter (ex: restricted_account, rate limit)
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      console.warn(`[Hunter] API error para ${cleanDomain}:`, data.errors);
      return null;
    }

    const d = data.data || {};
    const emails: any[] = d.emails || [];

    if (emails.length === 0) {
      console.log(`[Hunter] ${cleanDomain}: 0 contatos encontrados`);
      return null;
    }

    // Ordena por confidence desc, priorizando quem tem nome completo + cargo
    const contacts: HunterContact[] = emails
      .map((e) => ({
        email: e.value || '',
        firstName: e.first_name || null,
        lastName: e.last_name || null,
        fullName: [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || null,
        position: e.position || null,
        department: e.department || null,
        seniority: e.seniority || null,
        linkedinUrl: e.linkedin || null,
        confidence: typeof e.confidence === 'number' ? e.confidence : 0,
      }))
      .filter((c) => c.email)
      .sort((a, b) => {
        // Prioriza quem tem nome + cargo, depois confidence
        const aRich = (a.fullName ? 2 : 0) + (a.position ? 1 : 0);
        const bRich = (b.fullName ? 2 : 0) + (b.position ? 1 : 0);
        if (aRich !== bRich) return bRich - aRich;
        return b.confidence - a.confidence;
      })
      .slice(0, limit);

    console.log(
      `[Hunter] ${cleanDomain}: ${contacts.length} contatos retornados (${emails.length} total encontrados, org="${d.organization || '?'}")`,
    );

    return {
      organization: d.organization || cleanDomain,
      domain: cleanDomain,
      pattern: d.pattern || null,
      totalFound: d.meta?.results ?? emails.length,
      contacts,
    };
  } catch (err) {
    console.warn(`[Hunter] Erro em ${cleanDomain}:`, (err as Error).message);
    return null;
  }
}

/**
 * Dado uma lista de empresas (com email corporativo OU domínio conhecido),
 * enriquece cada uma com até `limitPerCompany` contatos do Hunter.
 *
 * ATENÇÃO: consome 1 crédito Hunter por empresa. Com plano Free de 50/mês,
 * chamar isso pra 10 empresas = 10 créditos. Use com cuidado.
 */
export async function enrichCompaniesWithContacts<T extends { email?: string | null; website?: string | null; razaoSocial?: string }>(
  companies: T[],
  options?: { limitPerCompany?: number; maxCompanies?: number },
): Promise<Array<T & { contacts?: HunterContact[]; contactsSource?: string }>> {
  const limitPerCompany = options?.limitPerCompany || 3;
  const maxCompanies = options?.maxCompanies || 10;

  const enriched: Array<T & { contacts?: HunterContact[]; contactsSource?: string }> = [];
  let budgetUsed = 0;

  for (const company of companies.slice(0, maxCompanies)) {
    // Tenta extrair domínio do email ou website
    const domain =
      extractDomain(company.website) ||
      extractDomain(company.email) ||
      null;

    if (!domain) {
      enriched.push({ ...company });
      continue;
    }

    const result = await searchContactsByDomain(domain, { limit: limitPerCompany });
    budgetUsed++;

    if (result && result.contacts.length > 0) {
      enriched.push({
        ...company,
        contacts: result.contacts,
        contactsSource: `Hunter.io (${result.totalFound} encontrados)`,
      });
    } else {
      enriched.push({ ...company });
    }
  }

  // Inclui as empresas extras (sem enriquecimento) para não perder
  if (companies.length > maxCompanies) {
    for (const c of companies.slice(maxCompanies)) {
      enriched.push({ ...c });
    }
  }

  console.log(`[Hunter] Budget usado: ${budgetUsed} searches para ${Math.min(companies.length, maxCompanies)} empresas`);
  return enriched;
}
