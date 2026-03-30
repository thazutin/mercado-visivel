"use client";

import { useState, useEffect } from "react";
import { NelsonLogo } from "@/components/NelsonLogo";

const steps = [
  "Google Maps",
  "Instagram",
  "Volume de buscas",
  "Concorrência",
];

export default function PollingScreen({ leadId, product, region }: { leadId: string; product: string; region: string }) {
  const [completedSteps, setCompletedSteps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Visual step progression (every 8s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCompletedSteps(prev => Math.min(prev + 1, steps.length));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Poll for diagnosis readiness
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch(`/api/diagnose?leadId=${leadId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "done" || data.diagnosis_display) {
            clearInterval(interval);
            window.location.reload();
          }
        }
      } catch { /* ignore */ }
    };

    check();
    interval = setInterval(check, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setError("Está demorando mais que o esperado. Recarregue a página.");
    }, 300_000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [leadId]);

  const shortRegion = region.split(",")[0].trim();

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
          <NelsonLogo size={56} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#161618", margin: "0 0 8px" }}>
          Analisando seu mercado...
        </h2>
        <p style={{ fontSize: 13, color: "#888880", margin: "0 0 24px" }}>
          {product} · {shortRegion}
        </p>

        {error ? (
          <div style={{ background: "rgba(217,83,79,0.08)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#D9534F", margin: 0 }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div style={{ height: 4, background: "#E8E4DE", borderRadius: 2, overflow: "hidden", marginBottom: 24 }}>
              <div style={{
                height: "100%", background: "#1D9E75", borderRadius: 2,
                width: `${Math.min((completedSteps / steps.length) * 100, 95)}%`,
                transition: "width 1s ease",
              }} />
            </div>

            {/* Step checklist */}
            <div style={{ textAlign: "left", marginBottom: 24 }}>
              {steps.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, opacity: i <= completedSteps ? 1 : 0.4, transition: "opacity 0.5s ease" }}>
                  <span style={{ fontSize: 14, color: i < completedSteps ? "#1D9E75" : "#888880" }}>
                    {i < completedSteps ? "✓" : "○"}
                  </span>
                  <span style={{ fontSize: 13, color: "#161618" }}>{step}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, color: "#888880", margin: 0 }}>
              Isso leva cerca de 40 segundos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
