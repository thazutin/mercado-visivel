// ============================================================================
// Viro — Task Content Generation Route
// POST: generates channel-specific content for a plan task via Claude
// File: src/app/api/tasks/[taskId]/content/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5-20250929";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Channel-specific prompt templates ──────────────────────────────

const CHANNEL_PROMPTS: Record<string, string> = {
  instagram: `Você é um estrategista de conteúdo para Instagram de negócios locais.

NEGÓCIO: {business_name} — {product} em {region}
TAREFA: {task_title}
DESCRIÇÃO: {task_description}

Gere um conteúdo pronto para postar no Instagram. Inclua:

1. **Legenda completa** (com emojis estratégicos, hashtags locais, CTA)
2. **Sugestão visual** (o que fotografar/filmar, enquadramento, cenário)
3. **Formato recomendado** (Reels, carrossel ou post estático — justifique)
4. **Horário sugerido** para postar
5. **3 variações de primeira linha** (hook) para testar

Use linguagem natural e autêntica — nada de "somos a melhor empresa".
O tom é de quem conhece o bairro e fala com vizinhos.
Adapte ao negócio real: use o produto, a região, e o contexto local.`,

  google_maps: `Você é especialista em Google Meu Negócio / Google Maps para negócios locais.

NEGÓCIO: {business_name} — {product} em {region}
TAREFA: {task_title}
DESCRIÇÃO: {task_description}

Gere conteúdo e instruções práticas para esta tarefa no Google Maps/GMB. Inclua:

1. **Texto para a ação** (post do GMB, resposta a avaliação, descrição atualizada — o que for relevante)
2. **Passo a passo** para executar no Google Meu Negócio (tela por tela)
3. **Script para pedir avaliações** (se relevante: mensagem para enviar a clientes por WhatsApp)
4. **Checklist de otimização** aplicável a esta tarefa

Seja específico: use o nome do negócio, produto e região.
Nada genérico. O dono do negócio deve conseguir executar em 15 minutos.`,

  whatsapp: `Você é especialista em comunicação por WhatsApp para negócios locais.

NEGÓCIO: {business_name} — {product} em {region}
TAREFA: {task_title}
DESCRIÇÃO: {task_description}

Gere conteúdo pronto para WhatsApp. Inclua:

1. **Mensagem principal** (pronta para copiar e enviar)
2. **Variações** para diferentes contextos (cliente novo, cliente recorrente, pós-venda)
3. **Sugestão de lista de transmissão** (se aplicável)
4. **Horário ideal** para enviar
5. **Dicas de tom** (direto mas cordial, personalizado)

O tom deve ser pessoal — como se fosse o dono mandando mensagem.
Sem parecer robótico. Use o nome do produto e região para personalizar.`,

  geral: `Você é um consultor de marketing local prático e direto.

NEGÓCIO: {business_name} — {product} em {region}
TAREFA: {task_title}
DESCRIÇÃO: {task_description}

Gere um guia prático e conteúdo para executar esta tarefa. Inclua:

1. **O que fazer** — ação concreta em linguagem simples
2. **Texto/template** — conteúdo pronto para usar (se aplicável)
3. **Passo a passo** — como executar, do início ao fim
4. **Tempo estimado** — quanto tempo leva para fazer
5. **Como saber se deu certo** — indicador simples de sucesso

Seja prático. O dono do negócio não tem equipe de marketing.
Use o contexto real: produto, região, e o objetivo específico da tarefa.`,
};

function buildPrompt(
  channel: string,
  businessName: string,
  product: string,
  region: string,
  taskTitle: string,
  taskDescription: string,
): string {
  const template = CHANNEL_PROMPTS[channel] || CHANNEL_PROMPTS.geral;
  return template
    .replace(/\{business_name\}/g, businessName)
    .replace(/\{product\}/g, product)
    .replace(/\{region\}/g, region)
    .replace(/\{task_title\}/g, taskTitle)
    .replace(/\{task_description\}/g, taskDescription || taskTitle);
}

// ─── POST handler ───────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  if (!taskId) {
    return NextResponse.json({ error: "taskId obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

  // ─── Auth: verify user is authenticated ───
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // ─── Try to load task from plan_tasks table ───
  let task: any = null;
  let lead: any = null;

  try {
    const { data: taskData, error: taskError } = await supabase
      .from("plan_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (!taskError && taskData) {
      task = taskData;

      // Verify ownership: lead must belong to user
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", task.lead_id)
        .eq("clerk_user_id", userId)
        .single();

      if (!leadData) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
      lead = leadData;
    }
  } catch {
    // plan_tasks table may not exist — fall through to weeklyPlan lookup
  }

  // ─── Fallback: taskId is "leadId:weekIndex" format for weeklyPlan tasks ───
  if (!task && taskId.includes(":")) {
    const [leadId, weekIndexStr] = taskId.split(":");
    const weekIndex = parseInt(weekIndexStr, 10);

    if (!leadId || isNaN(weekIndex)) {
      return NextResponse.json({ error: "Formato de taskId inválido" }, { status: 400 });
    }

    // Verify ownership
    const { data: leadData } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .eq("clerk_user_id", userId)
      .single();

    if (!leadData) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    lead = leadData;

    // Load plan
    const { data: plan } = await supabase
      .from("plans")
      .select("content")
      .eq("lead_id", leadId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const weeklyPlan = plan?.content?.weeklyPlan || plan?.content?.weekly_plan;
    if (!Array.isArray(weeklyPlan) || !weeklyPlan[weekIndex]) {
      return NextResponse.json({ error: "Tarefa não encontrada no plano" }, { status: 404 });
    }

    const weekTask = weeklyPlan[weekIndex];
    task = {
      id: taskId,
      lead_id: leadId,
      title: weekTask.title || weekTask.action || "",
      description: weekTask.mainAction || weekTask.script || "",
      channel: weekTask.category || "geral",
      week: weekTask.week || weekIndex + 1,
    };
  }

  if (!task || !lead) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  // ─── Map task category to channel ───
  const channelMap: Record<string, string> = {
    presence: "google_maps",
    content: "instagram",
    authority: "geral",
    engagement: "whatsapp",
    instagram: "instagram",
    google_maps: "google_maps",
    whatsapp: "whatsapp",
    geral: "geral",
  };
  const channel = channelMap[task.channel || "geral"] || "geral";

  // ─── Build prompt and call Claude ───
  const businessName = lead.name || lead.product;
  const prompt = buildPrompt(
    channel,
    businessName,
    lead.product,
    lead.region,
    task.title,
    task.description || task.mainAction || "",
  );

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0.4,
      system: "Você é o gerador de conteúdo do Virô — plataforma de inteligência de mercado local. Gere conteúdo prático, direto e pronto para usar. Responda em português (pt-BR). Use markdown para formatação.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");

    console.log(`[TaskContent] Generated content for task ${taskId} (channel: ${channel})`);

    return NextResponse.json({ content: text });
  } catch (err) {
    console.error("[TaskContent] Claude error:", err);
    return NextResponse.json({ error: "Erro ao gerar conteúdo" }, { status: 500 });
  }
}
