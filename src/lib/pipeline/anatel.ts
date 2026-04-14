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

// ─── Token cache (válido por 1h, reusa entre chamadas) ──────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  // Reusa token se ainda válido (margem de 5min)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.token;
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    console.warn('[Anatel] GOOGLE_SERVICE_ACCOUNT_KEY not set');
    return null;
  }

  try {
    const key = JSON.parse(keyJson);
    const crypto = await import('crypto');

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const signInput = `${header}.${claim}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(key.private_key, 'base64url');
    const jwt = `${signInput}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      signal: AbortSignal.timeout(8_000),
    });

    if (!tokenRes.ok) {
      console.warn(`[Anatel] Token exchange failed: ${tokenRes.status}`);
      return null;
    }

    const tokenData = await tokenRes.json();
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: Date.now() + 3600_000,
    };
    return tokenData.access_token;
  } catch (err) {
    console.warn('[Anatel] Auth error:', (err as Error).message);
    return null;
  }
}

/**
 * Executa query no BigQuery via REST API com parameterized query.
 */
async function queryBigQuery(
  sql: string,
  params?: Array<{ name: string; parameterType: { type: string }; parameterValue: { value: string } }>,
  token?: string,
): Promise<any[]> {
  const projectId = process.env.GOOGLE_BIGQUERY_PROJECT_ID;
  if (!projectId) {
    console.warn('[Anatel] GOOGLE_BIGQUERY_PROJECT_ID not set');
    return [];
  }

  const accessToken = token || await getAccessToken();
  if (!accessToken) return [];

  try {
    const body: any = {
      query: sql,
      useLegacySql: false,
      maxResults: 50,
      timeoutMs: 15000,
    };
    if (params?.length) {
      body.parameterMode = 'NAMED';
      body.queryParameters = params;
    }

    const res = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Anatel] BigQuery error ${res.status}:`, err.slice(0, 300));
      return [];
    }

    const data = await res.json();

    if (!data.jobComplete) {
      console.warn('[Anatel] BigQuery job not complete within timeout');
      return [];
    }

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
 * Usa single query com subquery pra resolver município e buscar dados
 * num único round-trip (metade do tempo vs 2 queries sequenciais).
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

  const municipioClean = municipio.trim();
  if (!municipioClean) return empty;

  const t0 = Date.now();

  // Get token once, reuse for both queries
  const token = await getAccessToken();
  if (!token) return empty;

  console.log(`[Anatel] Auth OK in ${Date.now() - t0}ms. Looking up "${municipioClean}" ${uf || ''}`);

  // Single query: resolve município + busca dados na mesma chamada
  // Usa subquery pra encontrar id_municipio e depois buscar microdados
  const sql = uf
    ? `
    WITH mun AS (
      SELECT id_municipio, nome, sigla_uf
      FROM \`basedosdados.br_bd_diretorios_brasil.municipio\`
      WHERE LOWER(nome) = LOWER(@municipio)
        AND sigla_uf = @uf
      LIMIT 1
    )
    SELECT
      mun.nome AS mun_nome,
      mun.sigla_uf AS mun_uf,
      mun.id_municipio,
      t.cnpj,
      t.ano,
      t.mes,
      COUNT(*) AS total_registros
    FROM mun
    JOIN \`basedosdados.br_anatel_banda_larga_fixa.microdados\` t
      ON t.id_municipio = mun.id_municipio
    GROUP BY mun.nome, mun.sigla_uf, mun.id_municipio, t.cnpj, t.ano, t.mes
    ORDER BY t.ano DESC, t.mes DESC, total_registros DESC
    LIMIT 30
  `
    : `
    WITH mun AS (
      SELECT id_municipio, nome, sigla_uf
      FROM \`basedosdados.br_bd_diretorios_brasil.municipio\`
      WHERE LOWER(nome) = LOWER(@municipio)
      LIMIT 1
    )
    SELECT
      mun.nome AS mun_nome,
      mun.sigla_uf AS mun_uf,
      mun.id_municipio,
      t.cnpj,
      t.ano,
      t.mes,
      COUNT(*) AS total_registros
    FROM mun
    JOIN \`basedosdados.br_anatel_banda_larga_fixa.microdados\` t
      ON t.id_municipio = mun.id_municipio
    GROUP BY mun.nome, mun.sigla_uf, mun.id_municipio, t.cnpj, t.ano, t.mes
    ORDER BY t.ano DESC, t.mes DESC, total_registros DESC
    LIMIT 30
  `;

  const params: Array<{ name: string; parameterType: { type: string }; parameterValue: { value: string } }> = [
    { name: 'municipio', parameterType: { type: 'STRING' }, parameterValue: { value: municipioClean } },
  ];
  if (uf) {
    params.push({ name: 'uf', parameterType: { type: 'STRING' }, parameterValue: { value: uf.toUpperCase() } });
  }

  const rows = await queryBigQuery(sql, params, token);
  console.log(`[Anatel] Query done in ${Date.now() - t0}ms, ${rows.length} rows`);

  if (rows.length === 0) {
    // Fallback: try LIKE match if exact match fails
    console.log(`[Anatel] Exact match failed, trying LIKE fallback...`);
    const fallbackSql = uf
      ? `
      WITH mun AS (
        SELECT id_municipio, nome, sigla_uf
        FROM \`basedosdados.br_bd_diretorios_brasil.municipio\`
        WHERE LOWER(nome) LIKE CONCAT('%', LOWER(@municipio), '%')
          AND sigla_uf = @uf
        LIMIT 1
      )
      SELECT
        mun.nome AS mun_nome,
        mun.sigla_uf AS mun_uf,
        mun.id_municipio,
        t.cnpj,
        t.ano,
        t.mes,
        COUNT(*) AS total_registros
      FROM mun
      JOIN \`basedosdados.br_anatel_banda_larga_fixa.microdados\` t
        ON t.id_municipio = mun.id_municipio
      GROUP BY mun.nome, mun.sigla_uf, mun.id_municipio, t.cnpj, t.ano, t.mes
      ORDER BY t.ano DESC, t.mes DESC, total_registros DESC
      LIMIT 30
    `
      : `
      WITH mun AS (
        SELECT id_municipio, nome, sigla_uf
        FROM \`basedosdados.br_bd_diretorios_brasil.municipio\`
        WHERE LOWER(nome) LIKE CONCAT('%', LOWER(@municipio), '%')
        LIMIT 1
      )
      SELECT
        mun.nome AS mun_nome,
        mun.sigla_uf AS mun_uf,
        mun.id_municipio,
        t.cnpj,
        t.ano,
        t.mes,
        COUNT(*) AS total_registros
      FROM mun
      JOIN \`basedosdados.br_anatel_banda_larga_fixa.microdados\` t
        ON t.id_municipio = mun.id_municipio
      GROUP BY mun.nome, mun.sigla_uf, mun.id_municipio, t.cnpj, t.ano, t.mes
      ORDER BY t.ano DESC, t.mes DESC, total_registros DESC
      LIMIT 30
    `;

    const fallbackRows = await queryBigQuery(fallbackSql, params, token);
    console.log(`[Anatel] LIKE fallback: ${fallbackRows.length} rows in ${Date.now() - t0}ms`);
    if (fallbackRows.length === 0) {
      console.log(`[Anatel] Municipality not found: "${municipioClean}"`);
      return empty;
    }
    return parseAnatelRows(fallbackRows, municipio, uf);
  }

  return parseAnatelRows(rows, municipio, uf);
}

function parseAnatelRows(
  rows: any[],
  municipio: string,
  uf?: string,
): AnatelResult {
  const munNome = rows[0]?.mun_nome;
  const munUf = rows[0]?.mun_uf;
  const latestAno = rows[0]?.ano;
  const latestMes = rows[0]?.mes;
  const latestRows = rows.filter((r: any) => r.ano === latestAno && r.mes === latestMes);

  const totalRegistros = latestRows.reduce((s: number, r: any) => s + (parseInt(r.total_registros) || 0), 0);
  const prestadoras = latestRows
    .filter((r: any) => r.cnpj)
    .map((r: any) => ({
      nome: r.cnpj,
      acessos: parseInt(r.total_registros) || 0,
      marketShare: totalRegistros > 0
        ? Math.round((parseInt(r.total_registros) / totalRegistros) * 100)
        : 0,
    }));

  console.log(
    `[Anatel] ${munNome}: ${totalRegistros} registros, ${prestadoras.length} prestadoras, ${latestAno}/${latestMes}`,
  );

  return {
    found: true,
    municipio: munNome || municipio,
    uf: munUf || uf || '',
    totalAcessos: totalRegistros,
    prestadoras,
    totalPrestadoras: prestadoras.length,
    anoReferencia: parseInt(latestAno) || 0,
    source: 'bigquery_anatel',
  };
}
