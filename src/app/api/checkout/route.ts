// ============================================================================
// Virô — Checkout Route (R$397)
// File: src/app/api/checkout/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

    const pricing: Record<string, { amount: number; currency: string }> = {
      pt: { amount: 39700, currency: "brl" },    // R$397
      en: { amount: 9700, currency: "usd" },      // $97
      es: { amount: 9700, currency: "usd" },      // $97
    };
    const { amount, currency } = pricing[locale || "pt"] || pricing.pt;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: currency === "brl" ? ["card", "boleto"] : ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "Virô — Pacote Completo",
              description:
                locale === "pt"
                  ? "Diagnóstico completo + Plano 90 dias + 12 briefings semanais"
                  : locale === "es"
                  ? "Diagnóstico completo + Plan 90 días + 12 briefings semanales"
                  : "Full diagnostic + 90-day plan + 12 weekly briefings",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      customer_email: email || undefined,
      metadata: { lead_id, email: email || "", locale: locale || "pt" },
      success_url: `${baseUrl}/resultado/${lead_id}?paid=true`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
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
  } catch (err) {
    console.error("[Checkout] Error:", err);
    return NextResponse.json({ error: "Erro ao criar sessão de pagamento" }, { status: 500 });
  }
}
