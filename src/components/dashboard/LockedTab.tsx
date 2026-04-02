"use client";

import { useState } from "react";
import { V } from "@/lib/design-tokens";

interface Props {
  lockLevel: 1 | 2;
  ctaLabel: string;
  ctaUrl: string;
  leadId?: string;
}

export function LockedTab({ lockLevel, ctaLabel, ctaUrl, leadId }: Props) {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function handleClick() {
    if (!leadId) return;
    setLoading(true);
    setErrMsg("");
    try {
      const endpoint = lockLevel === 2 ? "/api/checkout/subscription" : "/api/checkout";
      const body = lockLevel === 2
        ? { leadId }
        : { lead_id: leadId, locale: "pt" };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrMsg(data.error || "Erro ao iniciar pagamento. Tente novamente.");
        setLoading(false);
      }
    } catch (e) {
      console.error("Checkout error:", e);
      setErrMsg("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: 300 }}>
      <div style={{ filter: "blur(6px)", pointerEvents: "none" }}>
        {lockLevel === 1 ? (
          <>
            <div style={{
              background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
              padding: "20px 24px", marginBottom: 12,
            }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100, background: "#E1306C12", fontSize: 12, fontWeight: 500, color: "#E1306C", marginBottom: 12 }}>
                Instagram Feed
              </div>
              <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>
                Descubra como atrair mais clientes com dicas práticas para o seu negócio local. Nosso compromisso é entregar resultados reais para você crescer...
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 8px", borderRadius: 6 }}>#seunegocio</span>
                <span style={{ fontSize: 12, color: V.teal, background: "rgba(45,155,131,0.08)", padding: "2px 8px", borderRadius: 6 }}>#marketinglocal</span>
              </div>
            </div>
            <div style={{
              background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
              padding: "20px 24px", marginBottom: 12,
            }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100, background: "#4285F412", fontSize: 12, fontWeight: 500, color: "#4285F4", marginBottom: 12 }}>
                Google Business
              </div>
              <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>
                Venha conhecer nossos serviços especializados na região. Atendimento personalizado e resultados comprovados por nossos clientes...
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "20px 24px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>Conteúdo semanal personalizado para o seu negócio...</div>
            </div>
          </>
        )}
      </div>

      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(244,244,247,0.7)", borderRadius: 14,
      }}>
        <div style={{
          background: V.white, borderRadius: 16, padding: "32px 40px",
          textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: 360,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, lineHeight: 1 }}>
            {lockLevel === 1 ? "\uD83D\uDD12" : "\uD83D\uDD12\uD83D\uDD12"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 8 }}>
            {lockLevel === 1
              ? "Disponível no Plano de Ação"
              : "Disponível para Assinantes"}
          </div>
          <p style={{ fontSize: 13, color: V.ash, marginBottom: 20, lineHeight: 1.5 }}>
            {lockLevel === 1
              ? "Gere seu plano de ação com análise detalhada, ações práticas e conteúdos prontos para suas redes."
              : "Assine para receber conteúdos novos toda semana, acompanhamento contínuo e suporte prioritário."}
          </p>
          {leadId ? (
            <button
              onClick={handleClick}
              disabled={loading}
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                background: lockLevel === 1 ? V.night : V.teal,
                color: V.white, fontSize: 14, fontWeight: 600,
                border: "none", cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
              }}
            >
              {loading ? "Redirecionando ao pagamento..." : ctaLabel}
            </button>
          ) : (
            <a
              href={ctaUrl}
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                background: lockLevel === 1 ? V.night : V.teal,
                color: V.white, fontSize: 14, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {ctaLabel}
            </a>
          )}
          {errMsg && (
            <p style={{ fontSize: 12, color: V.coral, marginTop: 8 }}>{errMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
