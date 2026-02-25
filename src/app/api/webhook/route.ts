import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { updateLeadStatus } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ received: true, mock: true });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const leadId = session.metadata?.lead_id;

      if (leadId) {
        await updateLeadStatus(leadId, "paid");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook]", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
