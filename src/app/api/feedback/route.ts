import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const feedbackSchema = z.object({
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { leadId, triggerPoint, rating, ratingType, comment, metadata } = parsed.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Upsert — one feedback per trigger per lead
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

    // Also track as event
    await supabase.from("events").insert({
      lead_id: leadId,
      event_type: "feedback_submitted",
      metadata: { trigger_point: triggerPoint, rating, rating_type: ratingType },
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[Feedback] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
