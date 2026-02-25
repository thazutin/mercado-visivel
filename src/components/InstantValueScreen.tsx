"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";

const V = {
  dark: "#141210",
  warmBlack: "#1E1C19",
  charcoal: "#2A2724",
  stone: "#8C8578",
  sand: "#B8AFA4",
  cream: "#F0ECE4",
  paper: "#F7F5F0",
  white: "#FEFEFE",
  ember: "#D4582A",
  emberGlow: "rgba(212, 88, 42, 0.12)",
  veroBlue: "#1A3A4A",
  veroTeal: "#2B6B7C",
  veroLight: "#E8F1F4",
  veroGlow: "rgba(43, 107, 124, 0.10)",
  serif: "'DM Serif Display', Georgia, serif",
  body: "'Outfit', sans-serif",
  mono: "'IBM Plex Mono', monospace",
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
  onCheckout: (coupon?: string) => void;
  loading?: boolean;
}

export default function InstantValueScreen({ product, region, results, onCheckout, loading }: Props) {
  const [show, setShow] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 100);
    setTimeout(() => setBarWidth(results.influencePercent), 800);
  }, [results.influencePercent]);

  return (
    <div style={{ minHeight: "100vh", background: V.cream, padding: "60px 24px", opacity: show ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header — Vero delivers */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${V.veroTeal}, ${V.veroBlue})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <span style={{ fontFamily: V.serif, fontSize: 18, color: V.cream }}>V</span>
          </div>
          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: V.veroTeal, background: V.veroGlow, padding: "6px 16px", borderRadius: 100, display: "inline-block", marginBottom: 20 }}>
            Visão instantânea — Vero
          </div>
          <p style={{ fontSize: 14, color: V.stone }}>
            {product} · {region}
          </p>
        </div>

        {/* Market range — the wow */}
        <div style={{ background: V.white, borderRadius: 16, border: "1px solid #E5E0D8", padding: "36px 28px", marginBottom: 16, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.stone, marginBottom: 12 }}>
            Mercado disponível na sua região
          </div>
          <div style={{ fontFamily: V.serif, fontSize: "clamp(36px, 6vw, 52px)", color: V.dark, letterSpacing: "-0.02em", lineHeight: 1 }}>
            R$ <AnimatedCounter target={results.marketLow} duration={1500} /> — <AnimatedCounter target={results.marketHigh} duration={1800} />
          </div>
          <div style={{ fontFamily: V.mono, fontSize: 12, color: V.stone, marginTop: 8 }}>por mês</div>
        </div>

        {/* Influence bar */}
        <div style={{ background: V.white, borderRadius: 16, border: "1px solid #E5E0D8", padding: "28px 24px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: V.body, fontSize: 14, color: V.dark, fontWeight: 500 }}>Você influencia ~{results.influencePercent}%</span>
            <span style={{ fontFamily: V.mono, fontSize: 11, color: V.stone }}>100% do mercado</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: "#E5E0D8", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 5, background: `linear-gradient(90deg, ${V.ember}, ${V.veroTeal})`, width: `${barWidth}%`, transition: "width 1.5s cubic-bezier(0.16, 1, 0.3, 1)" }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "buscas/mês", value: results.totalVolume.toLocaleString("pt-BR") },
            { label: "CPC médio", value: `R$ ${results.avgCpc.toFixed(2)}` },
            { label: "termos mapeados", value: results.terms.length.toString() },
          ].map((s, i) => (
            <div key={i} style={{ flex: "1 1 120px", background: V.white, borderRadius: 12, border: "1px solid #E5E0D8", padding: "16px", textAlign: "center" }}>
              <div style={{ fontFamily: V.serif, fontSize: 22, color: V.veroBlue }}>{s.value}</div>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.stone, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* All terms — no paywall on data */}
        <div style={{ background: V.white, borderRadius: 16, border: "1px solid #E5E0D8", padding: "24px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.veroTeal, marginBottom: 16 }}>
            Termos de busca reais
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.terms.map((t: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: i % 2 === 0 ? V.paper : "transparent" }}>
                <span style={{ fontSize: 14, color: V.dark }}>{t.term}</span>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontFamily: V.mono, fontSize: 12, color: V.veroTeal }}>{t.volume.toLocaleString("pt-BR")}/mês</span>
                  <span style={{ fontFamily: V.mono, fontSize: 12, color: V.stone }}>R$ {t.cpc.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bridge text */}
        <div style={{ padding: "0 8px", marginBottom: 32 }}>
          <p style={{ fontSize: 16, color: V.dark, lineHeight: 1.8, fontFamily: V.body, marginBottom: 12, fontWeight: 500 }}>
            Esse mercado existe. Ele não depende de você — já está lá.
          </p>
          <p style={{ fontSize: 14, color: V.stone, lineHeight: 1.8 }}>
            A pergunta é: como aumentar a probabilidade de que, quando alguém nesse mercado precisar do que você oferece, seu negócio seja lembrado? Não existe garantia — mas existe um plano baseado em evidência.
          </p>
        </div>

        {/* Deliverables — what Vero unlocks */}
        <div style={{ background: V.warmBlack, borderRadius: 16, padding: "32px 24px", marginBottom: 24, color: V.cream }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.veroTeal, marginBottom: 20 }}>
            O que Vero desbloqueia
          </div>
          {[
            { title: "Espelho de percepção", desc: "O que você comunica vs. o que seu cliente valoriza" },
            { title: "Mapa competitivo", desc: "Quem aparece, o que fazem diferente, onde você tem vantagem" },
            { title: "Ativos subutilizados", desc: "O que você já tem mas não trabalha pra atrair" },
            { title: "Plano de 90 dias", desc: "Ações concretas — reflexivas, acionáveis, delegáveis" },
            { title: "Briefing semanal", desc: "O que mudou e como responder com o que você já tem" },
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "flex-start" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: V.veroTeal, marginTop: 8, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: V.serif, fontSize: 16, fontWeight: 400, color: V.cream, marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: 13, color: V.sand, lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Coupon + CTA */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {/* Coupon field */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: V.white, border: `1px solid ${couponApplied ? V.veroTeal : "#E5E0D8"}`, borderRadius: 10, padding: "4px 4px 4px 16px", maxWidth: 340, width: "100%" }}>
              <input
                type="text"
                placeholder="Código promocional"
                value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{ border: "none", outline: "none", fontSize: 14, fontFamily: V.mono, letterSpacing: "0.04em", color: V.dark, background: "transparent", flex: 1, padding: "10px 0" }}
              />
              {coupon.length > 0 && (
                <button
                  onClick={() => setCouponApplied(true)}
                  style={{ background: couponApplied ? V.veroTeal : V.charcoal, color: V.white, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontFamily: V.mono, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" as const }}
                >
                  {couponApplied ? "✓ Aplicado" : "Aplicar"}
                </button>
              )}
            </div>
            {couponApplied && (
              <div style={{ fontSize: 12, color: V.veroTeal, marginTop: 8, fontFamily: V.mono, animation: "fadeInUp 0.3s ease" }}>
                Cupom {coupon} será validado no checkout
              </div>
            )}
          </div>

          <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
            background: V.ember, color: V.white, border: "none", padding: "16px 36px",
            borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer",
            fontFamily: V.body, transition: "all 0.3s ease",
            boxShadow: "0 4px 20px rgba(212,88,42,0.3)",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Redirecionando..." : couponApplied ? "Desbloquear o como" : "Desbloquear o como — R$ 497"}
          </button>
          {couponApplied && (
            <p style={{ fontSize: 14, color: V.dark, marginTop: 12, fontWeight: 500 }}>
              <span style={{ textDecoration: "line-through", color: V.stone }}>R$ 497</span>{" "}
              <span style={{ color: V.veroTeal }}>Desconto aplicado no checkout</span>
            </p>
          )}
          {!couponApplied && (
            <p style={{ fontSize: 13, color: V.stone, marginTop: 12 }}>
              Diagnóstico Vero + plano semanal por R$ 197/mês
            </p>
          )}
        </div>

        {/* Disclaimer */}
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ fontSize: 12, color: V.stone, lineHeight: 1.7, maxWidth: 480, margin: "0 auto", fontStyle: "italic" }}>
            Como plano de treino ou dieta — resultado depende da execução. Vero dá clareza e direção. Consistência é com você.
          </p>
        </div>
      </div>
    </div>
  );
}
