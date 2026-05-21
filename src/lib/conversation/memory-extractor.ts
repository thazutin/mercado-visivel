// ============================================================================
// Virô — Memory Extractor
//
// O bot, no system prompt, é instruído a anexar 1+ tags <memory>{json}</memory>
// no fim da resposta quando captura aprendizado novo. Este módulo:
//   1. Parse as tags
//   2. Grava cada entrada em business_memory
//   3. Devolve o texto limpo (sem tags) pra mandar pro usuário
//
// Schema do JSON dentro da tag:
//   { category, topic, content, confidence, linked_pillar_id? }
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = new Set(["competitor", "customer", "self", "market", "tactic"]);
const VALID_CONFIDENCE = new Set(["observed", "hypothesis", "confirmed"]);

export interface ExtractResult {
  cleanText: string;
  memoriesAdded: number;
  rawTags: number;
}

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface ParsedMemory {
  category: string;
  topic: string;
  content: string;
  confidence: string;
  linked_pillar_id?: string;
}

function parseMemoryTags(text: string): { entries: ParsedMemory[]; cleanText: string; rawCount: number } {
  const tagRegex = /<memory>([\s\S]*?)<\/memory>/gi;
  const entries: ParsedMemory[] = [];
  let rawCount = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    rawCount++;
    const raw = match[1].trim();
    try {
      // Aceita JSON solto ou cercado por markdown ``` (Claude às vezes faz isso)
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (
        typeof parsed.category === "string" &&
        typeof parsed.topic === "string" &&
        typeof parsed.content === "string" &&
        VALID_CATEGORIES.has(parsed.category) &&
        parsed.content.length >= 3
      ) {
        entries.push({
          category: parsed.category,
          topic: parsed.topic.slice(0, 80),
          content: parsed.content.slice(0, 600),
          confidence: VALID_CONFIDENCE.has(parsed.confidence) ? parsed.confidence : "observed",
          linked_pillar_id: typeof parsed.linked_pillar_id === "string" ? parsed.linked_pillar_id : undefined,
        });
      } else {
        console.warn("[MemoryExtractor] Tag inválida (campos faltando):", raw.slice(0, 120));
      }
    } catch (err) {
      console.warn("[MemoryExtractor] JSON inválido na tag:", raw.slice(0, 120));
    }
  }

  // Remove TODAS as tags (válidas ou não) do texto final + colapsa whitespace
  const cleanText = text
    .replace(/<memory>[\s\S]*?<\/memory>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { entries, cleanText, rawCount };
}

export async function extractAndStoreMemory(opts: {
  leadId: string;
  responseText: string;
  conversationId?: string | null;
  weeklyCycleId?: string | null;
  messageId?: string | null;
}): Promise<ExtractResult> {
  const { entries, cleanText, rawCount } = parseMemoryTags(opts.responseText);
  if (entries.length === 0) {
    return { cleanText, memoriesAdded: 0, rawTags: rawCount };
  }

  const sb = getSb();
  const rows = entries.map((e) => ({
    lead_id: opts.leadId,
    category: e.category,
    topic: e.topic,
    content: e.content,
    confidence: e.confidence,
    source: "conversation" as const,
    source_ref: opts.messageId || null,
    weekly_cycle_id: opts.weeklyCycleId || null,
    linked_pillar_id: e.linked_pillar_id || null,
  }));

  const { error } = await sb.from("business_memory").insert(rows);
  if (error) {
    console.error("[MemoryExtractor] Insert falhou:", error.message);
    return { cleanText, memoriesAdded: 0, rawTags: rawCount };
  }

  console.log(`[MemoryExtractor] +${entries.length} aprendizados gravados pra lead ${opts.leadId}`);
  return { cleanText, memoriesAdded: entries.length, rawTags: rawCount };
}
