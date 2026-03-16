import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Schema for the feedback page (NPS + comments)
const npsSchema = z.object({
  leadId: z.string().uuid(),
  score: z.number().min(0).max(10),
  bestPart: z.string().optional().default(""),
  improvement: z.string().optional().default(""),
});

// Legacy schema for in-app feedback triggers
const triggerSchema = z.object({
  leadId: z.string().uuid(),
  triggerPoint: z.enum([
    "post_instant_value",
    "post_diagnosis",
    "week_2",
    "week_4",
    "week_6",
    "week_10",
    "week_12",
  ]),
  rating: z.number().min(0).max(10),
  ratingType: z.enum(["stars", "nps", "boolean"]).default("stars"),
  comment: z.string().optional().default(""),
  metadata: z.record(z.any()).optional().default({}),
});

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Try NPS format first (from /feedback/[leadId] page)
    const nps = npsSchema.safeParse(body);
    if (nps.success) {
      const { leadId, score, bestPart, improvement } = nps.data;
      const supabase = getSupabase();

      const feedbackText = [
        bestPart ? `Gostou: ${bestPart}` : "",
        improvement ? `Melhorar: ${improvement}` : "",
      ].filter(Boolean).join(" | ");

      const { error } = await supabase
        .from("leads")
        .update({
          feedback_score: score,
          feedback_text: feedbackText || null,
        })
        .eq("id", leadId);

      if (error) {
        console.error("[Feedback] Update lead error:", error);
        return NextResponse.json({ error: "Erro ao salvar feedback" }, { status: 500 });
      }

      // Track event
      await supabase.from("events").insert({
        lead_id: leadId,
        event_type: "feedback_submitted",
        metadata: { score, bestPart, improvement, source: "nps_page" },
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    // Try legacy trigger format
    const trigger = triggerSchema.safeParse(body);
    if (trigger.success) {
      const { leadId, triggerPoint, rating, ratingType, comment, metadata } = trigger.data;
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("feedback")
        .upsert(
          {
            lead_id: leadId,
            trigger_point: triggerPoint,
            rating,
            rating_type: ratingType,
            comment,
            metadata,
          },
          { onConflict: "lead_id,trigger_point" }
        )
        .select()
        .single();

      if (error) {
        console.error("[Feedback] Insert error:", error);
        return NextResponse.json({ error: "Erro ao salvar feedback" }, { status: 500 });
      }

      await supabase.from("events").insert({
        lead_id: leadId,
        event_type: "feedback_submitted",
        metadata: { trigger_point: triggerPoint, rating, rating_type: ratingType },
      }).catch(() => {});

      return NextResponse.json({ ok: true, id: data.id });
    }

    return NextResponse.json(
      { error: "Dados inválidos" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[Feedback] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
