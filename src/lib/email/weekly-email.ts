// ============================================================================
// Virô — Weekly Email Sender
// Sends briefing summary via Resend with link to dashboard
// ============================================================================
// File: src/lib/email/weekly-email.ts

import type { BriefingContent } from "../pipeline/briefing-generator";

interface WeeklyEmailInput {
  email: string;
  leadId: string;
  weekNumber: number;
  product: string;
  region: string;
  briefing: BriefingContent;
}

export async function sendWeeklyEmail(input: WeeklyEmailInput): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Email] RESEND_API_KEY not set, skipping weekly email");
    return;
  }

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://virolocal.com"}/dashboard/${input.leadId}`;

  // Build changes HTML
  const changesHtml = input.briefing.changes
    .slice(0, 5)
    .map((c) => {
      const icon = c.direction === "up" ? "↑" : c.direction === "down" ? "↓" : "◆";
      const color = c.direction === "up" ? "#2D9B83" : c.direction === "down" ? "#D9534F" : "#CF8523";
      return `<div style="display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid #EAEAEE;">
        <span style="color: ${color}; font-family: monospace; font-size: 14px; font-weight: 600; flex-shrink: 0;">${icon}</span>
        <span style="font-size: 14px; color: #3A3A40; line-height: 1.5;">${c.description}</span>
      </div>`;
    })
    .join("");

  const html = `
    <div style="font-family: 'Satoshi', -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
        <div style="font-size: 22px; font-weight: 700; color: #161618; letter-spacing: -0.03em;">Virô</div>
        <div style="font-family: monospace; font-size: 11px; font-weight: 500; color: #CF8523; letter-spacing: 0.04em; text-transform: uppercase; background: rgba(207,133,35,0.08); padding: 3px 10px; border-radius: 4px;">
          SEMANA ${input.weekNumber}/12
        </div>
      </div>
      <div style="width: 40px; height: 3px; background: #CF8523; margin-bottom: 28px;"></div>
      
      <!-- Intro -->
      <p style="font-size: 17px; font-weight: 600; color: #161618; margin-bottom: 6px; line-height: 1.4;">
        Seu briefing semanal está pronto.
      </p>
      <p style="font-size: 14px; color: #6E6E78; margin-bottom: 24px;">
        ${input.product} em ${input.region} — semana ${input.weekNumber} de 12.
      </p>

      <!-- Changes -->
      ${input.briefing.changes.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <div style="font-family: monospace; font-size: 10px; font-weight: 500; color: #9E9EA8; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 10px;">
            O QUE MUDOU
          </div>
          ${changesHtml}
        </div>
      ` : `
        <div style="background: #F4F4F7; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; color: #6E6E78; margin: 0;">
            Sem mudanças significativas esta semana. O mercado local se move devagar — é normal.
          </p>
        </div>
      `}

      <!-- Weekly Action -->
      ${input.briefing.weeklyAction ? `
        <div style="background: #F4F4F7; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; border-left: 3px solid #CF8523;">
          <div style="font-family: monospace; font-size: 10px; color: #CF8523; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px;">
            AÇÃO DA SEMANA
          </div>
          <div style="font-size: 15px; font-weight: 500; color: #161618; line-height: 1.5;">
            ${input.briefing.weeklyAction}
          </div>
        </div>
      ` : ""}

      <!-- CTA -->
      <a href="${dashboardUrl}" style="
        display: inline-block; padding: 13px 28px; border-radius: 10px;
        background: #161618; color: #FEFEFF; text-decoration: none;
        font-size: 14px; font-weight: 600; margin-bottom: 28px;
      ">
        Abrir briefing completo →
      </a>

      <!-- Narrative teaser -->
      ${input.briefing.narrative ? `
        <p style="font-size: 13px; color: #9E9EA8; line-height: 1.6; margin-top: 20px;">
          ${input.briefing.narrative.slice(0, 200)}${input.briefing.narrative.length > 200 ? "..." : ""}
        </p>
      ` : ""}

      <!-- Footer -->
      <div style="border-top: 1px solid #EAEAEE; margin-top: 36px; padding-top: 20px;">
        <span style="font-size: 12px; color: #9E9EA8;">
          Virô · inteligência de mercado local · virolocal.com
        </span>
        <br>
        <span style="font-size: 11px; color: #C8C8D0;">
          Semana ${input.weekNumber} de 12. ${12 - input.weekNumber} semana${12 - input.weekNumber !== 1 ? "s" : ""} restante${12 - input.weekNumber !== 1 ? "s" : ""}.
        </span>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Virô <briefing@virolocal.com>",
      to: input.email,
      subject: `Semana ${input.weekNumber}/12 — ${input.product} em ${input.region}`,
      html,
      tags: [
        { name: "type", value: "weekly_briefing" },
        { name: "week", value: String(input.weekNumber) },
        { name: "lead_id", value: input.leadId },
      ],
    }),
  });

  console.log(`[Email] Weekly briefing sent to ${input.email} (week ${input.weekNumber})`);
}
