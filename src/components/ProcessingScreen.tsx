"use client";

import { useState, useEffect } from "react";

const T = {
  bg: "#0a0a0f",
  bgCard: "#111118",
  bgCardHover: "#16161f",
  accent: "#f0a030",
  green: "#00d4aa",
  text: "#e8e8f0",
  textMuted: "#8888a0",
  border: "#222233",
  mono: "'Space Mono', monospace",
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
    { text: `Volume de busca: buscas/mês na categoria "${product}"`, detail: "5s" },
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
      timeouts.push(
        setTimeout(() => {
          setVisibleSteps((prev) => [...prev, i]);
          setActiveStep(i);
          if (i > 0) setDoneSteps((prev) => [...prev, i - 1]);
        }, delays[i])
      );
    });

    timeouts.push(
      setTimeout(() => {
        setDoneSteps((prev) => [...prev, steps.length - 1]);
        setTimeout(onComplete, 1200);
      }, 15000)
    );

    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: "60px 24px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            Analisando seu mercado
          </h2>
          <p style={{ color: T.textMuted, fontSize: 15 }}>
            Cruzando dados reais da sua categoria e região.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {steps.map((step, i) => {
            const visible = visibleSteps.includes(i);
            const done = doneSteps.includes(i);
            const active = activeStep === i && visible && !done;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 8,
                  background: done ? "rgba(0, 212, 170, 0.05)" : active ? T.bgCardHover : T.bgCard,
                  border: active ? `1px solid ${T.border}` : "1px solid transparent",
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(10px)",
                  transition: "all 0.5s ease",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 12,
                    background: done ? T.green : T.border,
                    color: done ? T.bg : "transparent",
                  }}
                >
                  {done && "✓"}
                  {active && !done && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid transparent",
                        borderTopColor: T.accent,
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  )}
                </div>

                <div style={{ fontSize: 14, color: done || active ? T.text : T.textMuted }}>
                  {step.text}
                </div>

                {step.detail && done && (
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.green,
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    {step.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
