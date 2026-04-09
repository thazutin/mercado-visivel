// ============================================================================
// Virô — Co-pilot de respostas a reviews do Google
// Lê reviews scrapeadas do diagnóstico, gera drafts via Claude Haiku no tom
// inferido do negócio (nível 1) e persiste em review_responses.
// Chamado por:
//   - POST /api/reviews/generate (on-demand, quando dono clica "Gerar respostas")
//   - Cron semanal (pra detectar reviews novas em assinantes)
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { ScrapedReview } from "@/lib/types/pipeline.types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ISO week number (pra agrupar na aba semanal)
function isoWeek(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface GenerateResult {
  generated: number;
  skipped: number;
  total: number;
}

export async function generateReviewResponses(
  leadId: string,
  options: { weekNumber?: number } = {},
): Promise<GenerateResult> {
  const supabase = getSupabaseAdmin();

  // 1. Busca lead + diagnosis
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, product, region, customer_description")
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) throw new Error(`Lead ${leadId} não encontrado`);

  const { data: diagnosis } = await supabase
    .from("diagnoses")
    .select("raw_data")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const reviews: ScrapedReview[] =
    diagnosis?.raw_data?.influence?.rawGoogle?.mapsPresence?.reviews || [];

  if (reviews.length === 0) {
    console.log(`[ReviewCopilot] Sem reviews scrapeadas para lead ${leadId}`);
    return { generated: 0, skipped: 0, total: 0 };
  }

  // 2. Dedup — filtra reviews que já têm response_draft no DB
  const { data: existing } = await supabase
    .from("review_responses")
    .select("external_review_id")
    .eq("lead_id", leadId);
  const existingIds = new Set((existing || []).map((r: any) => r.external_review_id));
  const pending = reviews.filter((r) => !existingIds.has(r.externalId));

  if (pending.length === 0) {
    console.log(`[ReviewCopilot] Todas ${reviews.length} reviews já têm draft gerado`);
    return { generated: 0, skipped: reviews.length, total: reviews.length };
  }

  // 3. Chama Claude Haiku em batch
  const businessName = lead.name || lead.product || "nosso negócio";
  const product = lead.product || "";
  const region = lead.region || "";
  const customerDesc = lead.customer_description || "";

  const prompt = `Você é um assistente que escreve respostas profissionais e acolhedoras para avaliações no Google Meu Negócio.

NEGÓCIO:
- Nome: ${businessName}
- Produto/serviço: ${product}
- Região: ${region}
${customerDesc ? `- Cliente típico: ${customerDesc}` : ""}

TOM INFERIDO: profissional, acolhedor, em primeira pessoa do plural ("nós", "nossa equipe"), PT-BR, direto ao ponto.

REGRAS:
- Responda CADA avaliação individualmente
- Agradeça pelo nome quando disponível
- Para 5 estrelas: agradeça, reforce que é sempre bem-vindo
- Para 4 estrelas: agradeça, mostre abertura pra melhorar
- Para 1-3 estrelas: peça desculpas genuínas, ofereça contato direto pra resolver, sem ser defensivo
- Máximo 40 palavras por resposta
- Termine com assinatura: "— Equipe ${businessName}"
- NÃO invente fatos ou promessas específicas
- NÃO use emojis

AVALIAÇÕES PARA RESPONDER:
${pending
  .map(
    (r, i) =>
      `[${i + 1}] ${r.authorName || "Cliente"} (${r.rating}⭐): "${r.text.slice(0, 500)}"`,
  )
  .join("\n\n")}

Retorne APENAS um JSON válido no formato:
{"responses": [{"index": 1, "response": "texto da resposta"}, {"index": 2, "response": "..."}]}`;

  let drafts: Array<{ index: number; response: string }> = [];
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2500,
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      drafts = parsed.responses || [];
    }
  } catch (err) {
    console.error("[ReviewCopilot] Claude error:", err);
    throw new Error("Falha ao gerar respostas. Tente novamente.");
  }

  // 4. Persiste em review_responses
  const weekNumber = options.weekNumber ?? isoWeek();
  const rows = pending
    .map((review, idx) => {
      const draft = drafts.find((d) => d.index === idx + 1)?.response;
      if (!draft) return null;
      return {
        lead_id: leadId,
        external_review_id: review.externalId,
        author_name: review.authorName,
        rating: review.rating,
        review_text: review.text,
        review_date: review.date,
        has_owner_response: false,
        draft_response: draft,
        status: "pending",
        week_number: weekNumber,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from("review_responses").insert(rows);
    if (insertErr) {
      console.error("[ReviewCopilot] insert error:", insertErr);
      throw new Error("Falha ao salvar respostas.");
    }
  }

  console.log(
    `[ReviewCopilot] lead ${leadId}: generated=${rows.length}, skipped=${existingIds.size}, total=${reviews.length}`,
  );

  return {
    generated: rows.length,
    skipped: existingIds.size,
    total: reviews.length,
  };
}
