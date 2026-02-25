import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Stripe is optional — falls back to mock when key is missing
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2025-01-27.acacia" as any })
  : null;

export const PRODUCTS = {
  br: {
    name: "Diagnóstico Completo — Mercado Visível",
    price: 49700, // R$ 497
    currency: "brl",
  },
  intl: {
    name: "Full Diagnosis — Mercado Visível",
    price: 10000, // $100
    currency: "usd",
  },
};

export async function createCheckoutSession(leadId: string, origin: string, locale: string = "pt") {
  const isBr = locale === "pt";
  const product = isBr ? PRODUCTS.br : PRODUCTS.intl;

  if (!stripe) {
    console.warn("[Stripe] No key configured. Returning mock checkout.");
    return {
      url: `${origin}/checkout/mock?lead_id=${leadId}`,
      id: "mock_session_" + Date.now(),
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: product.currency,
          product_data: { name: product.name },
          unit_amount: product.price,
        },
        quantity: 1,
      },
    ],
    metadata: { lead_id: leadId, locale },
    success_url: `${origin}/dashboard?lead_id=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/resultado?lead_id=${leadId}`,
  });

  return { url: session.url, id: session.id };
}
