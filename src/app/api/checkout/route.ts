// ============================================================================
// Virô Radar — Checkout Route
// Agora opera em modo subscription (R$247/mês) via STRIPE_RADAR_PRICE_ID.
// Fallback pra mode: "payment" se STRIPE_RADAR_PRICE_ID não estiver setado
// (compatibilidade com setup antigo durante transição).
// File: src/app/api/checkout/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  try {
    const { lead_id, leadId, email, locale, coupon } = await req.json();
    const resolvedLeadId = lead_id || leadId;

    if (!resolvedLeadId) {
      return NextResponse.json({ error: "lead_id required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";

    // Novo: subscription mode com price_id do Stripe (R$247/mês)
    const radarPriceId = process.env.STRIPE_RADAR_PRICE_ID;

    if (radarPriceId) {
      // ─── SUBSCRIPTION MODE (novo) ────────────────────────────────────
      console.log(`[Checkout] Subscription mode: price=${radarPriceId}, lead=${resolvedLeadId}`);

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: radarPriceId, quantity: 1 }],
        allow_promotion_codes: !coupon ? true : undefined,
        customer_email: email || undefined,
        metadata: {
          lead_id: resolvedLeadId,
          email: email || "",
          locale: locale || "pt",
          type: "radar",
        },
        success_url: `${baseUrl}/dashboard/${resolvedLeadId}?radar=activated`,
        cancel_url: `${baseUrl}/resultado/${resolvedLeadId}?checkout=cancelled`,
      };

      // Apply coupon
      if (coupon) {
        try {
          const promoCodes = await stripe.promotionCodes.list({
            code: coupon, active: true, limit: 1,
          });
          if (promoCodes.data.length > 0) {
            sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
          } else {
            try {
              await stripe.coupons.retrieve(coupon);
              sessionParams.discounts = [{ coupon }];
            } catch {
              console.warn(`[Checkout] Invalid coupon: ${coupon}`);
            }
          }
        } catch {
          console.warn(`[Checkout] Coupon lookup failed: ${coupon}`);
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return NextResponse.json({ url: session.url });
    }

    // ─── FALLBACK: PAYMENT MODE (legado, durante transição) ────────────
    console.log(`[Checkout] Payment mode (legacy): lead=${resolvedLeadId}`);
    const checkoutAmount = parseInt(process.env.CHECKOUT_AMOUNT || "49700", 10);

    const pricing: Record<string, { amount: number; currency: string }> = {
      pt: { amount: checkoutAmount, currency: "brl" },
      en: { amount: 9700, currency: "usd" },
      es: { amount: 9700, currency: "usd" },
    };
    const { amount, currency } = pricing[locale || "pt"] || pricing.pt;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: currency === "brl" ? ["card", "boleto"] : ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: "Virô — Radar de Crescimento",
            description: "Monitoramento semanal + ações prontas + conteúdo personalizado",
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      allow_promotion_codes: !coupon ? true : undefined,
      customer_email: email || undefined,
      metadata: { lead_id: resolvedLeadId, email: email || "", locale: locale || "pt" },
      success_url: `${baseUrl}/resultado/${resolvedLeadId}?paid=true`,
      cancel_url: `${baseUrl}/resultado/${resolvedLeadId}?checkout=cancelled`,
    };

    if (coupon) {
      try {
        const promoCodes = await stripe.promotionCodes.list({ code: coupon, active: true, limit: 1 });
        if (promoCodes.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
        }
      } catch { /* ignore */ }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Checkout] Error:", err);
    return NextResponse.json({ error: "Erro ao criar sessão de pagamento" }, { status: 500 });
  }
}
