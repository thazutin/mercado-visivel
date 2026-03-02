// ============================================================================
// Virô — WhatsApp Reminder (Twilio)
// Sends a short reminder when weekly briefing is ready.
// NOT a content delivery channel — just a nudge to open email/dashboard.
// ============================================================================
// File: src/lib/email/whatsapp-reminder.ts

interface WhatsAppInput {
  to: string;           // WhatsApp number with country code (e.g., "+5511999999999")
  leadId: string;
  weekNumber: number;
  product: string;
  changesCount: number;
}

/**
 * Send WhatsApp reminder via Twilio.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM env vars.
 * 
 * TWILIO_WHATSAPP_FROM should be in format "whatsapp:+14155238886" (Twilio sandbox)
 * or your approved WhatsApp Business number.
 */
export async function sendWhatsAppReminder(input: WhatsAppInput): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[WhatsApp] Twilio not configured, skipping reminder");
    return;
  }

  // ─── Format phone number ───
  const cleanNumber = formatWhatsAppNumber(input.to);
  if (!cleanNumber) {
    console.warn(`[WhatsApp] Invalid number: ${input.to}`);
    return;
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com"}/dashboard/${input.leadId}`;

  // ─── Build message ───
  const changesSuffix = input.changesCount > 0
    ? `${input.changesCount} mudança${input.changesCount > 1 ? "s" : ""} detectada${input.changesCount > 1 ? "s" : ""} no seu mercado.`
    : "Sem mudanças grandes essa semana, mas o plano continua.";

  const body = `*Virô — Semana ${input.weekNumber}/12*

Seu briefing semanal de ${input.product} está pronto. ${changesSuffix}

👉 ${dashboardUrl}`;

  // ─── Send via Twilio ───
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: `whatsapp:${cleanNumber}`,
        Body: body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`[WhatsApp] Twilio error: ${response.status} ${errorBody.slice(0, 200)}`);
      return;
    }

    const result = await response.json();
    console.log(`[WhatsApp] Reminder sent to ${cleanNumber} (sid: ${result.sid})`);
  } catch (err) {
    console.error("[WhatsApp] Send failed:", err);
    // Non-fatal — email is the primary channel
  }
}

// ─── PHONE NUMBER FORMATTING ─────────────────────────────────────────

function formatWhatsAppNumber(raw: string): string | null {
  // Remove everything except digits and leading +
  let cleaned = raw.replace(/[^\d+]/g, "");

  // Ensure starts with +
  if (!cleaned.startsWith("+")) {
    // Assume Brazilian if 10-11 digits
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = "+55" + cleaned;
    } else if (cleaned.length === 12 || cleaned.length === 13) {
      cleaned = "+" + cleaned;
    } else {
      return null;
    }
  }

  // Validate minimum length
  if (cleaned.length < 12) return null;

  return cleaned;
}
