// ============================================================================
// Virô Radar — ANEEL Integration (DADOS REAIS)
// API REST pública — dadosabertos.aneel.gov.br (CKAN)
// Sem autenticação. Dados reais de geração distribuída e agentes.
// ============================================================================

const BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';

// Resource IDs no CKAN da ANEEL
const RESOURCE_GD = 'b1bd71e7-d0ad-4214-9053-cbd58e9564a7'; // Geração Distribuída
const RESOURCE_AGENTES = '64250fc9-4f7a-4d97-b0d4-3c090e005e1c'; // Agentes

export interface AneelGDResult {
  found: boolean;
  totalUsinas: number;
  potenciaTotalKW: number;
  principalFonte: string;
  usinasPorFonte: Record<string, number>;
  municipio: string;
  uf: string;
  source: 'aneel_api';
}

export interface AneelAgentesResult {
  found: boolean;
  totalComercializadores: number;
  agentes: Array<{
    nome: string;
    cnpj: string;
    ativo: boolean;
    tipo: string; // comercializacao, geracao, distribuicao
  }>;
  source: 'aneel_api';
}

/**
 * Busca geração distribuída por município na ANEEL.
 * Retorna: total de usinas, potência instalada, fonte principal.
 */
export async function fetchGeracaoDistribuida(
  municipio: string,
  uf?: string,
): Promise<AneelGDResult> {
  try {
    const municipioClean = municipio.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let sql = `SELECT "DscFonteGeracao", COUNT(*) as total, SUM("MdaPotenciaInstaladaKW") as potencia FROM "${RESOURCE_GD}" WHERE "NomMunicipio" LIKE '${municipioClean}%'`;
    if (uf) sql += ` AND "SigUF"='${uf.toUpperCase()}'`;
    sql += ` GROUP BY "DscFonteGeracao" LIMIT 20`;

    const url = `${BASE}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      console.warn(`[ANEEL] API returned ${res.status}`);
      return { found: false, totalUsinas: 0, potenciaTotalKW: 0, principalFonte: '', usinasPorFonte: {}, municipio, uf: uf || '', source: 'aneel_api' };
    }

    const data = await res.json();
    const records = data.result?.records || [];

    if (records.length === 0) {
      return { found: false, totalUsinas: 0, potenciaTotalKW: 0, principalFonte: '', usinasPorFonte: {}, municipio, uf: uf || '', source: 'aneel_api' };
    }

    let totalUsinas = 0;
    let potenciaTotal = 0;
    const porFonte: Record<string, number> = {};

    for (const r of records) {
      const count = parseInt(r.total) || 0;
      const pot = parseFloat(r.potencia) || 0;
      const fonte = r.DscFonteGeracao || 'Outros';
      totalUsinas += count;
      potenciaTotal += pot;
      porFonte[fonte] = (porFonte[fonte] || 0) + count;
    }

    const principalFonte = Object.entries(porFonte).sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    console.log(`[ANEEL] GD ${municipio}: ${totalUsinas} usinas, ${Math.round(potenciaTotal)}kW, principal: ${principalFonte}`);

    return {
      found: true,
      totalUsinas,
      potenciaTotalKW: Math.round(potenciaTotal),
      principalFonte,
      usinasPorFonte: porFonte,
      municipio,
      uf: uf || '',
      source: 'aneel_api',
    };
  } catch (err) {
    console.warn(`[ANEEL] GD error:`, (err as Error).message);
    return { found: false, totalUsinas: 0, potenciaTotalKW: 0, principalFonte: '', usinasPorFonte: {}, municipio, uf: uf || '', source: 'aneel_api' };
  }
}

/**
 * Busca agentes de comercialização ativos na ANEEL.
 * Retorna: lista de comercializadoras ativas.
 */
export async function fetchAgentesComercializacao(
  limit: number = 50,
): Promise<AneelAgentesResult> {
  try {
    const sql = `SELECT "NomRazaoSocial", "NumCnpj", "IdcAtivo", "IdcComercializacao", "IdcGeracao" FROM "${RESOURCE_AGENTES}" WHERE "IdcComercializacao"='1' AND "IdcAtivo"='1' LIMIT ${limit}`;
    const url = `${BASE}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      return { found: false, totalComercializadores: 0, agentes: [], source: 'aneel_api' };
    }

    const data = await res.json();
    const records = data.result?.records || [];

    const agentes = records.map((r: any) => ({
      nome: r.NomRazaoSocial || '',
      cnpj: r.NumCnpj || '',
      ativo: r.IdcAtivo === '1',
      tipo: r.IdcComercializacao === '1' ? 'comercializacao' : r.IdcGeracao === '1' ? 'geracao' : 'outro',
    }));

    console.log(`[ANEEL] Agentes: ${agentes.length} comercializadoras ativas`);

    return {
      found: agentes.length > 0,
      totalComercializadores: agentes.length,
      agentes,
      source: 'aneel_api',
    };
  } catch (err) {
    console.warn(`[ANEEL] Agentes error:`, (err as Error).message);
    return { found: false, totalComercializadores: 0, agentes: [], source: 'aneel_api' };
  }
}
