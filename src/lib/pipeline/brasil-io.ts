// ============================================================================
// Virô — Brasil.io Integration
// Consulta empresas por CNAE + município via dataset socios-brasil
// Usado para: benchmarkNacionalCompetidores + lista de empresas B2B
// ============================================================================

import { findCNAEByProduct, type CNAEMapping } from '@/config/cnae-mapping';

export interface BrasilIOCompany {
  razaoSocial: string;
  cnpj: string;
  porte: string;
  municipio: string;
  uf: string;
  cnaeDescricao: string;
  situacao: string;
}

export interface BrasilIOResult {
  totalEmpresas: number;
  empresas: BrasilIOCompany[];
  cnaeUsado: string[];
  municipio: string;
  source: 'brasil_io' | 'fallback';
}

const BRASIL_IO_BASE = 'https://api.brasil.io/v1/datasets/socios-brasil/empresas/data/';
const TIMEOUT_MS = 10_000;

/**
 * Busca contagem de empresas por CNAE + município no Brasil.io.
 * Requer BRASIL_IO_TOKEN no environment.
 * Fallback: retorna null se token não existe ou API falha.
 */
export async function buscarEmpresasBrasilIO(
  product: string,
  municipio: string,
  uf?: string,
  options?: { limit?: number; differentiator?: string },
): Promise<BrasilIOResult | null> {
  const token = process.env.BRASIL_IO_TOKEN;
  if (!token) {
    console.warn('[Brasil.io] BRASIL_IO_TOKEN não configurado — usando fallback');
    return null;
  }

  const cnaeMapping = findCNAEByProduct(product, options?.differentiator);
  if (!cnaeMapping) {
    console.warn(`[Brasil.io] CNAE não encontrado para "${product}"`);
    return null;
  }

  const limit = options?.limit || 20;

  try {
    // Tenta buscar com CNAE primário + município
    const params = new URLSearchParams({
      municipio: normalizeMunicipio(municipio),
      situacao_cadastral: 'Ativa',
      ordering: '-capital_social',
      page_size: String(limit),
    });

    // Adiciona filtro por CNAE (usa grupo para busca mais ampla)
    if (cnaeMapping.cnaePrimarios.length > 0) {
      params.set('cnae_fiscal', cnaeMapping.cnaePrimarios[0]);
    }

    if (uf) {
      params.set('uf', uf.toUpperCase());
    }

    const url = `${BRASIL_IO_BASE}?${params.toString()}`;
    console.log(`[Brasil.io] Buscando: ${url.replace(token, '***')}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${token}`,
        'User-Agent': 'Viro/1.0 (virolocal.com)',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[Brasil.io] HTTP ${response.status}: ${response.statusText}`);
      // Se 429 (rate limit), logar aviso
      if (response.status === 429) {
        console.warn('[Brasil.io] Rate limit atingido — aguardar antes de próxima chamada');
      }
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    // Se poucas empresas, tenta busca com CNAE grupo (mais ampla)
    let allResults = results;
    if (results.length < 3 && cnaeMapping.cnaePrimarios.length > 1) {
      for (const cnae of cnaeMapping.cnaePrimarios.slice(1)) {
        if (allResults.length >= limit) break;
        try {
          params.set('cnae_fiscal', cnae);
          const fallbackUrl = `${BRASIL_IO_BASE}?${params.toString()}`;
          const fallbackRes = await fetch(fallbackUrl, {
            headers: { 'Authorization': `Token ${token}`, 'User-Agent': 'Viro/1.0' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const existingCnpjs = new Set(allResults.map((r: any) => r.cnpj));
            for (const item of (fallbackData.results || [])) {
              if (!existingCnpjs.has(item.cnpj)) {
                allResults.push(item);
              }
            }
          }
        } catch { /* ignore fallback */ }
      }
    }

    const empresas: BrasilIOCompany[] = allResults.slice(0, limit).map((item: any) => ({
      razaoSocial: item.razao_social || item.nome_fantasia || '',
      cnpj: formatCNPJ(item.cnpj || ''),
      porte: mapPorte(item.porte || ''),
      municipio: item.municipio || municipio,
      uf: item.uf || uf || '',
      cnaeDescricao: item.cnae_fiscal_descricao || cnaeMapping.descricao,
      situacao: item.situacao_cadastral || 'Ativa',
    }));

    const totalCount = data.count || empresas.length;
    console.log(`[Brasil.io] ${totalCount} empresas encontradas para ${cnaeMapping.category} em ${municipio}`);

    return {
      totalEmpresas: totalCount,
      empresas,
      cnaeUsado: cnaeMapping.cnaePrimarios,
      municipio,
      source: 'brasil_io',
    };
  } catch (err) {
    console.error('[Brasil.io] Erro:', (err as Error).message);
    return null;
  }
}

/**
 * Retorna benchmarkNacionalCompetidores — contagem de empresas no setor/município.
 * Usado no pipeline de audiência estimada.
 */
export async function getBenchmarkNacionalCompetidores(
  product: string,
  municipio: string,
  uf?: string,
): Promise<{ count: number; source: string; descricao: string } | null> {
  const result = await buscarEmpresasBrasilIO(product, municipio, uf, { limit: 1 });
  if (!result) return null;

  return {
    count: result.totalEmpresas,
    source: 'Brasil.io CNPJ (Receita Federal)',
    descricao: `${result.totalEmpresas} empresas ativas no setor em ${municipio}`,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function normalizeMunicipio(municipio: string): string {
  return municipio
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

function mapPorte(porte: string): string {
  const p = porte.toLowerCase();
  if (p.includes('micro') || p === 'me') return 'ME';
  if (p.includes('pequen') || p === 'epp') return 'EPP';
  if (p.includes('médi') || p.includes('medio')) return 'MEDIO';
  if (p.includes('grand')) return 'GRANDE';
  return porte || 'N/I';
}
