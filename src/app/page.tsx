"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";
import { NelsonLogo } from "@/components/NelsonLogo";
import { V } from "@/lib/design-tokens";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 10,
  border: `1px solid ${V.fog}`, fontSize: 15, fontFamily: V.body,
  color: V.night, background: V.cloud, outline: "none",
  transition: "border-color 0.15s",
};

// ─── Field component ───────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: V.ash, margin: "-2px 0 8px", lineHeight: 1.4 }}>{hint}</p>}
      {children}
    </div>
  );
}

// ─── Places Autocomplete — input simples + proxy API REST ─────────────
function PlacesAutocomplete({ value, onChange, onPlaceSelected, placeholder }: {
  value: string; onChange: (val: string) => void;
  onPlaceSelected: (place: { address: string; placeId: string; lat: number; lng: number }) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<{ description: string; place_id: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sessionToken] = useState(() => Math.random().toString(36).slice(2));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(text: string) {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `/api/places-autocomplete?input=${encodeURIComponent(text)}&sessiontoken=${sessionToken}`;
        const res = await fetch(url);
        const data = await res.json();
        console.log(`[Places] input="${text}", status=${res.status}, predictions=${data.predictions?.length ?? 0}`, data.error || "");
        setSuggestions(data.predictions || []);
        setShowDropdown((data.predictions || []).length > 0);
      } catch (err) {
        console.error("[Places] fetch failed:", err);
        setSuggestions([]);
      }
    }, 300);
  }

  async function handleSelect(prediction: { description: string; place_id: string }) {
    onChange(prediction.description);
    setShowDropdown(false);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/places-details?place_id=${encodeURIComponent(prediction.place_id)}&sessiontoken=${sessionToken}`);
      const data = await res.json();
      if (data.lat && data.lng) {
        onPlaceSelected({
          address: data.address || prediction.description,
          placeId: data.placeId || prediction.place_id,
          lat: data.lat,
          lng: data.lng,
        });
      }
    } catch (err) {
      console.error("[PlacesAutocomplete] Details fetch failed:", err);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: V.white, border: `1px solid ${V.fog}`, borderRadius: 10,
          marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden",
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s.place_id}
              onClick={() => handleSelect(s)}
              style={{
                padding: "12px 16px", fontSize: 13, color: V.night, cursor: "pointer",
                borderBottom: i < suggestions.length - 1 ? `1px solid ${V.fog}` : "none",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = V.cloud)}
              onMouseLeave={(e) => (e.currentTarget.style.background = V.white)}
            >
              {s.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────
function Section({ bg = V.white, children, id }: { bg?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={{ background: bg, padding: "64px 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.amber, marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
export default function Home() {
  const t = dictionaries.pt;
  const formRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<"landing" | "processing" | "value">("landing");
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState<LeadFormData>(initialFormData);
  const [results, setResults] = useState<any>(null);
  const [leadId, setLeadId] = useState("");
  const [heroVisible, setHeroVisible] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isNational, setIsNational] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  const updateField = (key: keyof LeadFormData, val: any) => setFormData((d: any) => ({ ...d, [key]: val }));

  const [apiDone, setApiDone] = useState(false);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    if (apiDone && animDone && results) {
      setScreen("value");
      // Update URL so user can bookmark/return to this result
      if (leadId) {
        window.history.replaceState({}, "", `/resultado/${leadId}`);
      }
    }
  }, [apiDone, animDone, results, leadId]);

  const handleSubmit = useCallback(async () => {
    if (honeypot) return;

    setScreen("processing");
    setApiDone(false);
    setAnimDone(false);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        setLeadId(data.lead_id);
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setApiDone(true);
    }
  }, [formData, honeypot]);

  const handleCheckout = useCallback(async (coupon?: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          email: formData.email,
          locale: formData.locale,
          coupon,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setCheckoutLoading(false);
    }
  }, [leadId, formData]);

  const handlePlaceSelected = useCallback((place: { address: string; placeId: string; lat: number; lng: number }) => {
    setFormData((d: any) => ({
      ...d,
      address: place.address,
      region: place.address,
      placeId: place.placeId,
      lat: place.lat,
      lng: place.lng,
    }));
  }, []);

  // ─── Screen routing ──────────────────────────────────────────────
  if (screen === "processing") {
    return (
      <ProcessingScreen
        product={formData.product}
        region={formData.region}
        businessName={formData.businessName}
        onComplete={() => setAnimDone(true)}
      />
    );
  }
  if (screen === "value" && results) {
    return (
      <InstantValueScreen
        product={formData.product}
        region={formData.region}
        results={results}
        onCheckout={handleCheckout}
        loading={checkoutLoading}
        leadId={leadId}
        name={formData.businessName}
      />
    );
  }

  // ─── Form steps ──────────────────────────────────────────────────
  const totalSteps = 2;

  const formSteps: Record<number, { title: string; content: React.ReactNode }> = {
    1: {
      title: t.formStep1Title,
      content: (
        <>
          <Field label="Nome do seu negócio *">
            <input style={inputStyle} type="text" placeholder="Ex: Salão da Ana, Restaurante do João" value={formData.businessName}
              onChange={(e: any) => updateField("businessName", e.target.value)} />
          </Field>
          <Field label={t.formProductLabel}>
            <input style={inputStyle} type="text"
              placeholder="Seu serviço principal — ex: barbearia masculina, clínica de estética, pizzaria artesanal"
              value={formData.product}
              onChange={(e: any) => updateField("product", e.target.value)} />
            <p style={{ fontSize: 11, color: V.ash, margin: "6px 0 0", lineHeight: 1.4 }}>
              Quanto mais específico, mais preciso seu diagnóstico.
            </p>
          </Field>

          <Field label={t.formRegionLabel} hint={isNational ? t.formRegionNationalHint : t.formRegionHint}>
            {isNational ? (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: V.cloud, fontSize: 13, color: V.zinc }}>
                {t.formNationalMsg}
              </div>
            ) : (
              <PlacesAutocomplete
                value={formData.region}
                onChange={(val) => updateField("region", val)}
                onPlaceSelected={handlePlaceSelected}
                placeholder={t.formRegionPlaceholder}
              />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: V.ash, cursor: "pointer" }}>
              <input type="checkbox" checked={isNational} onChange={(e: any) => {
                setIsNational(e.target.checked);
                if (e.target.checked) updateField("region", "Brasil (nacional)");
                else updateField("region", "");
              }} style={{ width: 16, height: 16, accentColor: V.amber }} />
              {t.formNationalCheckbox}
            </label>
          </Field>

          {/* Presença digital */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 4 }}>Sua presença digital</div>
            <p style={{ fontSize: 12, color: V.ash, margin: "0 0 16px", lineHeight: 1.4 }}>
              Não obrigatório — mas quanto mais você compartilhar, mais personalizado fica seu diagnóstico.
            </p>
            <Field label="Instagram">
              <input style={inputStyle} type="text" placeholder="@seunegocio" value={formData.instagram}
                onChange={(e: any) => updateField("instagram", e.target.value)} />
            </Field>
            <Field label="Site do seu negócio">
              <input style={inputStyle} type="text" placeholder="www.seunegocio.com.br" value={formData.site}
                onChange={(e: any) => updateField("site", e.target.value)} />
            </Field>
            <Field label="LinkedIn">
              <input style={inputStyle} type="text" placeholder="linkedin.com/company/seunegocio" value={(formData as any).linkedin || ""}
                onChange={(e: any) => updateField("linkedin" as any, e.target.value)} />
            </Field>
          </div>
        </>
      ),
    },
    2: {
      title: t.formStep2Title,
      content: (
        <>
          <p style={{ fontSize: 13, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>{t.formStep2Subtitle}</p>
          <Field label={`${t.formEmailLabel} *`} hint="Enviamos seu resultado por aqui">
            <input style={inputStyle} type="email" placeholder={t.formEmailPlaceholder} value={formData.email}
              onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label={t.formWhatsappLabel} hint="Opcional — para contato sobre seu diagnóstico">
            <input style={inputStyle} type="tel" placeholder={t.formWhatsappPlaceholder} value={formData.whatsapp}
              onChange={(e: any) => updateField("whatsapp", e.target.value)} />
          </Field>
        </>
      ),
    },
  };

  const currentStep = formSteps[formStep];
  const isStepValid = (stepValidation as any)[`step${formStep}`]?.(formData);

  return (
    <div style={{ minHeight: "100vh", background: V.white }}>

      {/* ═══ SECTION 1 — HERO + FORM ═══ */}
      <div style={{
        background: V.night, padding: "60px 24px 48px", textAlign: "center",
        opacity: heroVisible ? 1 : 0, transition: "opacity 0.6s ease",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, marginBottom: 24 }}>
            <img src="/favicon.svg" height={40} alt="Nelson" style={{ display: "block" }} />
            <span style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.white }}>virô</span>
          </div>
          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "24px 0 16px", lineHeight: 1.2,
          }}>
            Seu próximo cliente já está <span style={{ color: V.amber }}>procurando o que você faz</span>.
          </h1>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.6, margin: 0 }}>
            Com a Virô você vê quantos são e o que fazer para ser a escolha óbvia — em 60 segundos, grátis.
          </p>
        </div>
      </div>

      {/* ═══ FORM CARD ═══ */}
      <div ref={formRef} style={{ maxWidth: 480, margin: "-24px auto 0", padding: "0 20px 0" }}>
        <div style={{
          background: V.white, borderRadius: 16, border: `1px solid ${V.fog}`,
          padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        }}>
          {/* Progress */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: s <= formStep ? V.amber : V.fog,
                transition: "background 0.3s",
              }} />
            ))}
          </div>

          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            {t.formStepOf(formStep, totalSteps)}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: V.night, marginBottom: 24 }}>
            {currentStep.title}
          </div>

          <div key={formStep}>{currentStep.content}</div>

          {/* Honeypot */}
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden="true">
            <input
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e: any) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
            {formStep > 1 ? (
              <button onClick={() => setFormStep(formStep - 1)} style={{
                background: "none", border: "none", color: V.ash, fontSize: 14, cursor: "pointer", padding: "10px 16px",
              }}>{t.formBack}</button>
            ) : <div />}
            <button
              onClick={() => {
                if (formStep < totalSteps) {
                  setFormStep(formStep + 1);
                  setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                } else {
                  handleSubmit();
                }
              }}
              disabled={!isStepValid}
              style={{
                background: formStep === totalSteps ? V.amber : V.white,
                color: formStep === totalSteps ? V.white : V.night,
                border: formStep === totalSteps ? "none" : `2px solid ${V.night}`,
                padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: isStepValid ? "pointer" : "not-allowed",
                opacity: isStepValid ? 1 : 0.4, transition: "all 0.15s",
              }}
            >
              {formStep === totalSteps ? t.formSubmit : t.formNext}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SECTION 2 — MOCKUP ESTÁTICO DO RESULTADO ═══ */}
      <Section bg={V.white}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.25 }}>
            O que você vai ver no seu diagnóstico
          </h2>
          <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: 0 }}>
            Sua visibilidade, sua concorrência e onde está a oportunidade.
          </p>
        </div>

        {/* Mockup container */}
        <div style={{
          border: `1px solid ${V.fog}`, borderRadius: 16, overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)", position: "relative",
        }}>
          {/* Mockup label */}
          <div style={{ background: V.cloud, padding: "10px 18px", borderBottom: `1px solid ${V.fog}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash }}>
              EXEMPLO DE RESULTADO
            </span>
          </div>

          <div style={{ padding: "20px 18px 0" }}>
            {/* Mockup header */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: V.ash }}>Clínica de estética · Av. Paulista, São Paulo</span>
            </div>

            {/* BLOCO 1 — Oportunidade */}
            <div style={{ background: "#0A0A0C", borderRadius: 14, padding: "24px 18px",
              marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: "#6E6E78", letterSpacing: "0.08em", textTransform: "uppercase" as const,
                marginBottom: 14 }}>
                Oportunidade identificada
              </div>
              <div style={{ fontSize: 56, fontWeight: 900, color: "#2D9B83", lineHeight: 1,
                fontFamily: "'Satoshi', sans-serif", letterSpacing: "-0.03em", marginBottom: 8 }}>
                +4.860
              </div>
              <div style={{ fontSize: 14, color: "#C8C8D0", lineHeight: 1.5,
                maxWidth: 260, margin: "0 auto 14px" }}>
                pessoas a mais por mês conhecendo você<br/>
                <strong style={{ color: "#FEFEFF" }}>sem investimento adicional em mídia</strong>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: "#6E6E78", letterSpacing: "0.04em" }}>
                Raio de 3km · Av. Paulista, São Paulo
              </div>
            </div>

            {/* Contexto rápido */}
            <div style={{ background: "#F5F3EF", borderRadius: 10, padding: "12px 14px",
              marginBottom: 10, border: "1px solid #E8E4DC" }}>
              <p style={{ fontSize: 12, color: "#6E6E78", margin: 0, lineHeight: 1.6,
                textAlign: "center" }}>
                De <strong style={{ color: "#1A1A1C" }}>18.000 pessoas</strong> no seu mercado,
                você disputa hoje por <strong style={{ color: "#1A1A1C" }}>18%</strong> — 3.240 pessoas.
                Com as ações certas, chega a <strong style={{ color: "#2D9B83" }}>45% — 8.100 pessoas</strong>.
              </p>
            </div>

            {/* BLOCO 2 — Por que essa oportunidade existe */}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
              color: "#9E9EA8", letterSpacing: "0.08em", textTransform: "uppercase" as const,
              marginBottom: 8, paddingLeft: 2, marginTop: 4 }}>
              Por que essa oportunidade existe
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "12px 14px",
              border: "1px solid #E8E4DC", marginBottom: 6,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6E6E78" }}>🏙️ Mercado no raio</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1C" }}>~18 mil pessoas</span>
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "12px 14px",
              border: "1px solid #E8E4DC", marginBottom: 6,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6E6E78" }}>🔍 Demanda ativa</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1C" }}>3.200 buscas/mês</span>
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "12px 14px",
              border: "1px solid #E8E4DC", marginBottom: 6,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6E6E78" }}>🏪 Concorrência</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#CF8523" }}>12 negócios</span>
            </div>

            <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "12px 14px",
              border: "1px solid #E8E4DC", marginBottom: 10,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6E6E78" }}>📊 Sua posição</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#2D9B83" }}>18% do mercado</span>
            </div>

            {/* BLOCO 3 — Como aumentar essa posição */}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
              color: "#9E9EA8", letterSpacing: "0.08em", textTransform: "uppercase" as const,
              marginBottom: 8, paddingLeft: 2 }}>
              Como aumentar essa posição
            </div>

            {[
              { icon: "🔍", label: "Seja Encontrável", color: "#2D9B83",
                status: "⚠️ Não encontrado no Google Maps",
                acao: "→ Criar perfil no Google Meu Negócio com fotos, horário e categoria" },
              { icon: "⭐", label: "Construa Credibilidade", color: "#CF8523",
                status: "⚠️ Poucas avaliações — prioridade alta",
                acao: "→ Pedir avaliação para os últimos 20 clientes via WhatsApp esta semana" },
              { icon: "📣", label: "Participe da Cultura", color: "#8B5CF6",
                status: "⚠️ Presença digital parada",
                acao: "→ 2 posts/semana respondendo perguntas reais que clientes fazem" },
            ].map((pilar, i) => (
              <div key={i} style={{ background: "#FFFFFF", borderRadius: 10,
                padding: "10px 14px", border: "1px solid #E8E4DC",
                marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1C" }}>
                    {pilar.icon} {pilar.label}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, color: "#FFFFFF", background: "#CF8523",
                    padding: "2px 7px", borderRadius: 100, fontWeight: 600 }}>
                    No plano
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#CF8523", fontWeight: 500 }}>
                  {pilar.status}
                </div>
                <div style={{ fontSize: 11, color: "#4A4A52", marginTop: 6,
                  paddingTop: 6, borderTop: "1px solid #E8E4DC" }}>
                  {pilar.acao}
                </div>
              </div>
            ))}

          </div>

          {/* Content preview */}
          <div style={{ padding: "14px 18px 0" }}>
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 10px" }}>
              Exemplo de conteúdo — Construa Credibilidade
            </p>
            <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, overflow: "hidden" }}>

              {/* Channel badge */}
              <div style={{ padding: "12px 14px 0" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
                  borderRadius: 100, background: "rgba(225,48,108,0.08)", fontSize: 11,
                  fontWeight: 500, color: "#E1306C", marginBottom: 10 }}>
                  📸 Instagram Feed
                </div>
              </div>

              {/* Card tipográfico editorial */}
              <div style={{ margin: "0 14px", borderRadius: 12, overflow: "hidden",
                aspectRatio: "1/1", position: "relative",
                background: "linear-gradient(160deg, #1A1A1A 0%, #2D1A0E 100%)" }}>

                {/* Faixa de acento superior */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: "linear-gradient(90deg, #FF3366, #FF6B35)",
                }} />

                {/* Logo + nome */}
                <div style={{
                  position: "absolute", top: 18, left: 20,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "#FF3366",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#FEFEFF",
                      fontFamily: "'Satoshi', sans-serif" }}>E</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#FEFEFF",
                      letterSpacing: "0.1em", textTransform: "uppercase" as const,
                      fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                      ESTÉTICA PAULISTA
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)",
                      fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      Av. Paulista, 1.200 · SP
                    </div>
                  </div>
                </div>

                {/* Métrica central */}
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -60%)",
                  textAlign: "center", width: "80%",
                }}>
                  <div style={{
                    fontSize: 72, fontWeight: 900, color: "#FEFEFF",
                    lineHeight: 1, letterSpacing: "-0.04em",
                    fontFamily: "'Satoshi', sans-serif",
                  }}>
                    88
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    letterSpacing: "0.12em", textTransform: "uppercase" as const,
                    fontFamily: "'JetBrains Mono', monospace", marginTop: 6,
                  }}>
                    AVALIAÇÕES NO GOOGLE
                  </div>
                  <div style={{
                    width: 32, height: 2,
                    background: "linear-gradient(90deg, #FF3366, #FF6B35)",
                    borderRadius: 1, margin: "12px auto 0",
                  }} />
                </div>

                {/* Linha de rodapé */}
                <div style={{
                  position: "absolute", bottom: 20, left: 20, right: 20,
                }}>
                  <p style={{
                    fontSize: 13, fontWeight: 700, color: "#FEFEFF",
                    lineHeight: 1.3, margin: "0 0 10px",
                    letterSpacing: "-0.01em", fontFamily: "'Satoshi', sans-serif",
                  }}>
                    88 clientes avaliaram. Média 4.9★.
                    Obrigada pela confiança.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%",
                      background: "#FF3366", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                      AV. PAULISTA · SÃO PAULO
                    </span>
                  </div>
                </div>

              </div>

              {/* Legenda */}
              <div style={{ padding: "12px 14px 0" }}>
                <p style={{ fontSize: 12, color: V.zinc, lineHeight: 1.7, margin: "0 0 8px" }}>
                  Cada avaliação é uma porta aberta para quem ainda não te conhece. 88 clientes disseram que valeu. O próximo pode ser você. ⭐
                </p>
              </div>

              {/* Hashtags */}
              <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["#estéticapaulista", "#googlereviews", "#clientessatisfeitos", "#SãoPaulo"].map((tag) => (
                  <span key={tag} style={{ fontSize: 10, color: V.teal, background: V.tealWash,
                    padding: "2px 8px", borderRadius: 6 }}>{tag}</span>
                ))}
              </div>

              {/* Meta: dica estratégica */}
              <div style={{ margin: "0 14px 14px", padding: "10px 12px",
                background: V.cloud, borderRadius: 8,
                borderLeft: `3px solid ${V.amber}` }}>
                <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: V.night }}>Por que este conteúdo:</strong> transforma suas avaliações do Google em prova social no Instagram — quem busca vê nos dois lugares.
                </p>
              </div>

              {/* Footer */}
              <div style={{ padding: "0 14px 12px", display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash,
                  background: V.cloud, padding: "3px 8px", borderRadius: 6 }}>
                  Gerado pela Virô
                </span>
              </div>

            </div>
          </div>

          {/* Blur fade at bottom */}
          <div style={{
            height: 32,
            background: "linear-gradient(to bottom, rgba(254,254,255,0) 0%, rgba(254,254,255,1) 100%)",
          }} />
        </div>
      </Section>

      {/* ═══ SECTION 3 — COMO FUNCIONA ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>como funciona</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 32px", lineHeight: 1.25 }}>
          Como funciona
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "📋", title: "Você informa seu negócio", text: "Nome, segmento e endereço. Leva menos de 1 minuto." },
            { icon: "🔍", title: "Virô analisa seu mercado em tempo real", text: "Cruzamos Google, Maps, Instagram, IA e IBGE para mapear sua posição, seus concorrentes e sua oportunidade." },
            { icon: "📊", title: "Você recebe o diagnóstico grátis", text: "Quantos clientes você pode ter a mais por mês, quem disputa com você e o que está te impedindo de crescer." },
            { icon: "📝", title: "Gere seu plano de ação — R$497", text: "Passo a passo do que fazer em cada pilar: ser encontrável, construir credibilidade e participar da cultura do seu mercado." },
            { icon: "🔄", title: "Mantenha-se relevante toda semana — R$99/mês", text: "Insights do seu mercado + conteúdos prontos toda sexta. Sem ação contínua, a tendência é entropia." },
          ].map((step, i) => (
            <div key={i} style={{ background: V.white, borderRadius: 14, padding: "20px 20px", border: `1px solid ${V.fog}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 700, color: i < 3 ? V.amber : V.teal, background: i < 3 ? V.amberWash : V.tealWash, width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 4 }}>{step.title}</div>
                <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ SECTION — É PARA MIM? ═══ */}
      <Section bg={V.white}>
        <SectionLabel>é para mim?</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Feito para negócios locais
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 12px" }}>
          Lojas, clínicas, escolas, restaurantes, estúdios, consultórios e prestadores de serviço. Com ou sem presença digital hoje.
        </p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
          Se você quer saber quantos clientes estão te ignorando por falta de visibilidade — e o que fazer para mudar isso sem gastar mais em mídia — a Virô é para você.
        </p>
      </Section>

      {/* ═══ SECTION 4 — MAPA COMPLETO ═══ */}
      <Section bg={V.white}>
        <SectionLabel>o que você vai receber</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 32px", lineHeight: 1.25 }}>
          Seu mapa completo para capturar mais clientes
        </h2>

        {/* Bloco 1 — Grátis */}
        <p style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.teal, fontWeight: 600, margin: "0 0 10px" }}>
          Grátis · 60 segundos
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {[
            { title: "Oportunidade", desc: "Quantos clientes a mais você pode ter por mês sem mídia paga" },
            { title: "Seus números", desc: "Mercado no raio, demanda ativa, concorrência e sua posição atual" },
            { title: "Como crescer", desc: "Os 3 pilares que determinam sua posição competitiva" },
            { title: "Primeiros passos", desc: "Uma ação concreta baseada no seu maior gap" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${V.teal}30`, background: V.cloud, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 2 }}>{item.title}</div>
                <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
              </div>
              <span style={{ fontFamily: V.mono, fontSize: 9, color: V.teal, background: `${V.teal}12`, padding: "3px 8px", borderRadius: 100, fontWeight: 600, flexShrink: 0 }}>Grátis</span>
            </div>
          ))}
        </div>

        {/* Bloco 2 — R$497 */}
        <p style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.amber, fontWeight: 600, margin: "0 0 10px" }}>
          R$497 · Pagamento único
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {[
            { title: "Seja Encontrável", desc: "Maps otimizado, SEO local, visibilidade em IA — passo a passo para aparecer quando buscam" },
            { title: "Construa Credibilidade", desc: "Reviews, fotos, bio, proposta de valor — o que convence quem te encontra" },
            { title: "Participe da Cultura", desc: "Conteúdo real, parceiros que indexam bem em IA, menções no setor" },
            { title: "Relatório setorial", desc: "Tendências reais do seu mercado esta semana" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "14px 16px", borderRadius: 12, border: `2px solid ${V.amber}`, background: V.white, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 2 }}>{item.title}</div>
                <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
              </div>
              <span style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, background: V.amberWash, padding: "3px 8px", borderRadius: 100, fontWeight: 600, flexShrink: 0 }}>R$497</span>
            </div>
          ))}
        </div>

        {/* Bloco 3 — R$99/mês */}
        <p style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#8B5CF6", fontWeight: 600, margin: "0 0 10px" }}>
          R$99/mês · Recorrência
        </p>
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "2px solid #8B5CF6", background: V.white, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 2 }}>
              4 conteúdos semanais prontos para publicar
            </div>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.5, margin: "0 0 4px" }}>
              + 3 briefings completos para agência ou produtora
            </p>
            <p style={{ fontSize: 11, color: V.ash, margin: 0, fontFamily: V.mono }}>
              Disponível após o Plano de Ação · Cancele quando quiser · sem multa
            </p>
          </div>
          <span style={{ fontFamily: V.mono, fontSize: 9, color: "#8B5CF6", background: "rgba(139,92,246,0.08)", padding: "3px 8px", borderRadius: 100, fontWeight: 600, flexShrink: 0 }}>R$99/mês</span>
        </div>
      </Section>

      {/* ═══ SECTION 6 — METODOLOGIA E FONTES ═══ */}
      <Section bg={V.white}>
        <SectionLabel>metodologia</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Dados reais do seu mercado
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 28px" }}>
          A Virô cruza 9 fontes em tempo real para montar a leitura do seu mercado local. Tudo coletado no momento da análise.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {[
            "Google Search", "Google Maps", "Google Ads",
            "Instagram", "Perplexity AI", "DataForSEO",
            "IBGE", "PNCP", "Claude AI",
          ].map((source, i) => (
            <span key={i} style={{
              fontFamily: V.mono, fontSize: 11, letterSpacing: "0.02em",
              color: V.teal, background: V.tealWash, padding: "6px 12px", borderRadius: 8, fontWeight: 500,
            }}>
              {source}
            </span>
          ))}
        </div>
        <div style={{ background: V.cloud, borderRadius: 12, padding: "20px", border: `1px solid ${V.fog}` }}>
          <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: V.night }}>Medimos 3 pilares:</strong>{" "}
            Seja Encontrável (aparece quando buscam — Google, Maps, IA), Construa Credibilidade (convence quem encontra — reviews, fotos, site) e Participe da Cultura (mantém relevância — conteúdo, menções, alcance). Tudo relativizado contra seus concorrentes reais no raio.
          </p>
        </div>
      </Section>

      {/* ═══ SECTION 7 — FAQ ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>perguntas frequentes</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 24px", lineHeight: 1.25 }}>
          Perguntas comuns
        </h2>
        {[
          { q: "O diagnóstico gratuito usa dados reais do meu negócio?", a: "Sim. Virô coleta dados do Google Maps, Instagram, volume de buscas locais e dados de população do IBGE em tempo real. Não inventamos nada." },
          { q: "O que eu recebo com o Plano de Ação?", a: "O básico bem feito priorizado pelos seus gaps reais, um relatório setorial do seu mercado com dados atuais, e posts prontos para publicar esta semana. Tudo gerado especificamente para o seu negócio." },
          { q: "Em quanto tempo fico com o plano pronto?", a: "O diagnóstico gratuito sai em até 2 minutos. O plano de ação completo fica pronto em até 15 minutos após o pagamento." },
          { q: "E a assinatura mensal — o que inclui?", a: "Atualização semanal do seu mercado toda sexta-feira: novo relatório setorial e novos posts conectados ao contexto da semana. Você pode cancelar quando quiser, direto pelo painel." },
          { q: "Funciona para qualquer tipo de negócio?", a: "Para negócios locais com presença física ou área de atuação definida. Restaurantes, clínicas, academias, escolas, salões, lojas, escritórios de serviço — se você atende pessoas numa região, Virô funciona para você." },
          { q: "E se meu negócio não aparecer no Google Maps?", a: "O diagnóstico ainda funciona — analisamos a demanda do seu mercado e a concorrência do seu raio mesmo sem o seu perfil. O plano vai indicar exatamente o que fazer para aparecer." },
        ].map((faq, i) => (
          <FAQItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: V.night, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.white, letterSpacing: "-0.02em" }}>
            Virô
          </span>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
            <a href="/privacidade" style={{ fontSize: 13, color: V.ash, textDecoration: "none" }}>
              Política de Privacidade
            </a>
            <a href="/termos" style={{ fontSize: 13, color: V.ash, textDecoration: "none" }}>
              Termos de Serviço
            </a>
          </div>
          <p style={{ fontSize: 12, color: V.slate, marginTop: 16 }}>
            © {new Date().getFullYear()} Virô. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── FAQ Accordion Item ─────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${V.fog}`, marginBottom: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: V.night, flex: 1, paddingRight: 16 }}>{question}</span>
        <span style={{ fontSize: 18, color: V.ash, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}>
          ▾
        </span>
      </button>
      {open && (
        <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7, margin: "0 0 16px", paddingRight: 32 }}>
          {answer}
        </p>
      )}
    </div>
  );
}
