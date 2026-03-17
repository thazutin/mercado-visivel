// File: src/app/resultado/[leadId]/ResultadoClient.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InstantValueScreen from "@/components/InstantValueScreen";
import PostPaymentScreen from "@/components/PostPaymentScreen";

interface Props {
  product: string;
  region: string;
  leadId: string;
  results: any;
  isPaid: boolean;
}

export default function ResultadoClient({ product, region, leadId, results, isPaid }: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPostPayment, setShowPostPayment] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  // Detecta retorno do Stripe com ?paid=true
  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      setShowPostPayment(true);
      // Remove ?paid=true da URL sem recarregar
      router.replace(`/resultado/${leadId}`, { scroll: false });
    }
  }, [searchParams, leadId, router]);

  // Quando na tela pós-pagamento, poll para saber quando o plano ficou pronto
  useEffect(() => {
    if (!showPostPayment) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        const data = await res.json();
        // Checa se o plano já foi gerado (lead.plan_status === "ready")
        if (data.planReady || data.plan_status === "ready") {
          setPlanReady(true);
          clearInterval(poll);
        }
      } catch {
        // ignora erros de polling
      }
    }, 10_000); // Poll a cada 10s

    // Timeout: após 5 min, redireciona mesmo assim
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setShowPostPayment(false);
    }, 5 * 60_000);

    return () => { clearInterval(poll); clearTimeout(timeout); };
  }, [showPostPayment, leadId]);

  // Quando plano fica pronto, aguarda 2s e sai da tela de loading
  useEffect(() => {
    if (!planReady) return;
    const timer = setTimeout(() => {
      setShowPostPayment(false);
      // Recarrega a página para pegar dados atualizados
      window.location.reload();
    }, 2000);
    return () => clearTimeout(timer);
  }, [planReady]);

  const handleCheckout = useCallback(async (coupon?: string) => {
    if (isPaid) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, locale: "pt", coupon }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckoutLoading(false);
    }
  }, [leadId, isPaid]);

  // Tela pós-pagamento fullscreen
  if (showPostPayment) {
    return <PostPaymentScreen product={product} region={region} />;
  }

  return (
    <InstantValueScreen
      product={product}
      region={region}
      results={results}
      onCheckout={handleCheckout}
      loading={checkoutLoading}
      leadId={leadId}
    />
  );
}
