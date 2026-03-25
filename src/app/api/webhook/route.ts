// ============================================================================
// Virô — Stripe Webhook
// Handles: one-time payment, subscription created, subscription cancelled/updated
// ============================================================================
// File: src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { createOrLinkClerkUser, sendMagicLinkEmail } from "@/lib/auth";
import { trackEvent } from "@/lib/events";
import { notifyWeeklyContents } from "@/lib/notify";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();

  // ─── checkout.session.completed ─────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const leadId = session.metadata?.lead_id;
    const email = session.customer_email || session.metadata?.email;
    const sessionType = session.metadata?.type;

    if (!leadId) {
      console.error("[Webhook] No lead_id in session metadata");
      return NextResponse.json({ ok: true });
    }

    // ─── SUBSCRIPTION CHECKOUT ───
    if (sessionType === "subscription") {
      console.log(`[Webhook] Subscription activated for lead ${leadId}`);

      try {
        await supabase
          .from("leads")
          .update({
            subscription_status: "active",
            subscription_stripe_id: session.subscription,
            subscription_started_at: new Date().toISOString(),
          })
          .eq("id", leadId);

        await trackEvent({
          eventType: "subscription_started",
          leadId,
          metadata: { stripe_subscription_id: session.subscription },
        });

        // Notifica que assinatura está ativa (conteúdos já existem da amostra)
        if (email) {
          const { data: lead } = await supabase
            .from("leads")
            .select("name")
            .eq("id", leadId)
            .single();

          notifyWeeklyContents({
            leadId,
            email,
            name: lead?.name || "",
          }).catch((err) =>
            console.error("[Webhook] notifyWeeklyContents failed:", err)
          );
        }
      } catch (err) {
        console.error("[Webhook] Subscription processing error:", err);
      }

      return NextResponse.json({ ok: true });
    }

    // ─── ONE-TIME PAYMENT (diagnóstico completo) ───
    console.log(`[Webhook] Payment completed for lead ${leadId}, email: ${email}`);

    try {
      // ─── 1. Mark lead as paid ───
      await supabase
        .from("leads")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_session_id: session.id,
          plan_status: "generating",
          briefing_end_date: new Date(
            Date.now() + 12 * 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 12 weeks from now
        })
        .eq("id", leadId);

      // ─── 2. Track event ───
      await trackEvent({
        eventType: "payment_success",
        leadId,
        metadata: {
          amount: session.amount_total,
          currency: session.currency,
          stripe_session_id: session.id,
        },
      });

      // ─── 3. Create Clerk user ───
      if (email) {
        try {
          const clerkUserId = await createOrLinkClerkUser(leadId, email);
          console.log(`[Webhook] Clerk user linked: ${clerkUserId}`);

          try {
            await sendMagicLinkEmail(email, `https://virolocal.com/dashboard`);
            console.log(`[Webhook] Magic link enviado para ${email}`);
          } catch (mlErr) {
            console.warn(`[Webhook] Magic link failed for ${email}:`, mlErr);
          }
        } catch (err) {
          console.error("[Webhook] Clerk user creation failed:", err);
        }
      }

      // ─── 4. Trigger plan generation (waitUntil keeps process alive) ───
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";

      waitUntil(
        fetch(`${baseUrl}/api/plan/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET || "viro-internal",
          },
          body: JSON.stringify({ leadId }),
        })
        .then(async (res) => {
          const text = await res.text();
          console.log(`[Webhook] plan/generate response: ${res.status} — ${text.slice(0, 200)}`);
        })
        .catch((err) => console.error("[Webhook] Plan generation trigger failed:", err))
      );

      console.log(`[Webhook] Plan generation triggered (waitUntil) for ${leadId}`);

      // Conteúdos são gerados via runPostDiagnosisEnrichment dentro de /api/plan/generate

    } catch (err) {
      console.error("[Webhook] Processing error:", err);
    }
  }

  // ─── customer.subscription.deleted ──────────────────────────────────────────

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;

    console.log(`[Webhook] Subscription deleted: ${subscriptionId}`);

    try {
      await supabase
        .from("leads")
        .update({ subscription_status: "cancelled" })
        .eq("subscription_stripe_id", subscriptionId);
    } catch (err) {
      console.error("[Webhook] Subscription deletion processing error:", err);
    }
  }

  // ─── customer.subscription.updated ──────────────────────────────────────────

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;
    const newStatus = subscription.status === "active" ? "active" : "cancelled";

    console.log(`[Webhook] Subscription updated: ${subscriptionId} → ${newStatus}`);

    try {
      await supabase
        .from("leads")
        .update({ subscription_status: newStatus })
        .eq("subscription_stripe_id", subscriptionId);
    } catch (err) {
      console.error("[Webhook] Subscription update processing error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
