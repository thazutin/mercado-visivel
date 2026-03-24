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
  { key: "checklist", label: "Plano de Ação", locked: 1 },
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

  if (showPostPayment) {
    return <PostPaymentScreen product={product} region={region} />;
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
            <span style={{ fontWeight: 700, fontSize: 18, color: V.white }}>V</span>
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
