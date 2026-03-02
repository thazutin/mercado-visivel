// ============================================================================
// Virô — Checkout Route (Updated for R$999)
// Creates Stripe Checkout session with lead_id in metadata
// ============================================================================
// File: src/app/api/checkout/route.ts

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { trackEvent } from "@/lib/events";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  try {
    const { lead_id, email, locale, coupon } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";

    // ─── Pricing by locale ───
    const pricing: Record<string, { amount: number; currency: string }> = {
      pt: { amount: 99900, currency: "brl" },    // R$999
      en: { amount: 19900, currency: "usd" },     // $199
      es: { amount: 19900, currency: "usd" },     // $199
    };
    const { amount, currency } = pricing[locale || "pt"] || pricing.pt;

    // ─── Build session params ───
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: currency === "brl"
        ? ["card", "boleto"]
        : ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "Virô — Pacote Completo",
              description:
                locale === "pt"
                  ? "Diagnóstico completo + Plano 12 semanas + Briefing semanal"
                  : locale === "es"
                  ? "Diagnóstico completo + Plan 12 semanas + Briefing semanal"
                  : "Full diagnostic + 12-week plan + Weekly briefing",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      metadata: {
        lead_id,
        email: email || "",
        locale: locale || "pt",
      },
      success_url: `${baseUrl}/dashboard/${lead_id}?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
    };

    // ─── Apply coupon if provided ───
    if (coupon) {
      try {
        // Try as promotion code first
        const promoCodes = await stripe.promotionCodes.list({
          code: coupon,
          active: true,
          limit: 1,
        });

        if (promoCodes.data.length > 0) {
          sessionParams.discounts = [
            { promotion_code: promoCodes.data[0].id },
          ];
        } else {
          // Try as coupon directly
          try {
            await stripe.coupons.retrieve(coupon);
            sessionParams.discounts = [{ coupon }];
          } catch {
            // Invalid coupon — proceed without discount
            console.warn(`[Checkout] Invalid coupon: ${coupon}`);
          }
        }
      } catch {
        console.warn(`[Checkout] Coupon lookup failed: ${coupon}`);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Track event
    await trackEvent({
      eventType: "checkout_initiated",
      leadId: lead_id,
      metadata: { currency, amount, coupon: coupon || null },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Checkout] Error:", err);
    return NextResponse.json(
      { error: "Erro ao criar sessão de pagamento" },
      { status: 500 }
    );
  }
}
