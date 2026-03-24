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
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

const processingMessages = [
  "Gerando diagnóstico completo por canal...",
  "Montando plano de ação prioritário...",
  "Definindo itens estruturantes...",
  "Analisando sazonalidade do mercado...",
  "Gerando amostra de conteúdos...",
  "Finalizando seu plano de ação...",
];

interface Props {
  product: string;
  region: string;
}

export default function PostPaymentScreen({ product, region }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  // Progress ring: slow animation over 5 min (300s), but caps at 90%
  useEffect(() => {
    const duration = 300_000;
    const interval = 500;
    const maxProgress = 90;
    const step = maxProgress / (duration / interval);
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev + step;
        if (next >= maxProgress) {
          clearInterval(timer);
          return maxProgress;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, []);

  // Rotating message every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx(prev => (prev + 1) % processingMessages.length);
        setMsgVisible(true);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const shortRegion = region?.split(",")[0]?.trim() || region;

  // SVG ring
  const size = 160;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div id="viro-processing-screen" style={{
      minHeight: "100vh",
      background: V.night,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
    }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        {/* Success checkmark */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: V.teal, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={V.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: V.display, fontSize: 26, fontWeight: 700,
          color: V.white, letterSpacing: "-0.03em", marginBottom: 8,
          lineHeight: 1.3,
        }}>
          Pagamento confirmado!
        </h1>
        <p style={{
          fontFamily: V.body, fontSize: 15, color: V.mist,
          lineHeight: 1.6, margin: "0 0 32px",
        }}>
          Obrigado pela compra. Estamos preparando seu diagnóstico completo e plano de ação para{" "}
          <strong style={{ color: V.white }}>{product}</strong> em{" "}
          <strong style={{ color: V.white }}>{shortRegion}</strong>.
        </p>

        {/* Progress Ring */}
        <div style={{ position: "relative", width: size, height: size, margin: "0 auto 24px" }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={V.graphite} strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={V.teal} strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.5s linear" }}
            />
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            animation: "spin 3s linear infinite",
          }}>
            ⚙️
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

        {/* Info card: what happens next */}
        <div style={{
          padding: "20px 24px",
          background: V.graphite,
          borderRadius: 12,
          border: `1px solid ${V.slate}`,
          textAlign: "left",
          marginBottom: 20,
        }}>
          <p style={{
            fontSize: 14, fontWeight: 600, color: V.white,
            fontFamily: V.display, margin: "0 0 14px",
          }}>
            O que acontece agora:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "📊", text: "Diagnóstico completo por canal sendo gerado" },
              { icon: "📋", text: "Plano de ação com itens priorizados" },
              { icon: "📝", text: "Amostra de conteúdos prontos para publicar" },
              { icon: "📧", text: "Email de aviso quando estiver pronto — até 5 minutos" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: "22px", flexShrink: 0 }}>{item.icon}</span>
                <p style={{
                  fontSize: 13, color: V.mist, margin: 0,
                  lineHeight: 1.5, fontFamily: V.body,
                }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Subtle note */}
        <p style={{
          color: V.ash, fontSize: 11, fontFamily: V.body, margin: 0,
          lineHeight: 1.5,
        }}>
          Você pode fechar esta página. Enviaremos tudo por email.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
