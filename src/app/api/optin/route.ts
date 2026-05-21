// ============================================================================
// /api/optin — Aceitar a cadência conversacional do WhatsApp
//
// GET /api/optin?leadId=X&token=Y  → marca opt-in + retorna página de confirmação
//
// Usado pelo backfill: e-mail "voltamos diferente" pros paid existentes
// contém um link único com token HMAC. Click = opt-in registrado.
//
// Token HMAC obrigatório — impede que terceiro inscreva o lead à força.
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

/** Gera o token HMAC pro link de opt-in por email. Sufixo "in" pra que tokens
 *  de opt-in e opt-out não sejam intercambiáveis. */
export function buildOptinToken(leadId: string): string {
  const secret = process.env.OPTOUT_SECRET || process.env.INTERNAL_API_SECRET || "viro-optout";
  return createHmac("sha256", secret).update(`optin:${leadId}`).digest("hex").slice(0, 24);
}

function verifyToken(leadId: string, token: string): boolean {
  return token === buildOptinToken(leadId);
}

function confirmationPageHtml(opts: { alreadyIn?: boolean; name?: string; hasWhatsapp: boolean }): string {
  const greeting = opts.name ? opts.name.split(" ")[0] : "";
  const title = opts.alreadyIn
    ? "Acompanhamento já estava ativo."
    : opts.hasWhatsapp
      ? "Acompanhamento ativado."
      : "Quase lá — falta o número de WhatsApp.";
  const sub = opts.alreadyIn
    ? "Próxima sexta-feira, a abertura da semana chega no seu WhatsApp. Nada a fazer agora."
    : opts.hasWhatsapp
      ? "Sexta-feira: abertura da semana com a prioridade estratégica para o seu negócio. Terça: checagem de execução. Quinta: balanço do ciclo. Você responde quando for possível."
      : "Adicione um número no seu painel para que eu possa iniciar o acompanhamento.";

  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Virô — Conversa ativada</title>
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
<a class="btn" href="https://virolocal.com/dashboard/">Abrir meu Radar</a>
<div class="foot">Para sair a qualquer momento, basta responder <strong>PARE</strong> no WhatsApp.</div>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!leadId) return new NextResponse("leadId required", { status: 400 });
  if (!verifyToken(leadId, token)) return new NextResponse("invalid token", { status: 403 });

  const sb = getSupabaseAdmin();

  const { data: lead, error: readErr } = await sb
    .from("leads")
    .select("id, name, whatsapp, whatsapp_optin, whatsapp_optout_at")
    .eq("id", leadId)
    .single();
  if (readErr || !lead) return new NextResponse("lead not found", { status: 404 });

  const alreadyIn = !!lead.whatsapp_optin && !lead.whatsapp_optout_at;

  if (!alreadyIn) {
    const { error: updateErr } = await sb
      .from("leads")
      .update({
        whatsapp_optin: true,
        whatsapp_optin_at: new Date().toISOString(),
        whatsapp_optout_at: null, // limpa opt-out anterior se houver
      })
      .eq("id", leadId);
    if (updateErr) return new NextResponse(`error: ${updateErr.message}`, { status: 500 });
    console.log(`[Optin] lead ${leadId} marked in (via email link)`);
  }

  return new NextResponse(
    confirmationPageHtml({
      alreadyIn,
      name: (lead.name as string) || undefined,
      hasWhatsapp: !!lead.whatsapp,
    }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
