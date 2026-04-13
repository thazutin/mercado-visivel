"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { V } from "@/lib/design-tokens";

// Fatos que rotacionam durante a espera — mesmos do ProcessingScreen original
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
  "Analisando como você aparece no Google...",
  "Verificando sua presença no Instagram...",
  "Mapeando concorrentes na sua região...",
  "Calculando onde você está perdendo clientes...",
  "Identificando as ações de maior impacto...",
  "Preparando seu plano de ação personalizado...",
];

// Animação de progresso visual: sobe até 95% em 90s (não 100% porque o real fica
// esperando o polling confirmar). Quando o polling detecta done, o componente
// é desmontado pelo router.refresh().
const VISUAL_DURATION_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000; // 5 min — depois disso mostra erro

export default function PollingScreen({
  leadId,
  product,
  region,
  name,
}: {
  leadId: string;
  product: string;
  region: string;
  name?: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * facts.length));
  const [factVisible, setFactVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  // Progresso visual 0 → 95 em VISUAL_DURATION_MS
  useEffect(() => {
    const interval = 100;
    const step = 95 / (VISUAL_DURATION_MS / interval);
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        if (next >= 95) {
          clearInterval(timer);
          return 95;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, []);

  // Mensagem rotativa a cada 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx((prev) => (prev + 1) % processingMessages.length);
        setMsgVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fato rotativo a cada 8s
  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIdx((prev) => (prev + 1) % facts.length);
        setFactVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Polling real do endpoint GET /api/diagnose
  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (cancelled || doneRef.current) return;
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "done" && data.results) {
          doneRef.current = true;
          setProgress(100);
          if (pollInterval) clearInterval(pollInterval);
          // Força o server component a re-renderizar com o diagnosis_display
          // populado. router.refresh() mantém o state da URL (não é reload).
          // Pequeno delay pro usuário ver o anel de progresso fechar em 100%.
          setTimeout(() => {
            if (!cancelled) router.refresh();
          }, 500);
        }
      } catch {
        /* ignore — continua polling */
      }
    };

    // Primeira chamada imediata + polling periódico
    check();
    pollInterval = setInterval(check, POLL_INTERVAL_MS);

    const timeoutId = setTimeout(() => {
      if (pollInterval) clearInterval(pollInterval);
      if (!doneRef.current && !cancelled) {
        setError(
          "Está demorando mais que o esperado. Seu diagnóstico pode já estar pronto — tente recarregar a página.",
        );
      }
    }, POLL_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [leadId, router]);

  const shortRegion = region?.split(",")[0].trim() || "";
  const displayName = (name && name.trim()) ? name.trim() : (product || "seu negócio");
  const currentFact = facts[factIdx];

  // SVG ring
  const size = 160;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      id="viro-processing-screen"
      style={{
        minHeight: "100vh",
        background: V.night,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {/* Title */}
        <h2
          style={{
            fontFamily: V.display,
            fontSize: 22,
            fontWeight: 700,
            color: V.white,
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}
        >
          Analisando {displayName}
        </h2>
        {shortRegion && (
          <p style={{ color: V.ash, fontSize: 13, margin: "0 0 8px" }}>{shortRegion}</p>
        )}
        <p style={{ color: V.zinc, fontSize: 12, fontFamily: V.mono, marginBottom: 32 }}>
          Isso pode levar até 2 minutos
        </p>

        {error ? (
          <div
            style={{
              background: "rgba(217,83,79,0.08)",
              borderRadius: 10,
              padding: "16px 18px",
              marginBottom: 16,
              border: "1px solid rgba(217,83,79,0.2)",
            }}
          >
            <p style={{ fontSize: 13, color: "#D9534F", margin: "0 0 12px", lineHeight: 1.5 }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                background: V.amber,
                color: V.white,
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        ) : (
          <>
            {/* Progress Ring */}
            <div style={{ position: "relative", width: size, height: size, margin: "0 auto 24px" }}>
              <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                {/* Background ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={V.graphite}
                  strokeWidth={strokeWidth}
                />
                {/* Progress ring */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={V.amber}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 0.3s linear" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: 36,
                  animation: "spin 3s linear infinite",
                }}
              >
                🔍
              </div>
            </div>

            {/* Rotating message */}
            <div style={{ minHeight: 24, marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 14,
                  color: V.mist,
                  fontFamily: V.body,
                  opacity: msgVisible ? 1 : 0,
                  transition: "opacity 0.3s ease",
                  margin: 0,
                }}
              >
                {processingMessages[msgIdx]}
              </p>
            </div>

            {/* Fact card */}
            <div
              style={{
                padding: "16px 20px",
                background: V.graphite,
                borderRadius: 10,
                border: `1px solid ${V.slate}`,
                minHeight: 76,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ opacity: factVisible ? 1 : 0, transition: "opacity 0.4s ease" }}>
                <p
                  style={{
                    fontSize: 13,
                    color: V.white,
                    margin: "0 0 6px",
                    lineHeight: 1.5,
                    fontFamily: V.body,
                  }}
                >
                  {currentFact.text}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: V.ash,
                    margin: 0,
                    fontFamily: V.mono,
                    letterSpacing: "0.02em",
                    opacity: 0.7,
                  }}
                >
                  Fonte: {currentFact.source}
                </p>
              </div>
            </div>

            {/* Reassurance: link atual é seu marcador, pode voltar depois */}
            <p
              style={{
                color: V.ash,
                fontSize: 11,
                fontFamily: V.body,
                marginTop: 20,
                lineHeight: 1.6,
              }}
            >
              Pode fechar essa aba — o diagnóstico continua rodando.
              <br />
              Volte no link salvo no seu email ou salve essa página.
            </p>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
