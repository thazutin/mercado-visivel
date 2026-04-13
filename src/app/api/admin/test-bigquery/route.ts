// GET /api/admin/test-bigquery — testa se BigQuery auth funciona
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = process.env.GOOGLE_BIGQUERY_PROJECT_ID;
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!projectId) return NextResponse.json({ error: "GOOGLE_BIGQUERY_PROJECT_ID not set" });
  if (!keyJson) return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not set" });

  // Test JSON parse
  let key: any;
  try {
    key = JSON.parse(keyJson);
  } catch (err) {
    return NextResponse.json({ error: "JSON parse failed", detail: (err as Error).message, keyLength: keyJson.length, firstChars: keyJson.slice(0, 50) });
  }

  // Test JWT + token
  try {
    const crypto = await import('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
    })).toString('base64url');

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const signature = signer.sign(key.private_key, 'base64url');
    const jwt = `${header}.${claim}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Token exchange failed", status: tokenRes.status, detail: tokenData });
    }

    // Get ALL columns + sample data
    const anatelSql = `
      SELECT *
      FROM \`basedosdados.br_anatel_banda_larga_fixa.microdados\`
      WHERE sigla_uf = 'SP' AND ano = 2023
      LIMIT 3
    `;
    const queryRes = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: anatelSql, useLegacySql: false, timeoutMs: 30000 }),
      },
    );

    const queryData = await queryRes.json();
    const rows = (queryData.rows || []).map((r: any) => ({
      municipio: r.f?.[0]?.v,
      uf: r.f?.[1]?.v,
      prestadora: r.f?.[2]?.v,
      acessos: r.f?.[3]?.v,
      ano: r.f?.[4]?.v,
    }));

    return NextResponse.json({
      ok: true,
      projectId,
      clientEmail: key.client_email,
      tokenOk: !!tokenData.access_token,
      queryOk: queryRes.ok,
      queryError: queryData.error || null,
      rowCount: rows.length,
      rows: rows.slice(0, 5),
    });
  } catch (err) {
    return NextResponse.json({ error: "Auth failed", detail: (err as Error).message });
  }
}
