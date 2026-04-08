// ============================================================================
// Virô — B2B Company Search
// Busca empresas-alvo para leads B2B via Brasil.io + CNPJ.ws
// Exibido no InstantValueScreen e usado no plano de ação
// ============================================================================

import { buscarEmpresasBrasilIO, type BrasilIOCompany } from './brasil-io';

export interface B2BCompany {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  porte: string;
  municipio: string;
  uf: string;
  cnaeDescricao: string;
  email?: string;
  telefone?: string;
  situacao: string;
  enriched: boolean;
}

export interface B2BCompanyResult {
  companies: B2BCompany[];
  totalInRegion: number;
  source: string;
  enrichedCount: number;
}

const CNPJWS_BASE = 'https://publica.cnpj.ws/cnpj';
const CNPJWS_RATE_LIMIT_MS = 21_000; // 3 req/min = 1 req a cada 20s + margem
const CNPJWS_TIMEOUT_MS = 8_000;

/**
 * Busca e enriquece empresas B2B na região do lead.
 * 1. Brasil.io: busca por CNAE + município (bulk)
 * 2. CNPJ.ws: enriquece top N com email/telefone (rate limited)
 *
 * @param product - Produto/serviço do lead
 * @param municipio - Nome do município
 * @param uf - UF (2 letras)
 * @param options - enrichLimit: quantas empresas enriquecer (default 5, max 10)
 */
export async function searchB2BCompanies(
  product: string,
  municipio: string,
  uf?: string,
  options?: { enrichLimit?: number; differentiator?: string },
): Promise<B2BCompanyResult | null> {
  const enrichLimit = Math.min(options?.enrichLimit || 5, 10);

  // Step 1: Buscar empresas via Brasil.io
  const brasilIOResult = await buscarEmpresasBrasilIO(product, municipio, uf, {
    limit: 20,
    differentiator: options?.differentiator,
  });

  if (!brasilIOResult || brasilIOResult.empresas.length === 0) {
    console.log('[B2B] Nenhuma empresa encontrada via Brasil.io');
    return null;
  }

  // Step 2: Converter para B2BCompany
  const companies: B2BCompany[] = brasilIOResult.empresas.map(e => ({
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj,
    porte: e.porte,
    municipio: e.municipio,
    uf: e.uf,
    cnaeDescricao: e.cnaeDescricao,
    situacao: e.situacao,
    enriched: false,
  }));

  // Step 3: Enriquecer top N com CNPJ.ws (respeitando rate limit)
  let enrichedCount = 0;
  const toEnrich = companies.slice(0, enrichLimit);

  for (const company of toEnrich) {
    const enriched = await enrichWithCNPJws(company.cnpj);
    if (enriched) {
      company.email = enriched.email || undefined;
      company.telefone = enriched.telefone || undefined;
      company.nomeFantasia = enriched.nomeFantasia || undefined;
      company.enriched = true;
      enrichedCount++;
    }

    // Rate limit: esperar entre chamadas (3 req/min max)
    if (enrichLimit > 1) {
      await new Promise(resolve => setTimeout(resolve, CNPJWS_RATE_LIMIT_MS));
    }
  }

  console.log(`[B2B] ${companies.length} empresas, ${enrichedCount} enriquecidas via CNPJ.ws`);

  return {
    companies,
    totalInRegion: brasilIOResult.totalEmpresas,
    source: `Brasil.io + CNPJ.ws (${enrichedCount} enriquecidas)`,
    enrichedCount,
  };
}

/**
 * Versão light — só busca empresas sem enriquecer (instantânea).
 * Usada no pipeline principal (não bloqueia).
 *
 * Provider primário: CNPJá (https://cnpja.com) — pago, ~R$25/mês.
 * Fallback: Brasil.io (depende de BRASIL_IO_TOKEN).
 */
export async function searchB2BCompaniesLight(
  product: string,
  municipio: string,
  uf?: string,
): Promise<B2BCompanyResult | null> {
  // Tenta CNPJá primeiro (mais confiável, dados frescos da Receita Federal)
  if (process.env.CNPJA_API_KEY) {
    try {
      const { buscarEmpresasCnpja } = await import('./cnpja');
      const cnpjaResult = await buscarEmpresasCnpja(product, municipio, uf, { limit: 10 });
      if (cnpjaResult && cnpjaResult.empresas.length > 0) {
        return {
          companies: cnpjaResult.empresas.map((e) => ({
            razaoSocial: e.razaoSocial,
            nomeFantasia: e.nomeFantasia || undefined,
            cnpj: e.cnpj,
            porte: e.porte,
            municipio: e.municipio,
            uf: e.uf,
            cnaeDescricao: e.cnaeDescricao,
            email: e.email || undefined,
            telefone: e.telefone || undefined,
            situacao: e.situacao,
            // CNPJá já vem enriquecido (email + telefone via Receita Federal)
            enriched: !!(e.email || e.telefone),
          })),
          totalInRegion: cnpjaResult.totalEmpresas,
          source: cnpjaResult.source,
          enrichedCount: cnpjaResult.empresas.filter((e) => e.email || e.telefone).length,
        };
      }
    } catch (err) {
      console.warn('[B2B] CNPJá falhou, tentando Brasil.io:', (err as Error).message);
    }
  }

  // Fallback Brasil.io
  const brasilIOResult = await buscarEmpresasBrasilIO(product, municipio, uf, { limit: 10 });
  if (!brasilIOResult || brasilIOResult.empresas.length === 0) {
    return null;
  }

  return {
    companies: brasilIOResult.empresas.map(e => ({
      razaoSocial: e.razaoSocial,
      cnpj: e.cnpj,
      porte: e.porte,
      municipio: e.municipio,
      uf: e.uf,
      cnaeDescricao: e.cnaeDescricao,
      situacao: e.situacao,
      enriched: false,
    })),
    totalInRegion: brasilIOResult.totalEmpresas,
    source: 'Brasil.io',
    enrichedCount: 0,
  };
}

// ─── CNPJ.WS ENRICHMENT ──────────────────────────────────────────────────────

interface CNPJwsData {
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
}

/**
 * Enriquece um CNPJ com dados públicos via CNPJ.ws (API pública gratuita).
 * Rate limit: 3 req/min — caller é responsável por respeitar.
 */
async function enrichWithCNPJws(cnpj: string): Promise<CNPJwsData | null> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return null;

  try {
    const response = await fetch(`${CNPJWS_BASE}/${digits}`, {
      headers: { 'User-Agent': 'Viro/1.0 (virolocal.com)' },
      signal: AbortSignal.timeout(CNPJWS_TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[CNPJ.ws] Rate limit atingido');
      }
      return null;
    }

    const data = await response.json();

    return {
      nomeFantasia: data.estabelecimento?.nome_fantasia || data.razao_social || null,
      email: data.estabelecimento?.email || null,
      telefone: formatTelefone(
        data.estabelecimento?.ddd1,
        data.estabelecimento?.telefone1,
      ),
    };
  } catch (err) {
    console.warn('[CNPJ.ws] Erro:', (err as Error).message);
    return null;
  }
}

function formatTelefone(ddd?: string, numero?: string): string | null {
  if (!ddd || !numero) return null;
  const clean = numero.replace(/\D/g, '');
  return `(${ddd}) ${clean}`;
}
