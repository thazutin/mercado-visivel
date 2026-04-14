// File: src/app/resultado/[leadId]/ResultadoClient.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InstantValueScreen from "@/components/InstantValueScreen";
import PostPaymentScreen from "@/components/PostPaymentScreen";
import { NelsonLogo } from "@/components/NelsonLogo";
import { V } from "@/lib/design-tokens";

// Tabs removidas — resultado free é página única com CTA do Radar integrado

interface Props {
  product: string;
  region: string;
  leadId: string;
  results: any;
  name?: string;
}

export default function ResultadoClient({ product, region, leadId, results, name }: Props) {
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

  // Poll para saber quando o plano ficou pronto (a cada 3s)
  useEffect(() => {
    if (!showPostPayment) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        const data = await res.json();
        if (data.planReady || data.plan_status === "ready" || data.status === "done") {
          setPlanReady(true);
          clearInterval(poll);
        }
      } catch { /* ignora */ }
    }, 3_000);
    // NUNCA voltar para tela grátis após pagamento — redirecionar para dashboard
    const timeout = setTimeout(() => {
      clearInterval(poll);
      // Redireciona para dashboard mesmo sem plano pronto — dashboard tem seu próprio polling
      window.location.href = `/dashboard/${leadId}`;
    }, 5 * 60_000);
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

  const shortRegion = region.split(",")[0].trim();

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
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ marginBottom: 24 }}>
            <NelsonLogo size={48} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: V.night, margin: "0 0 8px" }}>
            Pagamento confirmado
          </h2>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 24px", lineHeight: 1.6 }}>
            Estamos montando o plano de ação completo da{" "}
            <strong style={{ color: V.night }}>{name || product}</strong>
            {shortRegion ? <> em <strong style={{ color: V.night }}>{shortRegion}</strong></> : null}.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: V.white, borderRadius: 8, border: `1px solid ${V.fog}` }}>
              <div style={{
                width: 16, height: 16, border: `2px solid ${V.fog}`,
                borderTopColor: V.amber, borderRadius: "50%",
                animation: "spin 0.8s linear infinite", flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: V.night, fontWeight: 500 }}>Plano de ação</span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.6 }}>
            Leva 2-3 minutos. Você será redirecionado automaticamente.
            <br />Também enviamos o link por email.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "40px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Diagnóstico + CTA Radar integrado (sem tabs) — header está dentro do InstantValueScreen */}
        <InstantValueScreen
          product={product}
          region={region}
          results={results}
          onCheckout={async (coupon) => {
            try {
              const res = await fetch('/api/checkout/subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, coupon }),
              });
              const data = await res.json();
              if (data.url) window.location.href = data.url;
            } catch { /* ignore */ }
          }}
          leadId={leadId}
          name={name}
        />

        {/* Footer está dentro do InstantValueScreen */}
      </div>
    </div>
  );
}
