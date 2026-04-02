// Stripe Customer Portal — permite cancelar assinatura, atualizar cartão, ver faturas
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as any });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const supabase = getSupabase();
    const { data: lead } = await supabase
      .from("leads")
      .select("subscription_stripe_id, email")
      .eq("id", leadId)
      .single();

    if (!lead?.subscription_stripe_id) {
      return NextResponse.json({ error: "Nenhuma assinatura encontrada" }, { status: 404 });
    }

    // Buscar customer ID da subscription
    const subscription = await stripe.subscriptions.retrieve(lead.subscription_stripe_id);
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    // Criar sessão do Customer Portal
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/${leadId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Portal] Error:", err);
    return NextResponse.json(
      { error: "Erro ao abrir portal de assinatura" },
      { status: 500 },
    );
  }
}
