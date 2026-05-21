/**
 * scripts/smoke-cycle.ts
 *
 * End-to-end smoke test pra cadência conversacional. Permite validar cada
 * peça isoladamente, sem precisar esperar os crons.
 *
 * Modos (do mais seguro ao mais real):
 *
 *   --check-config
 *       Valida env vars e dependencies. Não toca em DB nem envia nada.
 *
 *   --leadId <uuid> --signals
 *       Coleta sinais semanais (NÃO persiste) e mostra o bundle.
 *
 *   --leadId <uuid> --plan
 *       Roda signals + planner com Opus (NÃO persiste). Mostra o PlannedCycle.
 *
 *   --leadId <uuid> --plan --persist
 *       Persiste signals em weekly_signals + cycle em weekly_cycles ('planned').
 *
 *   --leadId <uuid> --simulate "Ver o plano"
 *       Build contexto + chama Claude Sonnet + mostra resposta + memory tags
 *       extraídas. NÃO envia WhatsApp. Não persiste mensagens nem memória.
 *
 *   --leadId <uuid> --open
 *       Dispara template Meta `viro_abertura_semanal` (REAL — envia WhatsApp!).
 *       Requer template aprovado + WA_TEMPLATE_ABERTURA_SEMANAL + WHATSAPP_ENABLED=true.
 *       Atualiza cycle pra status='opened'. Cria conversation.
 *
 *   --leadId <uuid> --close
 *       Dispara template Meta `viro_fechamento_semanal` (REAL!) e fecha cycle.
 *
 * Combine flags pra rodar várias etapas em sequência:
 *   npx tsx scripts/smoke-cycle.ts --leadId abc --signals --plan --persist --simulate "Ver o plano"
 *
 * Pré-requisitos:
 *   • .env.local com SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY
 *   • Schema v3 aplicado no Supabase
 *   • Pra --simulate/--open: TWILIO_* + WHATSAPP_ENABLED + WA_TEMPLATE_* (real send only)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ─── Args parsing ──────────────────────────────────────────────────────────

interface Args {
  leadId?: string;
  checkConfig: boolean;
  signals: boolean;
  plan: boolean;
  persist: boolean;
  simulate?: string;
  open: boolean;
  close: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    leadId: undefined,
    checkConfig: argv.includes("--check-config"),
    signals: argv.includes("--signals"),
    plan: argv.includes("--plan"),
    persist: argv.includes("--persist"),
    simulate: undefined,
    open: argv.includes("--open"),
    close: argv.includes("--close"),
  };

  const leadIdx = argv.indexOf("--leadId");
  if (leadIdx >= 0 && argv[leadIdx + 1]) args.leadId = argv[leadIdx + 1];

  const simIdx = argv.indexOf("--simulate");
  if (simIdx >= 0 && argv[simIdx + 1]) args.simulate = argv[simIdx + 1];

  return args;
}

// ─── Output helpers ────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function header(title: string) {
  const bar = "═".repeat(72);
  console.log(`\n${C.cyan}${C.bold}${bar}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${title}${C.reset}`);
  console.log(`${C.cyan}${C.bold}${bar}${C.reset}\n`);
}

function ok(msg: string) {
  console.log(`${C.green}✓${C.reset} ${msg}`);
}
function warn(msg: string) {
  console.log(`${C.yellow}!${C.reset} ${msg}`);
}
function fail(msg: string) {
  console.log(`${C.red}✗${C.reset} ${msg}`);
}
function dim(msg: string) {
  console.log(`${C.dim}${msg}${C.reset}`);
}

// ─── 1. Check Config ───────────────────────────────────────────────────────

function checkConfig(): boolean {
  header("CHECK CONFIG · env vars e dependências");

  const required = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", critical: true },
    { name: "SUPABASE_SERVICE_ROLE_KEY", critical: true, fallback: "NEXT_PUBLIC_SUPABASE_ANON_KEY" },
    { name: "ANTHROPIC_API_KEY", critical: true },
    { name: "WHATSAPP_ENABLED", critical: false, expected: "true" },
    { name: "TWILIO_ACCOUNT_SID", critical: false },
    { name: "TWILIO_AUTH_TOKEN", critical: false },
    { name: "TWILIO_WHATSAPP_FROM", critical: false },
    { name: "WA_TEMPLATE_ABERTURA_SEMANAL", critical: false, note: "ContentSid Meta aprovado" },
    { name: "WA_TEMPLATE_CHECKPOINT_SEMANAL", critical: false, note: "ContentSid Meta aprovado" },
    { name: "WA_TEMPLATE_FECHAMENTO_SEMANAL", critical: false, note: "ContentSid Meta aprovado" },
    { name: "OPTOUT_SECRET", critical: false, note: "HMAC do link de opt-out/opt-in" },
    { name: "RESEND_API_KEY", critical: false },
    { name: "CRON_SECRET", critical: false, note: "Auth dos crons em prod" },
  ];

  let criticalMissing = false;
  for (const r of required) {
    const val = process.env[r.name];
    const fallback = r.fallback ? process.env[r.fallback] : null;
    const present = !!(val || fallback);

    if (present) {
      const shown = val ? `(${val.slice(0, 8)}…)` : `(via ${r.fallback})`;
      const note = r.note ? ` ${C.dim}— ${r.note}${C.reset}` : "";
      if (r.expected && val !== r.expected) {
        warn(`${r.name} = "${val}" ${C.dim}(esperado: "${r.expected}")${C.reset}${note}`);
      } else {
        ok(`${r.name} ${shown}${note}`);
      }
    } else {
      if (r.critical) {
        fail(`${r.name} ${C.bold}AUSENTE${C.reset}`);
        criticalMissing = true;
      } else {
        const note = r.note ? ` ${C.dim}— ${r.note}${C.reset}` : "";
        warn(`${r.name} ausente${note}`);
      }
    }
  }

  return !criticalMissing;
}

// ─── DB helper ─────────────────────────────────────────────────────────────

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getLead(leadId: string): Promise<any | null> {
  const sb = getSb();
  const { data, error } = await sb
    .from("leads")
    .select("id, name, product, region, whatsapp, subscription_status, paid_at, whatsapp_optin, whatsapp_optout_at, blueprint_id, growth_machine")
    .eq("id", leadId)
    .single();
  if (error || !data) return null;
  return data;
}

async function describeLead(lead: any) {
  const dim = (s: string) => `${C.dim}${s}${C.reset}`;
  console.log(`Lead: ${C.bold}${lead.name || lead.product}${C.reset} ${dim(`(${lead.id})`)}`);
  console.log(`  ${dim("Produto:")} ${lead.product}`);
  console.log(`  ${dim("Região:")} ${lead.region}`);
  console.log(`  ${dim("WhatsApp:")} ${lead.whatsapp || "(vazio)"} ${lead.whatsapp_optin ? C.green + "(opt-in)" + C.reset : C.yellow + "(sem opt-in)" + C.reset}${lead.whatsapp_optout_at ? " " + C.red + "(opt-out)" + C.reset : ""}`);
  console.log(`  ${dim("Status:")} ${lead.subscription_status || (lead.paid_at ? "paid" : "free")}`);
  console.log(`  ${dim("Blueprint:")} ${lead.blueprint_id || "—"}`);
  const pillars = (lead.growth_machine as any)?.strategicPillars;
  console.log(`  ${dim("Teses geradas:")} ${Array.isArray(pillars) ? pillars.length : 0}`);
  if (Array.isArray(pillars)) {
    pillars.forEach((p: any, i: number) => {
      console.log(`    ${C.dim}[${p.id || `pilar-${i + 1}`}]${C.reset} ${p.title}`);
    });
  }
}

// ─── 2. Signals ────────────────────────────────────────────────────────────

async function runSignals(leadId: string, persist: boolean) {
  header("SIGNALS · coletor semanal");
  const { collectWeeklySignals, persistWeeklySignals } = await import("../src/lib/signals/collector");

  const bundle = await collectWeeklySignals(leadId);
  console.log(`Week: ${C.bold}${bundle.weekIso}${C.reset}`);
  console.log(`Material signal: ${bundle.hasMaterialSignal ? C.green + "SIM" + C.reset : C.yellow + "fraco" + C.reset}`);
  console.log(`\n${C.bold}Macro:${C.reset}`);
  if (bundle.macro) {
    console.log(`  ${bundle.macro.summary.slice(0, 200)}${bundle.macro.summary.length > 200 ? "…" : ""}`);
    bundle.macro.indicators.forEach((i) => console.log(`  · ${i.name}: ${i.value} (${i.impact})`));
  } else {
    dim("  (sem macro_context no diagnoses)");
  }
  console.log(`\n${C.bold}Concorrentes (${bundle.competitors.length}):${C.reset}`);
  bundle.competitors.forEach((c) => console.log(`  @${c.handle} → ${c.signal}`));
  console.log(`\n${C.bold}Próprio negócio:${C.reset}`);
  if (bundle.ownBusiness) {
    console.log(`  Score: ${bundle.ownBusiness.score_current}/100${bundle.ownBusiness.score_delta != null ? ` (Δ ${bundle.ownBusiness.score_delta > 0 ? "+" : ""}${bundle.ownBusiness.score_delta})` : ""}`);
    if (bundle.ownBusiness.reviews_delta != null) console.log(`  Reviews delta: ${bundle.ownBusiness.reviews_delta > 0 ? "+" : ""}${bundle.ownBusiness.reviews_delta}`);
    if (bundle.ownBusiness.ig_posts_delta != null) console.log(`  Posts IG delta: ${bundle.ownBusiness.ig_posts_delta > 0 ? "+" : ""}${bundle.ownBusiness.ig_posts_delta}`);
  }
  console.log(`\n${C.bold}Teses tocadas:${C.reset} ${bundle.linkedPillars.join(", ") || "(nenhuma)"}`);

  if (persist) {
    console.log("");
    await persistWeeklySignals(leadId, bundle);
    ok(`Persistido em weekly_signals (week=${bundle.weekIso})`);
  } else {
    console.log(`\n${C.dim}(dry-run — não persistiu. Use --persist pra gravar.)${C.reset}`);
  }
  return bundle;
}

// ─── 3. Plan ───────────────────────────────────────────────────────────────

async function runPlan(leadId: string, signalsBundle: any, persist: boolean) {
  header("PLAN · cycle planner com Opus");
  const { planNextCycle, persistPlannedCycle } = await import("../src/lib/conversation/cycle-planner");

  console.log(`${C.dim}Chamando Opus 4 (1-3min, qualidade > velocidade)…${C.reset}`);
  const plan = await planNextCycle({ leadId, signals: signalsBundle });
  if (!plan) {
    fail("Planner retornou null — sem teses geradas no growth_machine?");
    return null;
  }

  console.log(`\n${C.bold}Tema:${C.reset} ${plan.theme_short} ${C.dim}(${plan.theme_category})${C.reset}`);
  console.log(`${C.bold}Tese vinculada:${C.reset} ${plan.linked_pillar_id} ${C.dim}(passo ${plan.evolution_step})${C.reset}`);
  console.log(`\n${C.bold}Theme full:${C.reset}\n  ${plan.theme_full}`);
  console.log(`\n${C.bold}Ação prioritária:${C.reset}`);
  console.log(`  Title: ${plan.priority_action.title}`);
  console.log(`  Why now: ${plan.priority_action.why_now}`);
  console.log(`  How to (${plan.priority_action.how_to?.length || 0} passos):`);
  (plan.priority_action.how_to || []).forEach((s: string, i: number) => console.log(`    ${i + 1}. ${s}`));
  console.log(`  Copy blocks (${plan.priority_action.copy_blocks?.length || 0}):`);
  (plan.priority_action.copy_blocks || []).forEach((cb: any) => console.log(`    [${cb.label}] ${cb.text?.slice(0, 100)}${cb.text?.length > 100 ? "…" : ""}`));
  console.log(`  Measure on thursday: ${plan.priority_action.measure_on_thursday?.join(" · ") || "—"}`);
  console.log(`\n${C.bold}Reason:${C.reset}`);
  console.log(`  Signals used: ${plan.priority_reason.signals_used?.join(" · ")}`);
  console.log(`  Evolution from last: ${plan.priority_reason.evolution_from_last}`);

  if (persist) {
    console.log("");
    const cycleId = await persistPlannedCycle(leadId, signalsBundle.weekIso, plan);
    if (cycleId) ok(`Persistido em weekly_cycles (id=${cycleId}, week=${signalsBundle.weekIso}, status=planned)`);
    else fail(`Persist falhou`);
    return cycleId;
  } else {
    console.log(`\n${C.dim}(dry-run — não persistiu. Use --persist pra gravar.)${C.reset}`);
    return null;
  }
}

// ─── 4. Simulate inbound (build context + call Claude) ─────────────────────

async function runSimulate(leadId: string, lead: any, inboundBody: string) {
  header(`SIMULATE INBOUND · "${inboundBody}"`);
  const { buildContextBundle } = await import("../src/lib/conversation/context-builder");
  const { extractAndStoreMemory } = await import("../src/lib/conversation/memory-extractor");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;

  const bundle = await buildContextBundle(leadId);
  console.log(`Context meta: ${JSON.stringify(bundle.meta)}`);
  console.log(`\n${C.dim}─── SYSTEM PROMPT (primeiros 1500 chars) ───${C.reset}`);
  console.log(bundle.systemPrompt.slice(0, 1500));
  console.log(`${C.dim}─── (${bundle.systemPrompt.length} chars no total) ───${C.reset}\n`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const t0 = Date.now();
  const messages = bundle.conversationHistory.slice();
  messages.push({ role: "user", content: inboundBody });

  console.log(`${C.dim}Chamando Claude Sonnet…${C.reset}`);
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    temperature: 0.7,
    system: bundle.systemPrompt,
    messages,
  });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();

  console.log(`\n${C.dim}Tokens: in=${res.usage?.input_tokens} out=${res.usage?.output_tokens} · ${Date.now() - t0}ms${C.reset}`);

  // Extrai memórias SEM persistir
  const { entries, cleanText } = await parseOnly(text);

  console.log(`\n${C.bold}${C.green}─── RESPOSTA PRA O USUÁRIO ───${C.reset}`);
  console.log(cleanText);
  console.log(`${C.bold}${C.green}─── fim ───${C.reset}\n`);

  console.log(`${C.bold}Memory tags extraídas (${entries.length}):${C.reset}`);
  entries.forEach((e: any, i: number) => {
    console.log(`  [${i + 1}] [${e.category}/${e.confidence}${e.linked_pillar_id ? `/${e.linked_pillar_id}` : ""}] ${e.content}`);
  });
  console.log(`\n${C.dim}(NÃO enviado pelo Twilio. NÃO persistido em messages/business_memory.)${C.reset}`);
}

/** Parse memory tags sem persistir (versão dry do extractAndStoreMemory). */
async function parseOnly(text: string): Promise<{ entries: any[]; cleanText: string }> {
  const tagRegex = /<memory>([\s\S]*?)<\/memory>/gi;
  const entries: any[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    try {
      const cleaned = match[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      entries.push(JSON.parse(cleaned));
    } catch { /* ignore */ }
  }
  const cleanText = text.replace(/<memory>[\s\S]*?<\/memory>/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return { entries, cleanText };
}

// ─── 5. Open cycle (REAL — manda WhatsApp!) ────────────────────────────────

async function runOpen(leadId: string, lead: any) {
  header(`OPEN CYCLE · envia template Meta de abertura (REAL!)`);

  if (process.env.WHATSAPP_ENABLED !== "true") {
    fail("WHATSAPP_ENABLED != 'true' — abortando");
    return;
  }
  if (!process.env.WA_TEMPLATE_ABERTURA_SEMANAL) {
    fail("WA_TEMPLATE_ABERTURA_SEMANAL não setada — abortando");
    return;
  }
  if (!lead.whatsapp || !lead.whatsapp_optin || lead.whatsapp_optout_at) {
    fail(`Lead inelegível (whatsapp=${!!lead.whatsapp} optin=${lead.whatsapp_optin} optout_at=${lead.whatsapp_optout_at})`);
    return;
  }

  const sb = getSb();
  const { data: cycle } = await sb
    .from("weekly_cycles")
    .select("id, week_iso, theme_short, status")
    .eq("lead_id", leadId)
    .eq("status", "planned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    fail("Sem cycle 'planned' pra esse lead. Rode --plan --persist primeiro.");
    return;
  }
  console.log(`Cycle: ${cycle.id} · tema "${cycle.theme_short}" · week=${cycle.week_iso}`);

  const { sendWeeklyOpening } = await import("../src/lib/notify");
  const firstName = (lead.name as string)?.split(" ")[0] || "Olá";

  console.log(`${C.yellow}Enviando template Meta pra +${lead.whatsapp.replace(/\D/g, "")}…${C.reset}`);
  const sent = await sendWeeklyOpening({
    whatsapp: lead.whatsapp,
    firstName,
    themeShort: cycle.theme_short,
  });

  if (!sent) {
    fail("Envio falhou (ver logs acima)");
    return;
  }

  // Marca cycle opened + fecha conversations stale + cria nova
  await sb.from("weekly_cycles").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", cycle.id);
  await sb.from("conversations").update({ status: "closed" }).eq("lead_id", leadId).eq("status", "active");
  await sb.from("conversations").insert({
    lead_id: leadId,
    weekly_cycle_id: cycle.id,
    channel: "whatsapp",
    status: "active",
    meta_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  ok(`Template enviado · cycle.status=opened · nova conversation criada`);
  console.log(`${C.dim}Agora aguarde a resposta no WhatsApp e o webhook /api/twilio/inbound vai disparar o loop.${C.reset}`);
}

// ─── 6. Close cycle (REAL!) ────────────────────────────────────────────────

async function runClose(leadId: string, lead: any) {
  header(`CLOSE CYCLE · envia template Meta de fechamento (REAL!)`);

  const sb = getSb();
  const { data: cycle } = await sb
    .from("weekly_cycles")
    .select("id, theme_short, status")
    .eq("lead_id", leadId)
    .in("status", ["opened", "engaged", "checked"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    fail("Sem cycle aberto pra esse lead.");
    return;
  }

  if (cycle.status === "opened") {
    warn("Cycle nunca foi engajado — marcando como 'abandoned' (sem mandar fechamento)");
    await sb.from("weekly_cycles").update({ status: "abandoned", closed_at: new Date().toISOString() }).eq("id", cycle.id);
    await sb.from("conversations").update({ status: "closed" }).eq("weekly_cycle_id", cycle.id).eq("status", "active");
    return;
  }

  const { sendWeeklyClosure } = await import("../src/lib/notify");
  const firstName = (lead.name as string)?.split(" ")[0] || "Olá";

  console.log(`${C.yellow}Enviando template Meta de fechamento…${C.reset}`);
  const sent = await sendWeeklyClosure({
    whatsapp: lead.whatsapp,
    firstName,
    themeShort: cycle.theme_short as string,
  });
  if (!sent) fail("Envio falhou");

  await sb.from("weekly_cycles").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", cycle.id);
  await sb.from("conversations").update({ status: "closed" }).eq("weekly_cycle_id", cycle.id).eq("status", "active");
  ok("Cycle fechado");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (args.checkConfig || (!args.leadId && !args.signals && !args.plan && !args.simulate && !args.open && !args.close)) {
    const passed = checkConfig();
    if (!args.leadId) {
      console.log(`\n${C.dim}Sem --leadId. Para validar fluxos, passe --leadId <uuid> com alguma das flags:${C.reset}`);
      console.log(`  --signals · --plan [--persist] · --simulate "Ver o plano" · --open · --close`);
      process.exit(passed ? 0 : 1);
    }
  }

  if (!args.leadId) {
    fail("--leadId é obrigatório quando há flags de fluxo");
    process.exit(1);
  }

  const lead = await getLead(args.leadId);
  if (!lead) {
    fail(`Lead ${args.leadId} não encontrado`);
    process.exit(1);
  }

  header("LEAD");
  await describeLead(lead);

  let signalsBundle: any = null;
  if (args.signals || args.plan) {
    signalsBundle = await runSignals(args.leadId, args.persist);
  }

  if (args.plan) {
    if (!signalsBundle) signalsBundle = await runSignals(args.leadId, args.persist);
    await runPlan(args.leadId, signalsBundle, args.persist);
  }

  if (args.simulate) {
    await runSimulate(args.leadId, lead, args.simulate);
  }

  if (args.open) {
    await runOpen(args.leadId, lead);
  }

  if (args.close) {
    await runClose(args.leadId, lead);
  }

  console.log(`\n${C.green}${C.bold}Smoke test completo.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${C.red}${C.bold}ERROR:${C.reset}`, err);
  process.exit(1);
});
