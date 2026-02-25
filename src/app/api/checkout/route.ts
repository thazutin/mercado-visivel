import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { lead_id, locale } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: "lead_id required" }, { status: 400 });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await createCheckoutSession(lead_id, origin, locale || "pt");

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[Checkout]", err);
    return NextResponse.json(
      { error: "Erro ao criar sessão de pagamento" },
      { status: 500 }
    );
  }
}
