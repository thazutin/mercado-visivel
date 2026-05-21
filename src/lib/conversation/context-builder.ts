// ============================================================================
// Virô — Context Builder pra Loop Conversacional WhatsApp
//
// Carrega TUDO que o bot precisa pra responder com qualidade de consultor:
//   1. Perfil do negócio (leads)
//   2. Diagnóstico (lead.diagnosis_display)
//   3. 3 Teses de crescimento (lead.growth_machine.strategicPillars)
//   4. Checklist do básico (checklists.items)
//   5. Ciclo ativo (weekly_cycles status=opened|engaged) se houver
//   6. Memória do negócio (business_memory)
//   7. Últimos 12 turnos da conversa (messages)
//
// Tudo já vive no DB — só puxa e estrutura num system prompt em camadas.
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ContextBundle {
  systemPrompt: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  meta: {
    leadId: string;
    activeCycleId: string | null;
    pillarsCount: number;
    memoryCount: number;
    messagesLoaded: number;
    signalsLoaded: boolean;
  };
}

function getSb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ─── Summarizers (cada um corta com cuidado pra caber no contexto) ──────────

function summarizeDiagnosis(d: any): string {
  if (!d || typeof d !== "object") return "Diagnóstico ainda não disponível.";
  const parts: string[] = [];
  parts.push(`Score de mercado: ${d.influencePercent ?? 0}/100`);
  if (d.maps?.found) {
    parts.push(`Google Maps: ★${d.maps.rating ?? "?"} · ${d.maps.reviewCount ?? 0} reviews · ${d.maps.photos ?? 0} fotos`);
  } else {
    parts.push(`Google Maps: NÃO encontrado`);
  }
  if (d.instagram?.dataAvailable) {
    parts.push(`Instagram @${d.instagram.handle}: ${d.instagram.followers ?? 0} seg · ${d.instagram.postsLast30d ?? 0} posts/30d · ${((d.instagram.engagementRate ?? 0) * 100).toFixed(1)}% eng`);
  }
  if (d.audiencia?.audienciaTarget) {
    parts.push(`Audiência estimada: ${d.audiencia.audienciaTarget} ${d.clientType === "b2b" ? "empresas" : "pessoas"} no raio${d.audiencia.raioKm ? ` ${d.audiencia.raioKm}km` : ""}`);
  }
  if (d.totalVolume) parts.push(`Volume de busca: ${d.totalVolume}/mês`);
  if (d.projecaoFinanceira?.receitaAtual && d.projecaoFinanceira?.receitaPotencial) {
    parts.push(`Receita estimada: R$${Math.round(d.projecaoFinanceira.receitaAtual / 1000)}k hoje → R$${Math.round(d.projecaoFinanceira.receitaPotencial / 1000)}k potencial`);
  }
  if (Array.isArray(d.competitorInstagram) && d.competitorInstagram.length > 0) {
    const top = d.competitorInstagram.slice(0, 3).map((c: any) => `@${c.handle} (${c.followers ?? 0} seg, ${c.postsLast30d ?? 0} posts/30d)`).join(", ");
    parts.push(`Concorrentes: ${top}`);
  }
  if (d.honestReading) {
    parts.push(`\nLeitura honesta inicial: ${d.honestReading}`);
  }
  return parts.join("\n");
}

function summarizePillars(pillars: any[]): string {
  if (!Array.isArray(pillars) || pillars.length === 0) return "Teses ainda não geradas.";
  return pillars.slice(0, 3).map((p, i) => {
    const meta = [p.targetMetric, p.timeline].filter(Boolean).join(" · ");
    return `[${p.id || `pilar-${i + 1}`}] ${p.title}
  Por quê: ${p.description}
  ${meta ? `Meta/Timeline: ${meta}` : ""}
  ${p.items?.length ? `${p.items.length} etapas executáveis` : ""}`.trim();
  }).join("\n\n");
}

function summarizeChecklist(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return "Sem checklist ainda.";
  return items.slice(0, 10).map((i: any) => {
    const status = i.status === "done" ? "✓" : i.completed ? "✓" : "○";
    return `${status} ${i.title}`;
  }).join("\n");
}

function summarizeMemory(memories: any[]): string {
  if (!Array.isArray(memories) || memories.length === 0) return "Sem aprendizados registrados ainda — esta é nossa primeira conversa.";
  return memories.slice(0, 40).map((m) => `[${m.category}/${m.confidence}] ${m.content}`).join("\n");
}

