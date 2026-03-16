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
  { text: "Consumidores que pesquisam antes de visitar gastam em média 30% mais.", source: "Deloitte" },
  { text: "Negócios sem presença digital perdem em média 70% das oportunidades de novos clientes.", source: "SEBRAE" },
  { text: "93% dos brasileiros com smartphone usam WhatsApp diariamente.", source: "DataReportal" },
  { text: "72% dos pequenos negócios brasileiros usam WhatsApp como principal canal de vendas.", source: "SEBRAE" },
  { text: "Pequenos negócios que respondem clientes em até 5 minutos convertem 9x mais.", source: "Harvard Business Review" },
];

const processingMessages = [
  "Mapeando termos de busca...",
  "Consultando Google Search...",
  "Analisando Instagram...",
  "Calculando audiência IBGE...",
  "Medindo influência digital...",
  "Cruzando dados de concorrência...",
  "Preparando seu diagnóstico...",
];

interface Props {
  product: string;
  region?: string;
  businessName?: string;
  onComplete: () => void;
  steps?: string[];
}

export default function ProcessingScreen({ product, region, businessName, onComplete, steps: _customSteps }: Props) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * facts.length));
  const [factVisible, setFactVisible] = useState(true);

  // Progress ring animation: 0→100 over 60s
  useEffect(() => {
    const duration = 60_000;
    const interval = 100;
    const step = 100 / (duration / interval);
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          onComplete();
          return 100;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, []);

  // Rotating processing message every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx(prev => (prev + 1) % processingMessages.length);
        setMsgVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fact carousel every 8s
  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIdx(prev => (prev + 1) % facts.length);
        setFactVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const displayName = businessName || product;
  const currentFact = facts[factIdx];

  // SVG ring
  const size = 160;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div style={{
      minHeight: "100vh",
      background: V.night,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
    }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {/* Title */}
        <h2 style={{
          fontFamily: V.display, fontSize: 22, fontWeight: 700,
          color: V.white, letterSpacing: "-0.03em", marginBottom: 6,
        }}>
          Analisando {displayName}
        </h2>
        {region && (
          <p style={{ color: V.ash, fontSize: 13, margin: "0 0 8px" }}>
            {region}
          </p>
        )}
        <p style={{ color: V.zinc, fontSize: 12, fontFamily: V.mono, marginBottom: 32 }}>
          Isso pode levar até 60 segundos
        </p>

        {/* Progress Ring */}
        <div style={{ position: "relative", width: size, height: size, margin: "0 auto 24px" }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            {/* Background ring */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={V.graphite} strokeWidth={strokeWidth}
            />
            {/* Progress ring */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={V.amber} strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          {/* Center icon */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            animation: "spin 3s linear infinite",
          }}>
            🔍
          </div>
        </div>

        {/* Rotating message */}
        <div style={{ minHeight: 24, marginBottom: 32 }}>
          <p style={{
            fontSize: 14, color: V.mist, fontFamily: V.body,
            opacity: msgVisible ? 1 : 0,
            transition: "opacity 0.3s ease",
            margin: 0,
          }}>
            {processingMessages[msgIdx]}
          </p>
        </div>

        {/* Fact card */}
        <div style={{
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
              fontSize: 13, color: V.white, margin: "0 0 6px",
              lineHeight: 1.5, fontFamily: V.body,
            }}>
              {currentFact.text}
            </p>
            <p style={{
              fontSize: 10, color: V.ash, margin: 0,
              fontFamily: V.mono, letterSpacing: "0.02em", opacity: 0.7,
            }}>
              Fonte: {currentFact.source}
            </p>
          </div>
        </div>

        {/* Notification */}
        <p style={{ color: V.ash, fontSize: 11, fontFamily: V.body, marginTop: 20 }}>
          Você também receberá o resultado por email.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
