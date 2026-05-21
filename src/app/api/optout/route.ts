// ============================================================================
// /api/optout — Opt-out da cadência conversacional do WhatsApp
//
// GET  /api/optout?leadId=X&token=Y  → marca optout + retorna página de confirmação
// POST /api/optout { leadId, source } → programático (usado pelo inbound webhook
//                                       quando user manda PARE/STOP/SAIR)
//
// Token HMAC obrigatório pra GET (link no email) — impede que terceiro
// descadastre alguém. Cron CRON_SECRET ou auth interno pra POST.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Gera o token HMAC pro link de opt-out por email. */
export function buildOptoutToken(leadId: string): string {
  const secret = process.env.OPTOUT_SECRET || process.env.INTERNAL_API_SECRET || "viro-optout";
  return createHmac("sha256", secret).update(leadId).digest("hex").slice(0, 24);
}

function verifyToken(leadId: string, token: string): boolean {
  return token === buildOptoutToken(leadId);
}

async function markOptout(leadId: string, source: string): Promise<{ ok: boolean; alreadyOut?: boolean; error?: string }> {
  const sb = getSupabaseAdmin();

  const { data: lead, error: readErr } = await sb
    .from("leads")
    .select("id, whatsapp_optin, whatsapp_optout_at, name")
    .eq("id", leadId)
    .single();
  if (readErr || !lead) return { ok: false, error: "lead_not_found" };
  if (lead.whatsapp_optout_at) return { ok: true, alreadyOut: true };

  const { error: updateErr } = await sb
    .from("leads")
    .update({
      whatsapp_optin: false,
      whatsapp_optout_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Fecha conversas ativas — não bloqueia o opt-out se falhar
  await sb
    .from("conversations")
    .update({ status: "closed" })
    .eq("lead_id", leadId)
    .eq("status", "active");

  console.log(`[Optout] lead ${leadId} marked out (source=${source})`);
  return { ok: true };
}

function confirmationPageHtml(opts: { alreadyOut?: boolean; name?: string }): string {
  const greeting = opts.name ? opts.name.split(" ")[0] : "";
  const title = opts.alreadyOut
    ? "Acompanhamento já estava encerrado."
    : "Acompanhamento encerrado.";
  const sub = opts.alreadyOut
    ? "Nenhuma ação adicional necessária."
    : "Sua conta no site segue ativa — o diagnóstico e as teses de crescimento permanecem disponíveis para consulta quando quiser retomar.";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Virô — Saída da conversa</title>
<style>
body{margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#F7F5F2;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px;}
.card{background:#fff;border-radius:14px;padding:32px 28px;max-width:440px;width:100%;box-shadow:0 6px 28px rgba(0,0,0,0.06);text-align:center;}
.logo{font-family:'Cabinet Grotesk',sans-serif;font-weight:800;font-size:20px;letter-spacing:-0.02em;color:#161618;margin-bottom:20px;}
.logo span{color:#0F766E;}
h1{font-size:20px;color:#161618;margin:0 0 10px;letter-spacing:-0.01em;line-height:1.3;}
p{font-size:14px;color:#52525B;line-height:1.6;margin:0 0 16px;}
.greeting{font-size:13px;color:#A1A1AA;margin-bottom:12px;}
a.btn{display:inline-block;background:#B45309;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:14px;font-weight:600;}
.foot{font-size:11px;color:#A1A1AA;margin-top:24px;}
</style></head>
<body><div class="card">
<div class="logo">Virô<span>.</span></div>
${greeting ? `<div class="greeting">${greeting},</div>` : ""}
<h1>${title}</h1>
<p>${sub}</p>
<a class="btn" href="https://virolocal.com">Voltar pro site</a>
<div class="foot">Se quiser reativar a conversa, fala com a gente em <strong>thazutin@gmail.com</strong>.</div>
</div></body></html>`;
}

// ─── GET ?leadId=X&token=Y ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!leadId) return new NextResponse("leadId required", { status: 400 });
  if (!verifyToken(leadId, token)) return new NextResponse("invalid token", { status: 403 });

  const result = await markOptout(leadId, "email_link");
  if (!result.ok) return new NextResponse(`error: ${result.error}`, { status: 500 });

  const sb = getSupabaseAdmin();
  const { data: lead } = await sb.from("leads").select("name").eq("id", leadId).single();

  return new NextResponse(
    confirmationPageHtml({ alreadyOut: result.alreadyOut, name: lead?.name as string | undefined }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// ─── POST { leadId, source } ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { leadId, source } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    // Auth: header interno OU body com leadId válido vindo do webhook do Twilio
    // (o webhook é confiável porque vem do nosso próprio servidor após validar From).
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternal = !!internalSecret && internalSecret === process.env.INTERNAL_API_SECRET;
    const isInboundSource = source === "whatsapp_inbound";
    if (!isInternal && !isInboundSource) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const result = await markOptout(leadId, source || "api");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, alreadyOut: !!result.alreadyOut });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
