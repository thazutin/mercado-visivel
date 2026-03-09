"use client";

import { useState, useEffect } from "react";

const V = {
  night: "#161618",
  graphite: "#232326",
  slate: "#3A3A40",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  mist: "#C8C8D0",
  fog: "#EAEAEE",
  cloud: "#F4F4F7",
  white: "#FEFEFF",
  amber: "#CF8523",
  amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface Props {
  product: string;
  region?: string;
  onComplete: () => void;
  steps?: string[];
}

export default function ProcessingScreen({ product, region, onComplete, steps: customSteps }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [done, setDone] = useState(false);

  const steps = customSteps || [
    "Mapeando termos de busca na sua região...",
    "Analisando volume de demanda...",
    "Calculando mercado disponível...",
    "Medindo sua influência digital...",
    "Preparando seu resultado...",
  ];

  useEffect(() => {
    // Cycle through steps, then hold on last step until API completes
    const stepDuration = 3000;
    const timers: NodeJS.Timeout[] = [];

    steps.forEach((_, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setActiveIdx(i), i * stepDuration));
      }
    });

    // After cycling all steps, call onComplete — parent decides when to transition
    // If API is still running, parent holds us on processing screen
    timers.push(setTimeout(() => {
      setDone(true);
      onComplete();
    }, steps.length * stepDuration + 500));

    return () => timers.forEach(clearTimeout);
  }, []);

  const shortRegion = region ? region.split(",")[0].trim() : "";

  return (
    <div id="viro-processing-screen" style={{
      minHeight: "100vh",
      background: V.night,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {/* Brand */}
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: V.graphite, display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 22, color: V.white, letterSpacing: "-0.03em" }}>V</span>
        </div>

        <h2 style={{
          fontFamily: V.display, fontSize: 24, fontWeight: 700,
          color: V.white, letterSpacing: "-0.03em", marginBottom: 8,
        }}>
          Analisando {product}
        </h2>
        {shortRegion ? (
          <p style={{ color: V.ash, fontSize: 14, fontFamily: V.body, marginBottom: 12 }}>
            em {shortRegion}
          </p>
        ) : (
          <p style={{ color: V.ash, fontSize: 14, fontFamily: V.body, marginBottom: 12 }}>
            {product}
          </p>
        )}

        <p style={{ color: V.zinc, fontSize: 12, fontFamily: V.mono, marginBottom: 12 }}>
          Isso pode levar até 60 segundos
        </p>
        <p style={{ color: V.ash, fontSize: 12, fontFamily: V.body, marginBottom: 48, lineHeight: 1.5 }}>
          Fique aqui — seu resultado aparece nessa tela assim que ficar pronto.
        </p>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
          {steps.map((step, i) => {
            const isActive = i === activeIdx;
            const isDone = i < activeIdx || done;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px", borderRadius: 10,
                background: isDone ? V.tealWash : isActive ? V.graphite : "transparent",
                border: isActive ? `1px solid rgba(207,133,35,0.2)` : "1px solid transparent",
                transition: "all 0.4s ease",
                opacity: i <= activeIdx || done ? 1 : 0.3,
              }}>
                {/* Icon */}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                  fontSize: 11, fontWeight: 600,
                  background: isDone ? V.teal : isActive ? V.graphite : V.slate,
                  color: isDone ? V.white : "transparent",
                  border: isActive && !isDone ? `2px solid ${V.amber}` : "none",
                  transition: "all 0.3s",
                }}>
                  {isDone && "✓"}
                  {isActive && !isDone && (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      border: "2px solid transparent", borderTopColor: V.amber,
                      animation: "spin 0.8s linear infinite",
                    }} />
                  )}
                </div>

                {/* Text */}
                <span style={{
                  fontSize: 13, fontFamily: V.body,
                  color: isDone ? V.mist : isActive ? V.white : V.zinc,
                  transition: "color 0.3s",
                }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{
          marginTop: 40, height: 3, borderRadius: 2,
          background: V.graphite, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2, background: V.amber,
            width: done ? "100%" : `${((activeIdx + 1) / steps.length) * 100}%`,
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
