// ============================================================================
// /semana/[leadId] — Bridge page (fallback Caminho G)
//
// Se Meta rejeitar URL wa.me em templates Call to Action, mudamos a URL do
// template pra esta página. Ela mostra:
//   • Tema da semana + parágrafo de "por quê esta semana"
//   • UM único botão grande: "Receber o plano completo pela Virô"
//     → abre wa.me/+5511947170936?text=Ver%20o%20plano
//
// IMPORTANTE: esta página NUNCA mostra how_to, copy_blocks ou
// measure_on_thursday. O plano executável e o acompanhamento de
// progresso ficam APENAS na conversa do WhatsApp — é assim que
// garantimos a captura do dataset.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";

const TWILIO_WHATSAPP_NUMBER = "5511947170936"; // sem o "+", formato wa.me

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface CycleData {
  id: string;
  week_iso: string;
  theme_short: string;
  theme_full: string;
  theme_category: string;
  linked_pillar_id: string | null;
  evolution_step: number;
  status: string;
  priority_reason: { signals_used?: string[]; evolution_from_last?: string } | null;
}

interface SignalsData {
  macro?: { summary?: string } | null;
  competitors?: { handle: string; signal: string }[];
  own_business?: any;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SemanaPage({
  params,
  searchParams,
}: {
  params: { leadId: string };
  searchParams: { action?: string };
}) {
  const { leadId } = params;
  if (!UUID_REGEX.test(leadId)) redirect("/");

  const supabase = getSupabase();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, product, region, subscription_status, growth_machine")
    .eq("id", leadId)
    .single();

  if (!lead) redirect("/");

  // Pega o ciclo mais recente (qualquer status — pode ser planned/opened/engaged)
  const { data: cycle } = await supabase
    .from("weekly_cycles")
    .select("id, week_iso, theme_short, theme_full, theme_category, linked_pillar_id, evolution_step, status, priority_reason")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sinais da semana do ciclo
  let signals: SignalsData | null = null;
  if (cycle?.week_iso) {
    const { data: sig } = await supabase
      .from("weekly_signals")
      .select("macro, competitors, own_business")
      .eq("lead_id", leadId)
      .eq("week_iso", cycle.week_iso)
      .maybeSingle();
    signals = sig as SignalsData | null;
  }

  const action = searchParams?.action || "Ver o plano";
  const whatsappText = encodeURIComponent(action);
  const whatsappUrl = `https://wa.me/${TWILIO_WHATSAPP_NUMBER}?text=${whatsappText}`;

  const firstName = ((lead.name as string) || "").split(" ")[0] || "Olá";
  const shortRegion = ((lead.region as string) || "").split(",")[0]?.trim() || "";

  // Mapear linked_pillar_id pra título da tese (do growth_machine)
  const pillars = ((lead.growth_machine as any)?.strategicPillars) as any[] | undefined;
  const linkedPillar = pillars?.find((p: any, i: number) =>
    (p.id || `pilar-${i + 1}`) === cycle?.linked_pillar_id,
  );
  const pillarLabel = linkedPillar?.title || cycle?.linked_pillar_id;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F7F5F2",
      fontFamily: "-apple-system, 'Segoe UI', sans-serif",
      padding: "48px 24px",
    }}>
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        {/* Header Virô */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#161618", letterSpacing: "-0.02em" }}>
            Virô<span style={{ color: "#0F766E" }}>.</span>
          </div>
          <div style={{
            fontSize: 10, color: "#A1A1AA", fontFamily: "monospace",
            letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4,
          }}>
            Sua estratégia desta semana
          </div>
        </div>

        {/* Cabeçalho do lead */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#161618", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {firstName}, {lead.product as string}
          </h1>
          <p style={{ fontSize: 13, color: "#52525B", margin: 0 }}>
            {shortRegion}{cycle?.week_iso ? ` · ${cycle.week_iso}` : ""}
          </p>
        </div>

        {cycle ? (
          <>
            {/* Bloco de tema (estratégia, NÃO execução) */}
            <div style={{
              background: "#FEFEFF",
              border: "1px solid #E8E4DE",
              borderRadius: 14,
              padding: "24px 24px 22px",
              marginBottom: 16,
            }}>
              <div style={{
                fontFamily: "monospace", fontSize: 10, color: "#B45309",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
              }}>
                Tema desta semana
                {cycle.evolution_step && cycle.evolution_step > 1 ? ` · passo ${cycle.evolution_step}` : ""}
              </div>
              <h2 style={{
                fontSize: 24, fontWeight: 700, color: "#161618",
                margin: "0 0 14px", letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>
                {cycle.theme_short}
              </h2>
              <p style={{ fontSize: 14, color: "#3A3A40", margin: "0 0 18px", lineHeight: 1.65 }}>
                {cycle.theme_full}
              </p>

              {pillarLabel && (
                <div style={{
                  background: "#F7F5F2",
                  borderLeft: "3px solid #B45309",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 10, color: "#A1A1AA", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                    Tese vinculada
                  </div>
                  <div style={{ fontSize: 13, color: "#161618", fontWeight: 600 }}>
                    {pillarLabel}
                  </div>
                </div>
              )}

              {/* Por que esta semana — usa priority_reason + signals */}
              {(cycle.priority_reason?.signals_used?.length || cycle.priority_reason?.evolution_from_last) && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#161618", marginBottom: 6 }}>
                    Por que esta semana
                  </div>
                  {cycle.priority_reason?.evolution_from_last && (
                    <p style={{ fontSize: 13, color: "#3A3A40", margin: "0 0 10px", lineHeight: 1.6 }}>
                      {cycle.priority_reason.evolution_from_last}
                    </p>
                  )}
                  {cycle.priority_reason?.signals_used && cycle.priority_reason.signals_used.length > 0 && (
                    <ul style={{ fontSize: 13, color: "#52525B", margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                      {cycle.priority_reason.signals_used.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Bloco de sinais (snapshot do mercado) */}
            {signals && (signals.macro?.summary || (signals.competitors && signals.competitors.length > 0)) && (
              <div style={{
                background: "#FEFEFF",
                border: "1px solid #E8E4DE",
                borderRadius: 14,
                padding: "20px 24px",
                marginBottom: 24,
              }}>
                <div style={{
                  fontFamily: "monospace", fontSize: 10, color: "#A1A1AA",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
                }}>
                  Sinais do seu mercado nesta semana
                </div>

                {signals.macro?.summary && (
                  <p style={{ fontSize: 12, color: "#52525B", margin: "0 0 10px", lineHeight: 1.6 }}>
                    {signals.macro.summary.slice(0, 200)}{signals.macro.summary.length > 200 ? "…" : ""}
                  </p>
                )}

                {signals.competitors && signals.competitors.length > 0 && (
                  <div style={{ fontSize: 12, color: "#52525B", lineHeight: 1.6 }}>
                    {signals.competitors.slice(0, 3).map((c, i: number) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <strong style={{ color: "#161618" }}>@{c.handle}</strong>: {c.signal}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CTA — único caminho daqui pra frente: WhatsApp */}
            <div style={{
              background: "#161618",
              borderRadius: 14,
              padding: "26px 24px",
              textAlign: "center",
              color: "#FEFEFF",
            }}>
              <div style={{
                fontFamily: "monospace", fontSize: 10, color: "#B45309",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
              }}>
                O plano completo está na conversa
              </div>
              <p style={{ fontSize: 14, color: "#FEFEFF", margin: "0 0 18px", lineHeight: 1.65 }}>
                Cada semana, o plano executável (passos, scripts prontos, métricas) é entregue
                no seu WhatsApp para que a Virô possa acompanhar a execução, ajustar a rota
                e capturar os aprendizados.
              </p>
              <a
                href={whatsappUrl}
                style={{
                  display: "block",
                  background: "#B45309",
                  color: "#FEFEFF",
                  textAlign: "center",
                  padding: "16px 24px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 15,
                  marginBottom: 10,
                }}
              >
                💬 Receber o plano pela Virô
              </a>
              <p style={{ fontSize: 11, color: "#A1A1AA", margin: 0, lineHeight: 1.5 }}>
                Você será levado para o WhatsApp com a mensagem pronta. Basta enviar para começar.
              </p>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <Link
                href={`/dashboard/${leadId}`}
                style={{ fontSize: 12, color: "#52525B", textDecoration: "none" }}
              >
                Ver dashboard completo →
              </Link>
            </div>
          </>
        ) : (
          // Sem ciclo ativo — provavelmente subscriber acabou de assinar
          <div style={{
            background: "#FEFEFF",
            border: "1px solid #E8E4DE",
            borderRadius: 14,
            padding: "32px 24px",
            textAlign: "center",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#161618", margin: "0 0 10px" }}>
              Sua estratégia da semana está sendo preparada.
            </h2>
            <p style={{ fontSize: 13, color: "#52525B", margin: "0 0 20px", lineHeight: 1.65 }}>
              Na próxima sexta-feira, a Virô abre o primeiro ciclo de acompanhamento estratégico
              do seu negócio. Você receberá uma notificação pelo WhatsApp com o tema da semana.
            </p>
            <Link
              href={`/dashboard/${leadId}`}
              style={{
                display: "inline-block",
                background: "#161618",
                color: "#FEFEFF",
                padding: "12px 24px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Abrir meu dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
