// File: src/app/resultado/[leadId]/ResultadoClient.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InstantValueScreen from "@/components/InstantValueScreen";

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
  const [showPaidBanner, setShowPaidBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      setShowPaidBanner(true);
      const timer = setTimeout(() => {
        router.replace(`/resultado/${leadId}`, { scroll: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, leadId, router]);

  const handleCheckout = useCallback(async (coupon?: string) => {
    if (isPaid) {
      // Já pagou — rola até o conteúdo completo na própria página pública
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

  return (
    <>
      {showPaidBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          background: "#2D9B83", color: "#FEFEFF", textAlign: "center",
          padding: "14px 20px", fontSize: 14, fontWeight: 600,
          fontFamily: "'Satoshi', 'General Sans', -apple-system, sans-serif",
        }}>
          ✓ Pagamento confirmado — seu diagnóstico completo está sendo preparado.
        </div>
      )}
      <InstantValueScreen
        product={product}
        region={region}
        results={results}
        onCheckout={handleCheckout}
        loading={checkoutLoading}
        leadId={leadId}
      />
    </>
  );
}
