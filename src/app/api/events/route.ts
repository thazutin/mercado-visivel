import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    // Support both JSON and sendBeacon (which sends as text)
    const text = await req.text();
    const body = JSON.parse(text);

    await trackEvent({
      eventType: body.eventType,
      leadId: body.leadId,
      metadata: body.metadata,
      sessionId: body.sessionId,
      locale: body.locale,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never return errors for analytics — just acknowledge
    return NextResponse.json({ ok: true });
  }
}
