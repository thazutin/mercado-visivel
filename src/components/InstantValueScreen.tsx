"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";

const T = {
  bg: "#0a0a0f",
  bgCard: "#111118",
  accent: "#f0a030",
  accentGlow: "rgba(240, 160, 48, 0.13)",
  accentSoft: "#f7c46c",
  green: "#00d4aa",
  greenGlow: "rgba(0, 212, 170, 0.15)",
  text: "#e8e8f0",
  textMuted: "#8888a0",
  textDim: "#555568",
  border: "#222233",
  mono: "'Space Mono', monospace",
};

interface Results {
  terms: { term: string; volume: number; cpc: number; position: string }[];
  totalVolume: number;
  avgCpc: number;
  marketLow: number;
  marketHigh: number;
  influencePercent: number;
  source: string;
  confidence: string;
  enrichment?: { analysis: string; suggestions: string[] } | null;
}

interface Props {
  product: string;
  region: string;
  results: Results;
  onCheckout: () => void;
  loading?: boolean;
}

export default function InstantValueScreen({ product, region, results, onCheckout, loading }: Props) {
  const [show, setShow] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
    setTimeout(() => setBarWidth(results.influencePercent), 800);
  }, [results.influencePercent]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        padding: "60px 24px",
        opacity: show ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: T.accent,
              background: T.accentGlow,
              padding: "8px 20px",
              borderRadius: 100,
              border: "1px solid rgba(240,160,48,0.25)",
              marginBottom: 24,
            }}
          >
            Visão instantânea
          </div>
          <h2 style={{ fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 700, marginBottom: 8 }}>
            {product} em {region}
          </h2>
          <p style={{ fontSize: 14, color: T.textMuted }}>
            Análise baseada em dados reais de busca da sua categoria e região.
          </p>
        </div>

        {/* The Number — Market range */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, ${T.accentGlow}, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 12 }}>
              Mercado disponível na sua região
            </p>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: "clamp(28px, 7vw, 48px)",
                fontWeight: 700,
                color: T.accent,
                marginBottom: 8,
              }}
            >
              <AnimatedCounter target={results.marketLow} prefix="R$ " duration={2000} />
              {" — "}
              <AnimatedCounter target={results.marketHigh} prefix="R$ " duration={2500} />
            </div>
            <p style={{ fontSize: 18, marginBottom: 8 }}>por mês</p>
            <p style={{ fontSize: 13, color: T.textDim }}>
              {results.confidence} · Fonte: {results.source} ·{" "}
              <span
                style={{ color: T.accent, textDecoration: "underline", cursor: "pointer" }}
                onClick={() =>
                  alert(
                    `Premissas do cálculo:\n\n` +
                      `• Volume de busca: ${results.totalVolume.toLocaleString("pt-BR")}/mês\n` +
                      `• CPC médio: R$ ${results.avgCpc.toFixed(2)}\n` +
                      `• CTR estimado: 25-45%\n` +
                      `• Taxa de conversão: 1-1.5% (conservadora)\n` +
                      `• Faixa usa piso e teto de premissas\n\n` +
                      `Fonte: Google Ads Keyword Planner`
                  )
                }
              >
                Ver premissas
              </span>
            </p>

            {/* Influence bar */}
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: T.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: T.accent,
                    borderRadius: 4,
                    width: `${barWidth}%`,
                    transition: "width 1.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ color: T.accent, fontWeight: 600 }}>
                  Você influencia ~{results.influencePercent}%
                </span>
                <span style={{ color: T.textDim }}>100% do mercado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Buscas/mês", value: results.totalVolume.toLocaleString("pt-BR") },
            { label: "CPC médio", value: `R$ ${results.avgCpc.toFixed(2)}` },
            { label: "Termos mapeados", value: String(results.terms.length) },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <p style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700 }}>{s.value}</p>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.textDim,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ALL terms visible (free wow moment) */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Termos de busca reais</span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                color: T.green,
                background: T.greenGlow,
                padding: "4px 10px",
                borderRadius: 100,
              }}
            >
              {results.terms.length} termos
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 80px",
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            {["Termo", "Volume", "CPC"].map((h) => (
              <span
                key={h}
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  color: T.textDim,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  textAlign: h === "Termo" ? "left" : "right",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {results.terms.map((t, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 80px",
                gap: 12,
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: i < results.terms.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.8)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.term}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, textAlign: "right" }}>
                {t.volume.toLocaleString("pt-BR")}/mês
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.green, textAlign: "right" }}>
                R$ {t.cpc.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Bridge text */}
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "32px 28px",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
            Esse mercado existe. Ele não depende de você — já está lá.
          </p>
          <p style={{ fontSize: 15, color: T.textMuted, lineHeight: 1.8 }}>
            A pergunta é: como aumentar a probabilidade de que, quando alguém nesse mercado precisar do
            que você oferece, seu negócio seja lembrado? Não existe garantia — mas existe um plano baseado
            em evidência que aumenta essa probabilidade além do que aconteceria sem fazer nada.
          </p>
        </div>

        {/* What you get */}
        <div
          style={{
            background: "rgba(240,160,48,0.05)",
            border: "1px solid rgba(240,160,48,0.15)",
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 32,
          }}
        >
          <p
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: T.accent,
              marginBottom: 16,
            }}
          >
            O que o diagnóstico completo entrega
          </p>

          {[
            {
              title: "Espelho de percepção",
              desc: "O que você comunica vs. o que seu cliente realmente valoriza — e onde está a lacuna",
            },
            {
              title: "Mapa competitivo",
              desc: "Quem aparece quando seu cliente busca, o que fazem diferente, e onde você já tem vantagem",
            },
            {
              title: "Ativos subutilizados",
              desc: "Reviews, história, expertise que você já tem mas não trabalham para atrair clientes",
            },
            {
              title: "Plano de 12 semanas",
              desc: "Ações concretas de posicionamento, presença e reputação — não é calendário de posts, é construção de influência",
            },
            {
              title: "Briefing semanal",
              desc: "O que mudou no seu mercado esta semana e como responder com o que você já tem",
            },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 4 ? 14 : 0 }}>
              <span style={{ color: T.green, fontSize: 14, marginTop: 2, flexShrink: 0 }}>✓</span>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                <p style={{ fontSize: 13, color: T.textMuted, marginTop: 2, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              background: "rgba(240,160,48,0.06)",
              borderRadius: 8,
            }}
          >
            <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>
              Assim como um plano de treino ou dieta, os resultados dependem da execução. O diagnóstico dá
              clareza e direção — a consistência é com você.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={onCheckout}
            disabled={loading}
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              background: T.accent,
              border: "none",
              borderRadius: 100,
              padding: "16px 40px",
              cursor: loading ? "wait" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: `0 8px 40px ${T.accentGlow}`,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Redirecionando..." : "Desbloquear o como — R$ 497"}
          </button>
          <p style={{ fontSize: 12, color: T.textDim, marginTop: 16, maxWidth: 360, margin: "16px auto 0" }}>
            Diagnóstico completo + plano semanal contínuo por R$ 197/mês
          </p>
        </div>
      </div>
    </div>
  );
}
