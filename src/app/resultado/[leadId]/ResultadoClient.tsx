// File: src/app/resultado/[leadId]/ResultadoClient.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InstantValueScreen from "@/components/InstantValueScreen";
import PostPaymentScreen from "@/components/PostPaymentScreen";
import { LockedTab } from "@/components/dashboard/LockedTab";

const V = {
  night: "#161618", zinc: "#6E6E78", ash: "#9E9EA8",
  fog: "#EAEAEE", cloud: "#F4F4F7", white: "#FEFEFF",
  amber: "#CF8523", teal: "#2D9B83",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

type TabKey = "resultado" | "diagnostico" | "checklist" | "conteudos";

const TABS: { key: TabKey; label: string; locked: false | 1 | 2 }[] = [
  { key: "resultado", label: "Diagnóstico inicial", locked: false },
  { key: "diagnostico", label: "Diagnóstico completo", locked: 1 },
  { key: "checklist", label: "Seu Plano", locked: 1 },
  { key: "conteudos", label: "Conteúdos semanais", locked: 2 },
];

interface Props {
  product: string;
  region: string;
  leadId: string;
  results: any;
}

export default function ResultadoClient({ product, region, leadId, results }: Props) {
  const [tab, setTab] = useState<TabKey>("resultado");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPostPayment, setShowPostPayment] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [statusMsg, setStatusMsg] = useState(0);

  // Cicla mensagens de status a cada 3s
  useEffect(() => {
    const interval = setInterval(() => setStatusMsg(prev => (prev + 1) % 3), 3000);
    return () => clearInterval(interval);
  }, []);

  const statusMessages = [
    "Buscando concorrentes no seu raio...",
    "Analisando demanda ativa no Google...",
    "Calculando sua posição competitiva...",
  ];

  // Detecta retorno do Stripe com ?paid=true
  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      setShowPostPayment(true);
      router.replace(`/resultado/${leadId}`, { scroll: false });
    }
  }, [searchParams, leadId, router]);

  // Poll para saber quando o plano ficou pronto
  useEffect(() => {
    if (!showPostPayment) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        const data = await res.json();
        if (data.planReady || data.plan_status === "ready") {
          setPlanReady(true);
          clearInterval(poll);
        }
      } catch { /* ignora */ }
    }, 10_000);
    const timeout = setTimeout(() => { clearInterval(poll); setShowPostPayment(false); }, 5 * 60_000);
    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, [showPostPayment, leadId]);

  // Quando plano pronto, redireciona para dashboard
  useEffect(() => {
    if (!planReady) return;
    const timer = setTimeout(() => {
      window.location.href = `/dashboard/${leadId}`;
    }, 2000);
    return () => clearTimeout(timer);
  }, [planReady, leadId]);

  // Recarrega ao voltar do background (iOS Safari restaura sessão stale)
  useEffect(() => {
    let hiddenAt: number | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 60_000) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (showPostPayment) {
    if (planReady) {
      return (
        <div style={{ minHeight: "100vh", background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: V.night, margin: "0 0 8px" }}>Achei o que precisava.</h2>
            <p style={{ fontSize: 14, color: V.ash, margin: 0 }}>Abrindo seu painel agora...</p>
          </div>
        </div>
      );
    }
    return (
      <div style={{ minHeight: "100vh", background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{
            background: "rgba(207,133,35,0.08)", border: "1px solid rgba(207,133,35,0.2)",
            borderRadius: 12, padding: "16px 20px", marginBottom: 20,
            fontSize: 14, color: V.amber, fontWeight: 600, lineHeight: 1.5,
          }}>
            ✓ Recebi. Estou montando seu plano agora.
          </div>
          <p style={{ fontSize: 13, color: V.zinc, margin: "0 0 16px", lineHeight: 1.6 }}>
            Itens estruturantes, relatório do seu mercado e posts prontos em até 15 minutos.
          </p>
          <div style={{
            width: 28, height: 28, border: `3px solid ${V.fog}`,
            borderTopColor: V.amber, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const shortRegion = region.split(",")[0].trim();

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: V.night, display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="11" cy="14" rx="7" ry="5" fill="#3D2B1A"/>
              <ellipse cx="13" cy="15" rx="4" ry="3.5" fill="#CF8523"/>
              <ellipse cx="8" cy="10" rx="4" ry="3.5" fill="#3D2B1A"/>
              <polygon points="4,10 6,9 6,11" fill="#3D2B1A"/>
              <circle cx="7" cy="9.5" r="1.2" stroke="#CF8523" strokeWidth="0.8" fill="none"/>
              <circle cx="9.8" cy="9.5" r="1.2" stroke="#CF8523" strokeWidth="0.8" fill="none"/>
              <line x1="8.2" y1="9.5" x2="8.6" y2="9.5" stroke="#CF8523" strokeWidth="0.8"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: V.night, margin: "0 0 4px" }}>
            {product} · {shortRegion}
          </h1>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>
            Seu diagnóstico de visibilidade
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: "10px 6px", borderRadius: 8, border: "none", cursor: "pointer",
              background: tab === t.key ? V.night : V.white,
              color: tab === t.key ? V.white : V.zinc,
              fontSize: 12, fontWeight: 500, transition: "all 0.15s",
            }}>
              {t.label}
              {t.locked && <span style={{ fontSize: 9, marginLeft: 2 }}>🔒</span>}
            </button>
          ))}
        </div>

        {/* Tab: Diagnóstico inicial */}
        {tab === "resultado" && (
          <InstantValueScreen
            product={product}
            region={region}
            results={results}
            onCheckout={() => {}}
            leadId={leadId}
            hideCTA
            hideWorkRoutes
          />
        )}

        {/* Tab: Diagnóstico (locked) */}
        {tab === "diagnostico" && (
          <LockedTab
            lockLevel={1}
            ctaLabel="Desbloquear por R$497"
            ctaUrl="#"
            leadId={leadId}
          />
        )}

        {/* Tab: Checklist (locked) */}
        {tab === "checklist" && (
          <LockedTab
            lockLevel={1}
            ctaLabel="Desbloquear por R$497"
            ctaUrl="#"
            leadId={leadId}
          />
        )}

        {/* Tab: Conteúdos (locked) */}
        {tab === "conteudos" && (
          <LockedTab
            lockLevel={2}
            ctaLabel="Assinar por R$99/mês"
            ctaUrl="#"
            leadId={leadId}
          />
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 32, marginTop: 24, borderTop: `1px solid ${V.fog}` }}>
          <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, marginTop: 2 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
