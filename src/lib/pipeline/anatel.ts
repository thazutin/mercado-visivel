// ============================================================================
// Virô Radar — Anatel Integration via BigQuery (DADOS REAIS)
// Consulta Base dos Dados (basedosdados) no BigQuery pra dados de
// banda larga fixa por município e prestadora.
// Requer: GOOGLE_BIGQUERY_PROJECT_ID + GOOGLE_SERVICE_ACCOUNT_KEY no env.
// ============================================================================

export interface AnatelResult {
  found: boolean;
  municipio: string;
  uf: string;
  totalAcessos: number;
  prestadoras: Array<{
    nome: string;
    acessos: number;
    marketShare: number; // 0-100
  }>;
  totalPrestadoras: number;
  anoReferencia: number;
  source: 'bigquery_anatel';
}

/**
 * Gera JWT token a partir da service account key.
 * BigQuery REST API aceita OAuth2 token — geramos via JWT assertion.
 */
async function getAccessToken(): Promise<string | null> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    console.warn('[Anatel] GOOGLE_SERVICE_ACCOUNT_KEY not set');
    return null;
  }

  try {
    const key = JSON.parse(keyJson);
    const crypto = await import('crypto');

    // JWT header + claim
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    // Sign
    const signInput = `${header}.${claim}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(key.private_key, 'base64url');

    const jwt = `${signInput}.${signature}`;

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      console.warn(`[Anatel] Token exchange failed: ${tokenRes.status}`);
      return null;
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
  } catch (err) {
    console.warn('[Anatel] Auth error:', (err as Error).message);
    return null;
  }
}

/**
 * Executa query no BigQuery via REST API.
 */
async function queryBigQuery(sql: string): Promise<any[]> {
  const projectId = process.env.GOOGLE_BIGQUERY_PROJECT_ID;
  if (!projectId) {
    console.warn('[Anatel] GOOGLE_BIGQUERY_PROJECT_ID not set');
    return [];
  }

  const token = await getAccessToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: sql,
          useLegacySql: false,
          maxResults: 50,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Anatel] BigQuery error ${res.status}:`, err.slice(0, 200));
      return [];
    }

    const data = await res.json();
    const fields = data.schema?.fields || [];
    const rows = data.rows || [];

    return rows.map((row: any) =>
      Object.fromEntries(
        fields.map((f: any, i: number) => [f.name, row.f[i]?.v]),
      ),
    );
  } catch (err) {
    console.warn('[Anatel] Query error:', (err as Error).message);
    return [];
  }
}

/**
 * Busca dados de banda larga fixa por município via BigQuery.
 * Retorna: prestadoras ordenadas por market share, total de acessos.
 * Custo: ~0.01 GB processado (~$0 dentro do free tier de 1TB/mês).
 */
export async function fetchAnatelBandaLarga(
  municipio: string,
  uf?: string,
): Promise<AnatelResult> {
  const empty: AnatelResult = {
    found: false, municipio, uf: uf || '', totalAcessos: 0,
    prestadoras: [], totalPrestadoras: 0, anoReferencia: 0,
    source: 'bigquery_anatel',
  };

  // Normaliza nome do município pra match
  const municipioClean = municipio
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, '')
    .trim();

  if (!municipioClean) return empty;

  // Query: acessos por prestadora no município mais recente
  const sql = `
    SELECT
      m.nome AS municipio_nome,
      m.sigla_uf,
      t.grupo_economico AS prestadora,
      SUM(CAST(t.acessos AS INT64)) AS total_acessos,
      t.ano
    FROM \`basedosdados.br_anatel_banda_larga_fixa.microdados\` t
    JOIN \`basedosdados.br_bd_diretorios_brasil.municipio\` m
      ON t.id_municipio = m.id_municipio
    WHERE UPPER(NORMALIZE(m.nome, NFD)) LIKE '%${municipioClean}%'
      ${uf ? `AND m.sigla_uf = '${uf.toUpperCase()}'` : ''}
      AND t.ano = (SELECT MAX(ano) FROM \`basedosdados.br_anatel_banda_larga_fixa.microdados\`)
    GROUP BY m.nome, m.sigla_uf, t.grupo_economico, t.ano
    ORDER BY total_acessos DESC
    LIMIT 20
  `;

  const rows = await queryBigQuery(sql);

  if (rows.length === 0) {
    console.log(`[Anatel] No data for "${municipioClean}"`);
    return empty;
  }

  const totalAcessos = rows.reduce((s, r) => s + (parseInt(r.total_acessos) || 0), 0);
  const prestadoras = rows
    .filter((r: any) => r.prestadora && parseInt(r.total_acessos) > 0)
    .map((r: any) => ({
      nome: r.prestadora,
      acessos: parseInt(r.total_acessos) || 0,
      marketShare: totalAcessos > 0
        ? Math.round((parseInt(r.total_acessos) / totalAcessos) * 100)
        : 0,
    }));

  console.log(
    `[Anatel] ${municipioClean}: ${totalAcessos} acessos, ${prestadoras.length} prestadoras, ano ${rows[0]?.ano}`,
  );

  return {
    found: true,
    municipio: rows[0]?.municipio_nome || municipio,
    uf: rows[0]?.sigla_uf || uf || '',
    totalAcessos,
    prestadoras,
    totalPrestadoras: prestadoras.length,
    anoReferencia: parseInt(rows[0]?.ano) || 0,
    source: 'bigquery_anatel',
  };
}
