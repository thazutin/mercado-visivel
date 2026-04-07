// ============================================================================
// /api/cron/health-report — Periodic health snapshot email
// Roda 4x ao dia (cron Vercel), pinga /api/health e envia o resultado por
// email pra thazutin@gmail.com como heartbeat. Cost: $0 (Vercel Pro cron +
// Resend tier free + zero LLM).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALERT_EMAIL = "thazutin@gmail.com";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const internalSecret = req.headers.get("x-internal-secret");
  return (
    (!!cronSecret && cronSecret === process.env.CRON_SECRET) ||
    (!!internalSecret && internalSecret === process.env.INTERNAL_API_SECRET)
  );
}

interface HealthResponse {
  ok: boolean;
  paused: boolean;
  timestamp: string;
  totalLatencyMs: number;
  checks: Array<{
    name: string;
    ok: boolean;
    latencyMs: number;
    detail?: string;
    balance?: string;
  }>;
}

async function fetchHealth(): Promise<HealthResponse | null> {
  // Sempre usa o domínio canônico — VERCEL_URL aponta pro deployment URL
  // (viro-xxx.vercel.app) que pode resolver diferente do alias de produção.
  const baseUrl = "https://virolocal.com";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[HealthReport] INTERNAL_API_SECRET not set in env");
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { "x-internal-secret": secret },
      signal: AbortSignal.timeout(20000),
    });
    // 503 é esperado quando ok=false; qualquer outro non-2xx é erro de transporte
    if (!res.ok && res.status !== 503) {
      console.error(`[HealthReport] /api/health returned HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as HealthResponse;
    console.log(`[HealthReport] snapshot ok=${data.ok} paused=${data.paused} checks=${data.checks?.length}`);
    return data;
  } catch (err) {
    console.error("[HealthReport] fetch failed:", (err as Error).message);
    return null;
  }
}

function buildEmail(health: HealthResponse | null): { subject: string; html: string } {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  if (!health) {
    return {
      subject: `🚨 Health Virô — falha ao consultar /api/health · ${now}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#FCEBEB;padding:24px;border-radius:8px;">
          <h2 style="color:#A32D2D;margin:0 0 12px;">🚨 Health endpoint inacessível</h2>
          <p style="color:#161618;font-size:14px;">Não consegui chamar <code>/api/health</code> em ${now}.</p>
          <p style="color:#666;font-size:12px;">Possíveis causas: deploy quebrado, INTERNAL_API_SECRET faltando, Vercel down.</p>
        </div>
      `,
    };
  }

  const failedChecks = health.checks.filter((c) => !c.ok);
  const allOk = failedChecks.length === 0 && !health.paused;
  const statusIcon = allOk ? "✅" : health.paused ? "⏸️" : "🚨";
  const statusLabel = allOk ? "tudo ok" : health.paused ? "pausado" : `${failedChecks.length} falha${failedChecks.length > 1 ? "s" : ""}`;

  const subject = `${statusIcon} Health Virô — ${statusLabel} · ${now}`;

  const checkRows = health.checks
    .map((c) => {
      const icon = c.ok ? "✅" : "❌";
      const color = c.ok ? "#1D9E75" : "#E24B4A";
      const extra = c.balance ? ` · ${c.balance}` : c.detail ? ` · ${c.detail}` : "";
      return `<tr style="border-bottom:1px solid #E8E4DE;">
        <td style="padding:8px;font-size:13px;">${icon} ${c.name}</td>
        <td style="padding:8px;font-size:11px;color:#666;font-family:monospace;">${c.latencyMs}ms</td>
        <td style="padding:8px;font-size:11px;color:${color};">${extra}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;background:#F7F5F2;padding:24px;">
      <p style="font-size:20px;font-weight:700;color:#161618;margin:0 0 4px;">${statusIcon} Health Snapshot</p>
      <p style="font-size:12px;color:#888;margin:0 0 16px;">${now} · total ${health.totalLatencyMs}ms · ${health.paused ? "<strong style='color:#CF8523'>KILL SWITCH ATIVO</strong>" : "operação normal"}</p>
      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#161618;color:#fff;">
          <th style="padding:8px;text-align:left;font-size:11px;">SERVIÇO</th>
          <th style="padding:8px;text-align:left;font-size:11px;">LATÊNCIA</th>
          <th style="padding:8px;text-align:left;font-size:11px;">DETALHE</th>
        </tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
      ${
        !allOk
          ? `<p style="font-size:12px;color:#A32D2D;margin:16px 0 0;"><strong>Ação:</strong> verificar logs do Vercel, recarregar saldos se for o caso, e rodar <code>curl -H "x-internal-secret: ..." https://virolocal.com/api/health</code> manualmente pra confirmar.</p>`
          : `<p style="font-size:11px;color:#888;margin:16px 0 0;">Próximo snapshot em ~6h.</p>`
      }
    </div>
  `;

  return { subject, html };
}

async function sendReport(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[HealthReport] No RESEND_API_KEY, skipping email");
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Nelson Health <entrega@virolocal.com>",
      to: ALERT_EMAIL,
      subject,
      html,
    }),
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const health = await fetchHealth();
  const { subject, html } = buildEmail(health);

  try {
    await sendReport(subject, html);
  } catch (err) {
    console.error("[HealthReport] send failed:", (err as Error).message);
  }

  return NextResponse.json({
    ok: health?.ok ?? false,
    sent: true,
    timestamp: new Date().toISOString(),
  });
}
