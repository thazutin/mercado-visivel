// File: src/app/resultado/[leadId]/ResultadoClient.tsx
"use client";

import { useState, useCallback } from "react";
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

  const handleCheckout = useCallback(async (coupon?: string) => {
    if (isPaid) {
      window.location.href = `/dashboard/${leadId}`;
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
