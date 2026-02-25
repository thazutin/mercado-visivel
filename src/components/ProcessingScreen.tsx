"use client";

import { useState, useEffect } from "react";

const V = {
  dark: "#141210",
  warmBlack: "#1E1C19",
  charcoal: "#2A2724",
  stone: "#8C8578",
  cream: "#F0ECE4",
  ember: "#D4582A",
  veroTeal: "#2B6B7C",
  veroGlow: "rgba(43, 107, 124, 0.10)",
  serif: "'DM Serif Display', Georgia, serif",
  body: "'Outfit', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

interface Props {
  product: string;
  onComplete: () => void;
}

export default function ProcessingScreen({ product, onComplete }: Props) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { text: "Analisando presença digital: site e redes sociais", detail: "12s" },
    { text: "Instagram: posts e engagement analisados", detail: "28s" },
    { text: "Google Reviews: avaliações e atributos mapeados", detail: "8s" },
    { text: `Volume de busca: "${product}" na região`, detail: "5s" },
    { text: "Perguntas frequentes da categoria identificadas", detail: "11s" },
    { text: "Concorrentes: mapeando posicionamento", detail: "34s" },
    { text: "Cruzamento 1/4: Calculando mercado disponível...", detail: "" },
    { text: "Cruzamento 2/4: Comparando percepção vs. realidade...", detail: "" },
    { text: "Cruzamento 3/4: Mapeando raio de influência...", detail: "" },
    { text: "Cruzamento 4/4: Gerando visão instantânea...", detail: "" },
    { text: "Análise concluída. Preparando resultados...", detail: "" },
  ];

  useEffect(() => {
    const delays = [400, 1800, 3200, 4600, 5800, 7200, 8800, 10000, 11200, 12200, 13500];
    const timeouts: NodeJS.Timeout[] = [];
    steps.forEach((_, i) => {
      timeouts.push(setTimeout(() => { setVisibleSteps(p => [...p, i]); setActiveStep(i); if (i > 0) setDoneSteps(p => [...p, i - 1]); }, delays[i]));
    });
    timeouts.push(setTimeout(() => { setDoneSteps(p => [...p, steps.length - 1]); setTimeout(onComplete, 1200); }, 15000));
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${V.dark} 0%, ${V.warmBlack} 100%)`, padding: "60px 24px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          {/* Vero avatar */}
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${V.veroTeal} 0%, #1A3A4A 100%)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 4px 16px rgba(43,107,124,0.3)" }}>
            <span style={{ fontFamily: V.serif, fontSize: 20, color: V.cream }}>V</span>
          </div>
          <h2 style={{ fontFamily: V.serif, fontSize: 28, fontWeight: 400, marginBottom: 12, color: V.cream, letterSpacing: "-0.02em" }}>
            Vero está analisando seu mercado
          </h2>
          <p style={{ color: V.stone, fontSize: 15, fontFamily: V.body }}>
            Cruzando dados reais da sua categoria e região.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {steps.map((step, i) => {
            const visible = visibleSteps.includes(i);
            const done = doneSteps.includes(i);
            const active = activeStep === i && visible && !done;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: 10,
                background: done ? V.veroGlow : active ? V.charcoal : "rgba(42,39,36,0.5)",
                border: active ? `1px solid rgba(43,107,124,0.3)` : "1px solid transparent",
                opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(10px)",
                transition: "all 0.5s ease",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0, fontSize: 11,
                  background: done ? V.veroTeal : V.charcoal,
                  color: done ? V.cream : "transparent",
                }}>
                  {done && "✓"}
                  {active && !done && (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid transparent", borderTopColor: V.ember, animation: "spin 0.8s linear infinite" }} />
                  )}
                </div>
                <div style={{ fontSize: 13, color: done || active ? V.cream : V.stone, fontFamily: V.body }}>{step.text}</div>
                {step.detail && done && (
                  <div style={{ fontFamily: V.mono, fontSize: 10, color: V.veroTeal, marginLeft: "auto", flexShrink: 0 }}>{step.detail}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
