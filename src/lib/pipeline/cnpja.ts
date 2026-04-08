// ============================================================================
// Virô — CNPJá API integration (substitui Brasil.io)
// Busca empresas brasileiras por CNAE + UF/município via cnpja.com
// API: https://api.cnpja.com/office
// Auth: Authorization: <CNPJA_API_KEY> (sem "Bearer")
// Custo: 1 crédito por cada 10 estabelecimentos retornados (plano R$24,99 = 1000 créditos/mês)
// ============================================================================

import { findCNAEByProduct } from '@/config/cnae-mapping';

const CNPJA_BASE = 'https://api.cnpja.com';
const TIMEOUT_MS = 12_000;

export interface CnpjaCompany {
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  porte: string;
  municipio: string;
  uf: string;
  cnaeDescricao: string;
  email?: string | null;
  telefone?: string | null;
  situacao: string;
  bairro?: string | null;
  capitalSocial?: number | null;
}

export interface CnpjaResult {
  empresas: CnpjaCompany[];
  totalEmpresas: number;
  source: string;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatCNPJ(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function mapPorte(sizeAcronym: string): string {
  const map: Record<string, string> = {
    ME: 'Microempresa',
    EPP: 'Pequeno Porte',
    DEMAIS: 'Demais',
  };
  return map[sizeAcronym] || sizeAcronym || 'N/D';
}

function recordToCompany(r: any): CnpjaCompany {
  // CNPJá retorna phones e emails como arrays de objetos: [{ area, number }] / [{ address, domain }]
  const phone = (r.phones && r.phones[0])
    ? `(${r.phones[0].area}) ${r.phones[0].number}`
    : null;
  const email = (r.emails && r.emails[0]) ? r.emails[0].address : null;

  const addr = r.address || {};
  return {
    razaoSocial: r.company?.name || r.alias || '',
    nomeFantasia: r.alias || null,
    cnpj: formatCNPJ(r.taxId || ''),
    porte: mapPorte(r.company?.size?.acronym || ''),
    municipio: addr.city || '',
    uf: addr.state || '',
    cnaeDescricao: r.mainActivity?.text || '',
    email,
    telefone: phone,
    situacao: r.status?.text || 'Ativa',
    bairro: addr.district || null,
    capitalSocial: r.company?.equity ?? null,
  };
}

// ─── MAIN SEARCH ────────────────────────────────────────────────────────────

/**
 * Busca empresas no CNPJá por CNAE + UF + município (opcional).
 * Retorna até `limit` empresas ATIVAS, ordenadas por capital social.
 */
export async function buscarEmpresasCnpja(
  product: string,
  municipio: string,
  uf?: string,
  options?: { limit?: number; differentiator?: string },
): Promise<CnpjaResult | null> {
  const apiKey = process.env.CNPJA_API_KEY;
  if (!apiKey) {
    console.warn('[CNPJá] CNPJA_API_KEY não configurada — pulando busca B2B');
    return null;
  }

  const cnaeMapping = findCNAEByProduct(product, options?.differentiator);
  if (!cnaeMapping || cnaeMapping.cnaePrimarios.length === 0) {
    console.warn(`[CNPJá] CNAE não encontrado para "${product}"`);
    return null;
  }

  const limit = Math.min(options?.limit || 10, 30);
  // Constrói query params manualmente porque CNPJá usa keys com pontos (mainActivity.id.in)
  // que URLSearchParams escapa diferente. Encode só os values.
  const params: string[] = [];
  params.push(`limit=${limit}`);
  // Status 2 = Ativa (somente empresas em atividade)
  params.push(`status.id.in=2`);

  // Múltiplos CNAEs primários — passa todos como CSV no `mainActivity.id.in`
  const cnaeCSV = cnaeMapping.cnaePrimarios.join(',');
  params.push(`mainActivity.id.in=${encodeURIComponent(cnaeCSV)}`);

  // UF (state)
  if (uf) {
    params.push(`address.state.in=${encodeURIComponent(uf.toUpperCase())}`);
  }

  // Município — CNPJá exige código IBGE numérico, mas a gente recebe nome.
  // Solução: não filtra por município no CNPJá, filtra UF + cnae e depois
  // (post-fetch) descarta os que não casam. Para leads nacionais, nem tenta.
  // Isso evita complexidade de manter mapeamento nome→IBGE no código.

  const url = `${CNPJA_BASE}/office?${params.join('&')}`;
  console.log(`[CNPJá] Buscando: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
        'User-Agent': 'Viro/1.0 (virolocal.com)',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[CNPJá] HTTP ${response.status}: ${body.slice(0, 300)}`);
      if (response.status === 401) {
        console.error('[CNPJá] Auth falhou — verificar CNPJA_API_KEY no Vercel');
      }
      if (response.status === 402) {
        console.warn('[CNPJá] Sem créditos disponíveis — verificar plano');
      }
      return null;
    }

    const data = await response.json();
    const records: any[] = data.records || [];

    if (records.length === 0) {
      console.log(`[CNPJá] 0 empresas encontradas para CNAE=${cnaeCSV} UF=${uf || 'BR'}`);
      return { empresas: [], totalEmpresas: data.count || 0, source: 'CNPJá (vazio)' };
    }

    // Filtro post-fetch por município (se fornecido) — match case-insensitive
    let empresas = records.map(recordToCompany);
    if (municipio && municipio.trim().length > 0) {
      const muniNorm = municipio
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      const filtered = empresas.filter((e) => {
        const cityNorm = (e.municipio || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return cityNorm === muniNorm || cityNorm.includes(muniNorm);
      });
      // Se filtro por município derrubou tudo, mantém o resultado completo (UF) —
      // pra leads cuja cidade não tem empresas no CNAE específico, mostrar empresas
      // do mesmo estado é melhor que nada.
      if (filtered.length > 0) {
        empresas = filtered;
      } else {
        console.log(`[CNPJá] Nenhuma empresa em "${municipio}" — retornando ${empresas.length} do estado ${uf}`);
      }
    }

    console.log(
      `[CNPJá] ${data.count || records.length} empresas no Brasil para ${cnaeMapping.category}, retornando ${empresas.length}`,
    );

    return {
      empresas: empresas.slice(0, limit),
      totalEmpresas: data.count || records.length,
      source: `CNPJá (${cnaeMapping.category})`,
    };
  } catch (err) {
    console.error('[CNPJá] Erro:', (err as Error).message);
    return null;
  }
}
