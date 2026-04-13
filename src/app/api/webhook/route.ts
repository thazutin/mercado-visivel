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

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });
}

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
    event = getStripe().webhooks.constructEvent(
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

    // ─── RADAR CHECKOUT (new R$247/mês subscription) ───
    if (sessionType === "subscription" || sessionType === "radar") {
      console.log(`[Webhook] Radar activated for lead ${leadId}`);

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

        // Gerar primeiro batch de conteúdos semanais imediatamente
        if (email) {
          const { data: lead } = await supabase
            .from("leads")
            .select("name, product, region, client_type")
            .eq("id", leadId)
            .single();

          // Trigger content generation (fire-and-forget)
          waitUntil((async () => {
            try {
              const { generateRelatorioSetorial } = await import("@/lib/pipeline/relatorio-setorial");
              const { triggerContentGenerationWithContext } = await import("@/lib/generateContents");

              const relatorio = await generateRelatorioSetorial(
                lead?.product || '', lead?.region || '', lead?.client_type || 'b2c'
              );
              await triggerContentGenerationWithContext(leadId, relatorio);
              console.log(`[Webhook] First weekly content generated for subscriber ${leadId}`);
            } catch (err) {
              console.error("[Webhook] First content generation failed:", err);
            }

            // Welcome email + growth machine
            try {
              const { notifyWelcomeRadar } = await import("@/lib/notify");
              const { generateGrowthMachine } = await import("@/lib/growth-machine");
              const { classifyBusiness } = await import("@/lib/blueprints");

              // Classify + generate growth machine
              const classification = await classifyBusiness({
                businessName: lead?.name || lead?.product || '',
                product: lead?.product || '',
                clientType: lead?.client_type || 'b2c',
                region: lead?.region || '',
              });

              const { data: fullLead } = await supabase.from("leads").select("*").eq("id", leadId).single();
              if (fullLead?.diagnosis_display) {
                const { data: diagRecord } = await supabase.from("diagnoses").select("raw_data")
                  .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).single();

                const gm = await generateGrowthMachine({
                  lead: {
                    id: leadId, name: fullLead.name || fullLead.product,
                    product: fullLead.product, region: fullLead.region,
                    instagram: fullLead.instagram, site: fullLead.site,
                    client_type: fullLead.client_type, challenge: fullLead.challenge,
                    ticket: fullLead.ticket,
                  },
                  diagnosis: fullLead.diagnosis_display,
                  blueprintId: classification.blueprint.id,
                  rawData: diagRecord?.raw_data,
                });

                await supabase.from("leads").update({
                  blueprint_id: classification.blueprint.id,
                  growth_machine: gm,
                  welcome_email_sent: true,
                }).eq("id", leadId);

                await notifyWelcomeRadar({
                  email,
                  name: lead?.name || lead?.product || '',
                  product: lead?.product || '',
                  leadId,
                  blueprintLabel: classification.blueprint.label,
                  quickWinsCount: gm.quickWins?.length,
                });
                console.log(`[Webhook] Welcome email + growth machine sent for ${leadId}`);
              }
            } catch (err) {
              console.error("[Webhook] Welcome/growth machine failed:", err);
            }
          })());
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

      // Trigger plan generation com retry (até 3 tentativas, backoff 10s/30s)
      waitUntil((async () => {
        const MAX_RETRIES = 3;
        const DELAYS = [0, 10_000, 30_000]; // retry after 10s, 30s
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            console.log(`[Webhook] Plan retry ${attempt}/${MAX_RETRIES} in ${DELAYS[attempt] / 1000}s...`);
            await new Promise(r => setTimeout(r, DELAYS[attempt]));
          }
          try {
            const res = await fetch(`${baseUrl}/api/plan/generate`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-internal-secret": process.env.INTERNAL_API_SECRET || "viro-internal",
              },
              body: JSON.stringify({ leadId }),
              signal: AbortSignal.timeout(120_000), // 2min timeout per attempt
            });
            const text = await res.text();
            if (res.ok) {
              console.log(`[Webhook] plan/generate OK (attempt ${attempt + 1}): ${res.status}`);
              return; // Success — exit retry loop
            }
            console.error(`[Webhook] plan/generate FAILED (attempt ${attempt + 1}): ${res.status} — ${text.slice(0, 300)}`);
          } catch (err) {
            console.error(`[Webhook] Plan trigger failed (attempt ${attempt + 1}):`, (err as Error).message);
          }
        }
        // All retries failed — mark plan as error so dashboard can show retry button
        console.error(`[Webhook] Plan generation FAILED after ${MAX_RETRIES} attempts for ${leadId}`);
        await supabase.from("leads").update({ plan_status: "error" }).eq("id", leadId);
      })());

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

  // ─── invoice.payment_succeeded (renovação mensal) ────────────────────────────

  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as any;
    // Só notificar renovações (não a primeira cobrança)
    if (invoice.billing_reason === "subscription_cycle") {
      const subscriptionId = invoice.subscription;
      console.log(`[Webhook] Subscription renewal: ${subscriptionId}`);

      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, email, name, product, region")
          .eq("subscription_stripe_id", subscriptionId)
          .single();

        if (lead?.email) {
          const { sendEmail, emailShell } = await import("@/lib/notify");
          const firstName = (lead.name || '').split(' ')[0] || 'Olá';
          const dashboardUrl = `https://virolocal.com/dashboard/${lead.id}`;

          await sendEmail({
            to: lead.email,
            subject: `${firstName}, sua assinatura Virô foi renovada.`,
            html: emailShell(`
              <h1 style="font-size:22px;color:#161618;margin:0 0 16px;line-height:1.3;">
                Assinatura renovada com sucesso.
              </h1>
              <p style="font-size:15px;color:#888880;line-height:1.7;margin:0 0 24px;">
                Seu acesso às Ações Semanais para <strong style="color:#161618;">${lead.product}</strong> em <strong style="color:#161618;">${(lead.region || '').split(',')[0].trim()}</strong> continua ativo.
              </p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${dashboardUrl}" style="background:#161618;color:#FEFEFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
                  Acessar painel
                </a>
              </div>
              <p style="font-size:13px;color:#888880;line-height:1.6;margin:0;">
                Seus conteúdos semanais continuam sendo gerados toda sexta-feira.
              </p>
            `),
          });
          console.log(`[Webhook] Renewal email sent to ${lead.email}`);
        }
      } catch (err) {
        console.error("[Webhook] Renewal notification failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
