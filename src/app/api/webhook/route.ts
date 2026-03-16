// ============================================================================
// Virô — Stripe Webhook (Updated for Sprint 2)
// After payment: mark paid → create Clerk user → trigger plan generation → email
// ============================================================================
// File: src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createOrLinkClerkUser, sendMagicLinkEmail } from "@/lib/auth";
import { trackEvent } from "@/lib/events";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const leadId = session.metadata?.lead_id;
    const email = session.customer_email || session.metadata?.email;

    if (!leadId) {
      console.error("[Webhook] No lead_id in session metadata");
      return NextResponse.json({ ok: true });
    }

    console.log(`[Webhook] Payment completed for lead ${leadId}, email: ${email}`);

    const supabase = getSupabase();

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
      let clerkUserId: string | null = null;
      if (email) {
        try {
          clerkUserId = await createOrLinkClerkUser(leadId, email);
          console.log(`[Webhook] Clerk user linked: ${clerkUserId}`);

          // Send magic link for dashboard access
          try {
            await sendMagicLinkEmail(email, `https://virolocal.com/dashboard`);
            console.log(`[Webhook] Magic link enviado para ${email}`);
          } catch (mlErr) {
            console.warn(`[Webhook] Magic link failed for ${email}:`, mlErr);
            // Non-fatal — user can sign in manually
          }
        } catch (err) {
          console.error("[Webhook] Clerk user creation failed:", err);
          // Non-fatal — plan generation can still proceed
        }
      }

      // ─── 4. Trigger plan generation (async) ───
      // Call the plan generation endpoint — fire and forget
      // The plan generation runs async and updates plan_status when done
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        fetch(`${baseUrl}/api/plan/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET || "viro-internal",
          },
          body: JSON.stringify({ leadId }),
        }).catch((err) =>
          console.error("[Webhook] Plan generation trigger failed:", err)
        );

        console.log(`[Webhook] Plan generation triggered for ${leadId}`);
      } catch (err) {
        console.error("[Webhook] Failed to trigger plan generation:", err);
      }

    } catch (err) {
      console.error("[Webhook] Processing error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
