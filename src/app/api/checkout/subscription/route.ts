// ============================================================================
// Virô — Subscription Checkout Route (R$247/mês)
// File: src/app/api/checkout/subscription/route.ts
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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
  try {
    const { leadId, email: bodyEmail } = await req.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId required" }, { status: 400 });
    }

    // Busca email do lead se não veio no body
    let email = bodyEmail;
    if (!email) {
      const supabase = getSupabase();
      const { data: lead } = await supabase
        .from("leads")
        .select("email")
        .eq("id", leadId)
        .single();
      email = lead?.email;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com";
    const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

    if (!priceId) {
      console.error("[Checkout/Sub] STRIPE_SUBSCRIPTION_PRICE_ID not set");
      return NextResponse.json({ error: "Subscription not configured" }, { status: 500 });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: email || undefined,
      metadata: { lead_id: leadId, type: "subscription" },
      success_url: `${baseUrl}/dashboard/${leadId}?subscribed=true`,
      cancel_url: `${baseUrl}/dashboard/${leadId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Checkout/Sub] Error:", err);
    return NextResponse.json({ error: "Erro ao criar sessão de assinatura" }, { status: 500 });
  }
}