// ─── Main ──────────────────────────────────────────────────────────────────

export async function buildContextBundle(leadId: string): Promise<ContextBundle> {
  const sb = getSb();

  // 1. Perfil + diagnóstico + growth_machine
  const { data: lead } = await sb
    .from("leads")
    .select("id, name, product, region, instagram, site, ticket, challenge, "
          + "client_type, blueprint_id, diagnosis_display, growth_machine, "
          + "subscription_status, paid_at, whatsapp_optin")
    .eq("id", leadId)
    .single();
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const diagnosis = (lead.diagnosis_display as any) || {};
  const growthMachine = (lead.growth_machine as any) || {};
  const pillars = growthMachine.strategicPillars || [];

  // 2. Ciclo ativo (se já tem Sprint 4 ativo — caso contrário fica null)
  const { data: activeCycle } = await sb
    .from("weekly_cycles")
    .select("id, week_iso, theme_short, theme_full, theme_category, linked_pillar_id, status, priority_action, priority_reason, evolution_step")
    .eq("lead_id", leadId)
    .in("status", ["opened", "engaged", "checked"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2b. Sinais semanais do ciclo ativo (bruto — diferente dos signals_used já destilados em priority_reason)
  let weeklySignals: any = null;
  if (activeCycle?.week_iso) {
    const { data: sig } = await sb
      .from("weekly_signals")
      .select("week_iso, macro, competitors, own_business, linked_pillars")
      .eq("lead_id", leadId)
      .eq("week_iso", activeCycle.week_iso)
      .maybeSingle();
    weeklySignals = sig;
  }

  // 3. Checklist mais recente
  const { data: checklist } = await sb
    .from("checklists")
    .select("items")
    .eq("lead_id", leadId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Memória do negócio (40 mais recentes)
  const { data: memories } = await sb
    .from("business_memory")
    .select("category, topic, content, confidence, linked_pillar_id, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(40);

  // 5. Conversa: pega a ativa OU mais recente. Se nenhuma, retorna histórico vazio.
  const { data: conv } = await sb
    .from("conversations")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: any[] = [];
  if (conv?.id) {
    const { data: msgs } = await sb
      .from("messages")
      .select("direction, body, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(12);
    messages = (msgs || []).reverse(); // cronológico crescente pro Claude
  }

  const conversationHistory: { role: "user" | "assistant"; content: string }[] = messages
    .filter((m) => m.body && m.body.trim())
    .map((m) => ({
      role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
      content: m.body as string,
    }));

  // ─── System Prompt em camadas ─────────────────────────────────────────────

  const shortRegion = (lead.region as string)?.split(",")[0]?.trim() || "";
  const displayName = (lead.name as string) || (lead.product as string) || "o negócio";
  const isSubscriber = lead.subscription_status === "active";

  // Bloco do tema da semana (ação proposta + raciocínio do planner)
  const cycleBlock = activeCycle
    ? `══════ TEMA DESTA SEMANA (${activeCycle.week_iso}) ══════
Tema curto (no template Meta): ${activeCycle.theme_short}
Tema completo: ${activeCycle.theme_full}
Categoria: ${activeCycle.theme_category}${activeCycle.linked_pillar_id ? ` · vinculado à ${activeCycle.linked_pillar_id}` : ""}
Status do ciclo: ${activeCycle.status}${activeCycle.evolution_step ? ` (passo ${activeCycle.evolution_step} dentro desta tese)` : ""}
${activeCycle.priority_action ? `
AÇÃO PRIORITÁRIA (montada pelo planner com Opus na 5ª passada):
${JSON.stringify(activeCycle.priority_action, null, 2)}` : ""}
${activeCycle.priority_reason ? `
RACIOCÍNIO DO PLANNER (por que ele escolheu este tema):
${JSON.stringify(activeCycle.priority_reason, null, 2)}` : ""}`
    : `══════ MODO AD-HOC ══════
Não há ciclo semanal ativo. Você está em conversa livre — pode propor foco se houver sinal claro,
mas respeite o tópico que o usuário trouxer.`;

  // Bloco dos sinais brutos da semana (alimenta "por quê agora" e dá lastro)
  const signalsBlock = weeklySignals
    ? `══════ SINAIS DESTA SEMANA (coletados na 5ª anterior) ══════
${weeklySignals.macro?.summary ? `MACRO: ${String(weeklySignals.macro.summary).slice(0, 400)}` : "MACRO: (sem dado relevante)"}

CONCORRENTES:
${Array.isArray(weeklySignals.competitors) && weeklySignals.competitors.length > 0
  ? weeklySignals.competitors.map((c: any) => `• @${c.handle}: ${c.signal}`).join("\n")
  : "(sem movimento relevante mapeado)"}

SEU NEGÓCIO (vs semana anterior):
${weeklySignals.own_business
  ? [
      `Score: ${weeklySignals.own_business.score_current ?? "—"}/100${weeklySignals.own_business.score_delta != null ? ` (Δ ${weeklySignals.own_business.score_delta > 0 ? "+" : ""}${weeklySignals.own_business.score_delta})` : ""}`,
      weeklySignals.own_business.reviews_delta != null && weeklySignals.own_business.reviews_delta !== 0
        ? `Reviews: ${weeklySignals.own_business.reviews_count_current ?? "?"} (Δ ${weeklySignals.own_business.reviews_delta > 0 ? "+" : ""}${weeklySignals.own_business.reviews_delta})`
        : null,
      weeklySignals.own_business.ig_posts_delta != null && weeklySignals.own_business.ig_posts_delta !== 0
        ? `Posts Instagram: Δ ${weeklySignals.own_business.ig_posts_delta > 0 ? "+" : ""}${weeklySignals.own_business.ig_posts_delta} vs semana anterior`
        : null,
    ].filter(Boolean).join(" · ")
  : "(sem dados próprios coletados)"}

TESES TOCADAS POR ESTES SINAIS: ${Array.isArray(weeklySignals.linked_pillars) ? weeklySignals.linked_pillars.join(", ") : "(nenhuma)"}`
    : "";

  const systemPrompt = `Você é a Virô — consultora estratégica de marketing do ${displayName} (${(lead.product as string)} · ${shortRegion}).

══════ QUEM VOCÊ É ══════
• Você pensa marketing como diretora de revenue growth de empresa grande pensa — frameworks, alavancas, jornada do cliente, posicionamento, custo de aquisição vs valor do cliente, ciclo de vendas — mas TRADUZ para linguagem clara, sem jargão.
  ✗ "Seu CAC está desfavorável" / "PLG" / "ICP"
  ✓ "O custo de trazer cada cliente novo está alto comparado ao que ele deixa" / "qual perfil de cliente é o seu mais valioso"
• Você é INSIGHTFUL: conecta pontos que o dono não vê — padrão de comportamento, movimento de concorrente, sinal macro do setor — sempre ancorado em DADO concreto.
• Você OUVE com atenção: se o dono diz "não consegui executar", não insiste — pergunta o que travou. Se diz "estou sem tempo", reduz o escopo da próxima ação.
• Você é DIRETA E PROFISSIONAL: 2-4 frases por mensagem. Uma pergunta por mensagem no máximo. Tom de consultora sênior, não de amiga casual.
  ✗ "Bora?" / "Top!" / "Show!" / "Tá rolando?"
  ✓ "Faz sentido avançarmos por aí?" / "Posso te apresentar o plano?" / "Como está a execução?"
• Você NUNCA inventa número. Só usa o que está no contexto abaixo. Se não tem dado, diz claramente que não tem.

══════ NEGÓCIO ══════
Nome: ${displayName}
Produto: ${lead.product}
Região: ${shortRegion}
Tipo: ${lead.client_type || "b2c"} · Blueprint: ${lead.blueprint_id || "—"}
Desafio declarado pelo dono: ${lead.challenge || "não declarou"}
Ticket: ${lead.ticket || "não declarado"}
Status: ${isSubscriber ? "Assinante do Radar" : (lead.paid_at ? "Pagou one-time" : "Free")}

══════ DIAGNÓSTICO (link público: virolocal.com/resultado/${leadId}) ══════
${summarizeDiagnosis(diagnosis)}

══════ AS 3 TESES DE CRESCIMENTO ══════
${summarizePillars(pillars)}

══════ CHECKLIST DO BÁSICO ══════
${summarizeChecklist(checklist?.items as any[] || [])}

${cycleBlock}

${signalsBlock}

══════ MEMÓRIA ACUMULADA (${memories?.length ?? 0} aprendizados) ══════
${summarizeMemory(memories || [])}

══════ COMANDOS DE GATILHO (templates Meta) ══════
Os 3 momentos da cadência semanal chegam pelo template Meta. O usuário pode clicar no botão do
template (que abre o WhatsApp com texto pré-digitado) e enviar a mensagem com texto ligeiramente
variado — "Ver o plano", "ver plano", "Plano da semana", "Quero ver", etc. Reconheça SEMÂNTICA,
não literal. Os 3 gatilhos:

GATILHO ABERTURA — mensagens contendo: "ver o plano", "plano da semana", "ver plano",
  "quero o plano", "começar", "iniciar a semana" (qualquer variação que indique "quero saber qual
  é a estratégia desta semana").
  Resposta: apresente a AÇÃO PRIORITÁRIA ancorada nos SINAIS DESTA SEMANA. Cite o concorrente
  nominado / o delta de score / o sinal macro — o que for mais relevante. Estrutura: 1-2 frases
  de "por que agora" com dado concreto + visão geral em 3 partes do how_to + ofereça mandar o
  primeiro copy_block ("Posso te mandar o script de abordagem?"). Termine perguntando por onde
  ele quer começar.

GATILHO CHECKPOINT — mensagens contendo: "atualizar status", "status", "como tá", "andamento",
  "atualizar", "checagem".
  Resposta: REFERENCIE o compromisso específico que ficou no último turno (do priority_action.how_to
  ou do que foi capturado em business_memory). Não pergunte genérico "como tá indo" — pergunte
  sobre a etapa concreta. Se evidente que não executou, ofereça reduzir escopo da semana.

GATILHO FECHAMENTO — mensagens contendo: "revisar ciclo", "balanço", "fechar semana", "fazer
  balanço", "fechar ciclo".
  Resposta: peça o balanço usando as perguntas em priority_action.measure_on_thursday. Capture
  TUDO o que ele compartilhar como <memory> (resultado executado, obstáculo, aprendizado, comportamento
  observado do cliente/concorrente). Sinalize que esse aprendizado pauta a proposta da próxima sexta.

REGRAS PRA GATILHOS:
• Não exija texto literal — o pre-fill do wa.me pode ser editado pelo usuário.
• Se a mensagem é claramente um dos 3 gatilhos, EXECUTE o branch específico, não responda como conversa livre.
• Se for ambígua (ex: "oi"), responda perguntando se quer ver o plano da semana ou tem outro assunto.

══════ REGRAS DE RESPOSTA ══════
1. SEMPRE ancore em dado específico do contexto acima quando relevante (cite review count, follower number, concorrente nominado, etc.). Sem dado = sem afirmação.
2. SEMPRE 2-4 frases. WhatsApp não suporta paredão de texto.
3. NO MÁXIMO uma pergunta por mensagem — e só se for útil para o próximo passo.
4. Quando o usuário relatar uma AÇÃO EXECUTADA, ou trouxer uma INFORMAÇÃO NOVA sobre o negócio/clientes/concorrentes, CAPTURE como aprendizado. No fim da sua resposta, adicione um bloco JSON entre tags <memory></memory>:
   <memory>{"category":"tactic|customer|competitor|self|market","topic":"tag curta","content":"frase de aprendizado","confidence":"observed|hypothesis|confirmed"${activeCycle?.linked_pillar_id ? `,"linked_pillar_id":"${activeCycle.linked_pillar_id}"` : ""}}</memory>
   A tag NUNCA aparece para o usuário — o sistema remove antes de enviar.
   Use múltiplas tags <memory>...</memory> se houver múltiplos aprendizados.
   Se a mensagem não trouxer aprendizado novo, NÃO adicione tag.
5. Se o usuário derivar do tema ativo da semana, registre o que ele trouxe e reconduza ao foco sem ser brusca.
6. PT-BR sempre. Tratamento "você". Sem gírias, sem "bora", "top", "tá indo". Emojis com parcimônia (máx 1 por mensagem, só quando agregar significado).
7. Encerre cada resposta com 1 frase de próximo passo OU 1 pergunta — nunca as duas. Sem exclamações fáceis.`;

  return {
    systemPrompt,
    conversationHistory,
    meta: {
      leadId,
      activeCycleId: activeCycle?.id || null,
      pillarsCount: pillars.length,
      memoryCount: memories?.length || 0,
      messagesLoaded: conversationHistory.length,
      signalsLoaded: !!weeklySignals,
    },
  };
}
