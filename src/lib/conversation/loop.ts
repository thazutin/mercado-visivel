// ============================================================================
// Virô — Loop conversacional WhatsApp
//
// Orquestração:
//   1. Persiste mensagem inbound (messages, direction=in)
//   2. Garante que existe uma conversation ativa (cria se não houver)
//   3. Carrega contexto (context-builder)
//   4. Chama Claude Sonnet com system prompt + histórico + mensagem nova
//   5. Extrai <memory> tags → grava em business_memory
//   6. Envia resposta limpa via sendWhatsAppFreeText
//   7. Persiste mensagem outbound + atualiza janela 24h
//   8. Atualiza weekly_cycle.user_engaged_at se primeiro engajamento do ciclo
//
// Roda dentro de waitUntil() no webhook inbound — não bloqueia o ack TwiML.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildContextBundle } from "./context-builder";
import { extractAndStoreMemory } from "./memory-extractor";
import { sendWhatsAppFreeText } from "@/lib/notify";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-20250514";
const META_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface ProcessInput {
  leadId: string;
  fromWhatsapp: string;     // E.164 limpo (sem "whatsapp:")
  inboundBody: string;
  twilioSidInbound?: string;
}

interface ProcessResult {
  ok: boolean;
  conversationId?: string;
  inboundMessageId?: string;
  outboundMessageId?: string;
  responseText?: string;
  memoriesAdded?: number;
  error?: string;
}

/** Acha ou cria a conversation ativa pro lead. */
async function getOrCreateActiveConversation(leadId: string): Promise<{ id: string; weeklyCycleId: string | null }> {
  const sb = getSb();

  // 1. Tenta conversation já ativa
  const { data: existing } = await sb
    .from("conversations")
    .select("id, weekly_cycle_id")
    .eq("lead_id", leadId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { id: existing.id as string, weeklyCycleId: (existing.weekly_cycle_id as string) || null };
  }

  // 2. Pega ciclo ativo (se houver) pra linkar
  const { data: cycle } = await sb
    .from("weekly_cycles")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["opened", "engaged", "checked"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Cria nova
  const { data: created, error } = await sb
    .from("conversations")
    .insert({
      lead_id: leadId,
      weekly_cycle_id: cycle?.id || null,
      channel: "whatsapp",
      status: "active",
      meta_window_expires_at: new Date(Date.now() + META_WINDOW_MS).toISOString(),
    })
    .select("id, weekly_cycle_id")
    .single();
  if (error || !created) throw new Error(`Failed to create conversation: ${error?.message}`);

  return { id: created.id as string, weeklyCycleId: (created.weekly_cycle_id as string) || null };
}

async function callClaude(systemPrompt: string, history: { role: "user" | "assistant"; content: string }[], latestUserMessage: string): Promise<{ text: string; tokensIn: number; tokensOut: number; latencyMs: number }> {
  const t0 = Date.now();

  // Construímos a mensagem nova como continuação. O histórico vai SEM duplicar
  // a mensagem inbound (que ainda não foi salva quando o context-builder rodou,
  // mas pode estar — varia conforme ordem; pra evitar duplicação, conferimos).
  const lastInHistory = history[history.length - 1];
  const messages = history.slice();
  if (!lastInHistory || lastInHistory.role !== "user" || lastInHistory.content !== latestUserMessage) {
    messages.push({ role: "user", content: latestUserMessage });
  }

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: systemPrompt,
    messages,
  });

  const text = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();

  return {
    text,
    tokensIn: res.usage?.input_tokens || 0,
    tokensOut: res.usage?.output_tokens || 0,
    latencyMs: Date.now() - t0,
  };
}

export async function processInboundMessage(input: ProcessInput): Promise<ProcessResult> {
  const sb = getSb();

  try {
    // 1. Conversation ativa
    const { id: conversationId, weeklyCycleId } = await getOrCreateActiveConversation(input.leadId);

    // 2. Persiste a mensagem inbound
    const { data: inboundMsg } = await sb
      .from("messages")
      .insert({
        conversation_id: conversationId,
        direction: "in",
        body: input.inboundBody,
        twilio_sid: input.twilioSidInbound || null,
      })
      .select("id")
      .single();

    const inboundMessageId = (inboundMsg?.id as string) || undefined;

    // 3. Atualiza janela 24h + last_message_at (inbound abre janela)
    await sb
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        meta_window_expires_at: new Date(Date.now() + META_WINDOW_MS).toISOString(),
      })
      .eq("id", conversationId);

    // 4. Se houver ciclo ativo e for o primeiro engajamento do user, atualiza
    if (weeklyCycleId) {
      await sb
        .from("weekly_cycles")
        .update({ status: "engaged", user_engaged_at: new Date().toISOString() })
        .eq("id", weeklyCycleId)
        .eq("status", "opened"); // só atualiza se ainda estava em opened
    }

    // 5. Build contexto + chamar Claude
    const bundle = await buildContextBundle(input.leadId);
    console.log(`[Loop] ctx ready leadId=${input.leadId} pillars=${bundle.meta.pillarsCount} memory=${bundle.meta.memoryCount} msgs=${bundle.meta.messagesLoaded} signals=${bundle.meta.signalsLoaded ? "yes" : "no"} cycle=${bundle.meta.activeCycleId || "none"}`);

    const claudeRes = await callClaude(bundle.systemPrompt, bundle.conversationHistory, input.inboundBody);
    console.log(`[Loop] claude done leadId=${input.leadId} in=${claudeRes.tokensIn} out=${claudeRes.tokensOut} ${claudeRes.latencyMs}ms`);

    // 6. Extrai memórias + limpa tags
    const extracted = await extractAndStoreMemory({
      leadId: input.leadId,
      responseText: claudeRes.text,
      conversationId,
      weeklyCycleId,
      messageId: inboundMessageId,
    });

    const finalText = extracted.cleanText;
    if (!finalText) {
      console.warn("[Loop] Resposta vazia após extract — usando fallback");
    }
    const toSend = finalText || "Tô processando aqui, me dá 1 min e te volto.";

    // 7. Envia via Twilio
    const sendResult = await sendWhatsAppFreeText(input.fromWhatsapp, toSend);
    if (!sendResult.ok) {
      console.error(`[Loop] Send falhou: ${sendResult.error}`);
      return {
        ok: false,
        conversationId,
        inboundMessageId,
        error: `send_failed: ${sendResult.error}`,
      };
    }

    // 8. Persiste outbound
    const { data: outboundMsg } = await sb
      .from("messages")
      .insert({
        conversation_id: conversationId,
        direction: "out",
        body: toSend,
        twilio_sid: sendResult.sid || null,
        claude_meta: {
          model: MODEL,
          tokens_in: claudeRes.tokensIn,
          tokens_out: claudeRes.tokensOut,
          latency_ms: claudeRes.latencyMs,
          memories_added: extracted.memoriesAdded,
        },
      })
      .select("id")
      .single();

    return {
      ok: true,
      conversationId,
      inboundMessageId,
      outboundMessageId: (outboundMsg?.id as string) || undefined,
      responseText: toSend,
      memoriesAdded: extracted.memoriesAdded,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Loop] FAILED leadId=${input.leadId}:`, msg);
    return { ok: false, error: msg };
  }
}
