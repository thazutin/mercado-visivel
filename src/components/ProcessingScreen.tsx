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

const facts = [
  { text: "46% de todas as buscas no Google têm intenção local.", source: "Google" },
  { text: "Negócios com fotos no Google Meu Negócio recebem 42% mais pedidos de rota.", source: "Google" },
  { text: "76% das pessoas que buscam algo local visitam uma empresa em até 24h.", source: "Google" },
  { text: "'Perto de mim' e 'aberto agora' são os modificadores de busca local que mais crescem.", source: "Google Trends" },
  { text: "Negócios com mais de 100 fotos no Google Maps recebem 520% mais ligações.", source: "BrightLocal" },
  { text: "90% dos usuários do Instagram seguem pelo menos uma empresa.", source: "Instagram" },
  { text: "Reels têm alcance orgânico 3x maior que posts estáticos no Instagram.", source: "Meta" },
  { text: "70% dos consumidores usam o Instagram para descobrir produtos e serviços novos.", source: "Instagram" },
  { text: "88% dos consumidores confiam em avaliações online tanto quanto em recomendações pessoais.", source: "BrightLocal" },
  { text: "Empresas que respondem avaliações têm 45% mais chance de receber novas avaliações.", source: "Harvard Business Review" },
  { text: "Um aumento de 1 estrela no Google pode aumentar a receita em até 9%.", source: "Harvard Business Review" },
  { text: "25% das pesquisas feitas com IA têm intenção de compra local.", source: "SparkToro" },
  { text: "Negócios com website têm 2x mais chance de ser citados por ferramentas de IA.", source: "BrightLocal" },
  { text: "A maioria das decisões de compra local começa com uma busca online, mesmo para visitas presenciais.", source: "Think with Google" },
  { text: "Consumidores que pesquisam antes de visitar gastam em média 30% mais.", source: "Deloitte" },
  { text: "Negócios sem presença digital perdem em média 70% das oportunidades de novos clientes.", source: "SEBRAE" },
  { text: "93% dos brasileiros com smartphone usam WhatsApp diariamente.", source: "DataReportal" },
  { text: "Brasil é o 2º país que mais usa WhatsApp no mundo.", source: "Meta" },
  { text: "72% dos pequenos negócios brasileiros usam WhatsApp como principal canal de vendas.", source: "SEBRAE" },
  { text: "Pequenos negócios que respondem clientes em até 5 minutos convertem 9x mais.", source: "Harvard Business Review" },
];

interface Props {
  product: string;
  region?: string;
  onComplete: () => void;
  steps?: string[];
}

export default function ProcessingScreen({ product, region, onComplete, steps: customSteps }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * facts.length));
  const [factVisible, setFactVisible] = useState(true);

  const steps = customSteps || [
    "Mapeando termos de busca na sua região...",
    "Analisando volume de demanda...",
    "Calculando mercado disponível...",
    "Medindo sua influência digital...",
    "Preparando seu resultado...",
  ];

  useEffect(() => {
    const stepDuration = 3000;
    const timers: NodeJS.Timeout[] = [];

    steps.forEach((_, i) => {
      if (i > 0) {
        timers.push(setTimeout(() => setActiveIdx(i), i * stepDuration));
      }
    });

    timers.push(setTimeout(() => {
      setDone(true);
      onComplete();
    }, steps.length * stepDuration + 500));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Fact carousel: rotate every 4s with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIdx(prev => (prev + 1) % facts.length);
        setFactVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const shortRegion = region ? region.split(",")[0].trim() : "";
  const currentFact = facts[factIdx];

  return (
    <div id="viro-processing-screen" style={{
      minHeight: "100vh",
      background: V.night,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "32px 20px 24px",
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {/* Brand */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: V.graphite, display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <span style={{ fontFamily: V.display, fontWeight: 700, fontSize: 17, color: V.white, letterSpacing: "-0.03em" }}>V</span>
        </div>

        <h2 style={{
          fontFamily: V.display, fontSize: 20, fontWeight: 700,
          color: V.white, letterSpacing: "-0.03em", marginBottom: 4,
        }}>
          Analisando {product}
        </h2>
        {shortRegion ? (
          <p style={{ color: V.ash, fontSize: 13, fontFamily: V.body, marginBottom: 8 }}>
            em {shortRegion}
          </p>
        ) : (
          <p style={{ color: V.ash, fontSize: 13, fontFamily: V.body, marginBottom: 8 }}>
            {product}
          </p>
        )}

        <p style={{ color: V.zinc, fontSize: 11, fontFamily: V.mono, marginBottom: 20 }}>
          Isso pode levar até 60 segundos · fique aqui
        </p>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
          {steps.map((step, i) => {
            const isActive = i === activeIdx;
            const isDone = i < activeIdx || done;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 8,
                background: isDone ? V.tealWash : isActive ? V.graphite : "transparent",
                border: isActive ? `1px solid rgba(207,133,35,0.2)` : "1px solid transparent",
                transition: "all 0.4s ease",
                opacity: i <= activeIdx || done ? 1 : 0.3,
              }}>
                {/* Icon */}
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                  fontSize: 10, fontWeight: 600,
                  background: isDone ? V.teal : isActive ? V.graphite : V.slate,
                  color: isDone ? V.white : "transparent",
                  border: isActive && !isDone ? `2px solid ${V.amber}` : "none",
                  transition: "all 0.3s",
                }}>
                  {isDone && "✓"}
                  {isActive && !isDone && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
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
          marginTop: 20, height: 3, borderRadius: 2,
          background: V.graphite, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2, background: V.amber,
            width: done ? "100%" : `${((activeIdx + 1) / steps.length) * 100}%`,
            transition: "width 0.8s ease",
          }} />
        </div>

        {/* Educational facts carousel */}
        <div style={{
          marginTop: 20,
          padding: "16px 20px",
          background: V.graphite,
          borderRadius: 10,
          border: `1px solid ${V.slate}`,
          minHeight: 76,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div style={{
            opacity: factVisible ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}>
            <p style={{
              fontSize: 13,
              color: V.white,
              margin: "0 0 6px",
              lineHeight: 1.5,
              fontFamily: V.body,
            }}>
              {currentFact.text}
            </p>
            <p style={{
              fontSize: 10,
              color: V.ash,
              margin: 0,
              fontFamily: V.mono,
              letterSpacing: "0.02em",
              opacity: 0.7,
            }}>
              Fonte: {currentFact.source}
            </p>
          </div>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
