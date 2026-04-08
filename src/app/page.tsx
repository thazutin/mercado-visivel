"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";
import { NelsonLogo } from "@/components/NelsonLogo";
import { V, ICONS, PILAR_COLORS } from "@/lib/design-tokens";

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
              <>
                <PlacesAutocomplete
                  value={formData.region}
                  onChange={(val) => {
                    updateField("region", val);
                    // Limpa lat/lng quando o usuário digita manualmente — será
                    // re-setado quando uma sugestão do dropdown for clicada.
                    if ((formData as any).lat || (formData as any).lng) {
                      setFormData((d: any) => ({ ...d, lat: undefined, lng: undefined, placeId: "" }));
                    }
                  }}
                  onPlaceSelected={handlePlaceSelected}
                  placeholder={t.formRegionPlaceholder}
                />
                {formData.region.length >= 2 && !((formData as any).lat && (formData as any).lng) && (
                  <p style={{ fontSize: 11, color: V.amber, margin: "6px 0 0", lineHeight: 1.4 }}>
                    ⚠️ Selecione uma cidade do dropdown do Google para o diagnóstico ficar preciso. Se o seu negócio é nacional (sem cidade específica), marque a opção abaixo.
                  </p>
                )}
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: V.ash, cursor: "pointer" }}>
              <input type="checkbox" checked={isNational} onChange={(e: any) => {
                setIsNational(e.target.checked);
                if (e.target.checked) {
                  updateField("region", "Brasil (nacional)");
                  // Limpa lat/lng pois nacional não tem coordenada
                  setFormData((d: any) => ({ ...d, lat: undefined, lng: undefined, placeId: "" }));
                } else {
                  updateField("region", "");
                }
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
  // Step 1: além das regras do schema, exige cidade do Google Places (lat/lng)
  // OU checkbox Nacional marcado. Sem isso o diagnóstico não consegue calcular
  // população por raio e cai em fallback nacional silencioso.
  const hasValidRegion = isNational || !!((formData as any).lat && (formData as any).lng);
  const baseStepValid = (stepValidation as any)[`step${formStep}`]?.(formData);
  const isStepValid = formStep === 1 ? (baseStepValid && hasValidRegion) : baseStepValid;

  return (
    <div style={{ minHeight: "100vh", background: V.white }}>

      {/* ═══ SECTION 1 — HERO + FORM ═══ */}
      <div style={{
        background: V.night, padding: "60px 24px 48px", textAlign: "center",
        opacity: heroVisible ? 1 : 0, transition: "opacity 0.6s ease",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Estandarte (pennant) — usa o asset completo viro-logo.svg
              que ja tem bird + texto na proporcao correta */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{
              background: V.cloud,
              clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)",
              padding: "36px 48px 80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <img
                src="/viro-logo.svg"
                alt="Virô"
                style={{ display: "block", height: 132, width: "auto" }}
              />
            </div>
          </div>
          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "24px 0 16px", lineHeight: 1.2,
          }}>
            Seu próximo cliente já está <span style={{ color: V.amber }}>procurando o que você faz</span>.
          </h1>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.6, margin: 0 }}>
            Veja quantos são e o que fazer para ser a escolha óbvia — em 60 segundos, grátis.
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

      {/* ═══ SECTION 2 — COMO FUNCIONA ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>como funciona</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 32px", lineHeight: 1.25 }}>
          Como funciona
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { title: "Você informa seu negócio", text: "Nome, segmento e endereço. Leva menos de 1 minuto." },
            { title: "Virô analisa seu mercado em tempo real", text: "Cruzamos Google, Maps, Instagram, IA e IBGE para mapear sua posição, seus concorrentes e sua oportunidade." },
            { title: "Você recebe o diagnóstico grátis", text: "Quantos clientes você pode ter a mais por mês, quem disputa com você e o que está te impedindo de crescer." },
            { title: "Gere seu plano de ação — R$497", text: "15 ações priorizadas com conteúdo pronto para copiar e colar. Na ordem certa para o seu negócio." },
            { title: "Mantenha-se relevante toda semana — R$99/mês", text: "Contexto do mercado + conteúdos prontos toda sexta. Sem ação contínua, a tendência é entropia." },
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

      {/* ═══ SECTION 3 — PARA QUEM É ═══ */}
      <Section bg={V.white}>
        <SectionLabel>é para mim?</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Feito para negócios locais
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 12px" }}>
          Lojas, clínicas, escolas, restaurantes, estúdios, consultórios e prestadores de serviço. Com ou sem presença digital hoje.
        </p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
          Se você quer saber quantos clientes estão te ignorando por falta de visibilidade — e o que fazer para mudar isso sem gastar mais em mídia — Virô é para você.
        </p>
      </Section>

      {/* ═══ SECTION 4 — EXEMPLO REAL ═══ */}
      <Section bg={V.white}>
        <SectionLabel>exemplo real</SectionLabel>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.25 }}>
            O que acontece quando você roda o diagnóstico
          </h2>
          <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: 0 }}>
            Dados reais. Ações concretas. Conteúdo pronto.
          </p>
        </div>

        <div style={{ border: `1px solid ${V.fog}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.06)" }}>
          {/* ─── BLOCO 1: DIAGNÓSTICO ─── */}
          <div style={{ background: V.night, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, letterSpacing: "0.08em", marginBottom: 16 }}>DIAGNÓSTICO GRATUITO · 60 SEGUNDOS · EXEMPLO ILUSTRATIVO</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: V.amber, lineHeight: 1, fontFamily: V.display, marginBottom: 8 }}>+153</div>
            <div style={{ fontSize: 16, color: V.mist, marginBottom: 20 }}>pessoas a mais por mês conhecendo o seu negócio</div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "16px 20px", textAlign: "left" }}>
              <p style={{ fontSize: 13, color: V.mist, lineHeight: 1.7, margin: 0 }}>
                Seu mercado tem <strong style={{ color: V.white }}>2 mil pessoas</strong> no raio de 1km. Hoje você disputa <strong style={{ color: V.white }}>29%</strong> dessa atenção.
                Com as ações certas, pode chegar a <strong style={{ color: V.amber }}>42%</strong> — sem investimento adicional em mídia.
                São <strong style={{ color: V.amber }}>350 buscas por mês</strong> por esse serviço na sua região, com <strong style={{ color: V.white }}>14 concorrentes</strong> disputando.
              </p>
            </div>
          </div>

          {/* ─── BLOCO 2: PLANO DE AÇÃO ─── */}
          <div style={{ padding: "24px", borderTop: `2px solid ${V.amber}` }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", marginBottom: 12 }}>PLANO DE AÇÃO · R$497</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: V.night, marginBottom: 16 }}>15 ações priorizadas com conteúdo pronto — para copiar e colar</div>

            {/* Exemplo de ação COM conteúdo gerado */}
            <div style={{ background: V.cloud, borderRadius: 12, padding: "16px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Responder 88 avaliações do Google</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, background: V.white, padding: "2px 8px", borderRadius: 100 }}>~15 min</span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 10px" }}>0% de resposta vs 85% dos concorrentes — respostas aumentam confiança em 40%.</p>
              <div style={{ background: V.white, borderRadius: 8, padding: "12px", borderLeft: `3px solid ${V.amber}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, marginBottom: 6 }}>CONTEÚDO GERADO</div>
                <p style={{ fontSize: 12, color: V.night, margin: "0 0 4px", lineHeight: 1.5 }}>
                  <strong>★5 — Elogio ao produto:</strong> "Que bom que gostou da nossa margherita especial, João! A massa fermentada por 24h faz toda diferença. Esperamos você de volta!"
                </p>
                <p style={{ fontSize: 12, color: V.night, margin: "0 0 4px", lineHeight: 1.5 }}>
                  <strong>★3 — Feedback construtivo:</strong> "Maria, obrigado pelo retorno. Sentimos muito pela demora na sexta — estávamos com casa cheia. Melhoramos o processo e adoraria que voltasse para conferir."
                </p>
                <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontStyle: "italic" }}>+ 86 respostas personalizadas prontas para copiar</p>
              </div>
            </div>

            {/* Segundo exemplo */}
            <div style={{ background: V.cloud, borderRadius: 12, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: V.night, marginBottom: 8 }}>Criar site simples com cardápio</div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 10px" }}>67% dos clientes pesquisam cardápio online antes de pedir.</p>
              <div style={{ background: V.white, borderRadius: 8, padding: "12px", borderLeft: `3px solid ${V.amber}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, marginBottom: 6 }}>CONTEÚDO GERADO</div>
                <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.5 }}>
                  Estrutura completa: página inicial com headline pronta, seção "Sobre" (200 palavras), cardápio por categorias, SEO local configurado. Plataforma recomendada: Carrd.co (gratuito).
                </p>
              </div>
            </div>
            <p style={{ fontSize: 10, color: V.ash, textAlign: "center", fontFamily: V.mono }}>+ 13 ações adicionais, cada uma com conteúdo pronto para copiar</p>
          </div>

          {/* ─── BLOCO 3: AÇÕES SEMANAIS ─── */}
          <div style={{ padding: "24px", borderTop: `2px solid ${V.slate}`, background: V.cloud }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.slate, letterSpacing: "0.06em", marginBottom: 12 }}>AÇÕES SEMANAIS · R$99/MÊS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: V.night, marginBottom: 12 }}>Toda sexta-feira no seu painel — para copiar e colar</div>

            {/* Preview de post semanal */}
            <div style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "#E1306C", fontWeight: 600, background: "rgba(225,48,108,0.08)", padding: "2px 8px", borderRadius: 100 }}>Instagram Feed</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash }}>segunda às 19h</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: V.night, margin: "0 0 6px", lineHeight: 1.4 }}>
                São Paulo tem mais de 6 mil pizzarias, mas apenas 15% fazem massa fresca diariamente.
              </p>
              <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                Aqui na Aggregati, no coração do Sumarezinho, nossa massa é preparada toda manhã. Zero conservantes, zero pressa...
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: V.white, borderRadius: 8, border: `1px solid ${V.fog}`, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: V.night }}>5</div>
                <div style={{ fontSize: 9, color: V.ash, fontFamily: V.mono }}>posts prontos com imagens</div>
              </div>
              <div style={{ flex: 1, background: V.white, borderRadius: 8, border: `1px solid ${V.fog}`, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: V.night }}>3</div>
                <div style={{ fontSize: 9, color: V.ash, fontFamily: V.mono }}>briefings</div>
              </div>
              <div style={{ flex: 1, background: V.white, borderRadius: 8, border: `1px solid ${V.fog}`, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: V.night }}>1</div>
                <div style={{ fontSize: 9, color: V.ash, fontFamily: V.mono }}>relatório mercado</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ CARROSSEL — Cards reais ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>negócios analisados</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Oportunidades reais que encontramos
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: "0 0 24px" }}>
          Cada card foi gerado com dados reais. O seu negócio é o próximo.
        </p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory" as const }}>
          {[
            // Pizzaria — São Paulo
            "ChIJO-3dqidazpQR8grH25DryHA",
            "ChIJT_hKLcBZzpQR_DXAu2tj7fg",
            "ChIJafL6lbRXzpQR_uL1LS6YHqM",
            "ChIJJ--IeftXzpQRvnflvmEVs88",
            "ChIJZ-k7vfxXzpQRaDkvzVYxJNc",
          ].map((id) => (
            <div key={id} style={{ flexShrink: 0, width: 280, scrollSnapAlign: "start" as const }}>
              <img
                src={`/cards/${id}.png`}
                alt="Análise Virô"
                style={{ width: "100%", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ SECTION 5 — O QUE VOCÊ RECEBE (simplificado) ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>o que você recebe</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 28px", lineHeight: 1.25 }}>
          Três níveis de profundidade
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Grátis */}
          <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "24px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: "0.06em", fontWeight: 600 }}>DIAGNÓSTICO · 30 SEGUNDOS</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.teal, fontWeight: 700 }}>Grátis</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>Quantos clientes você pode ter a mais por mês.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>Posição competitiva, 3 pilares com score, mercado mapeado (buscas, audiência, concorrentes, sazonalidade). Resultado em 30 segundos.</p>
          </div>
          {/* R$497 */}
          <div style={{ background: V.white, borderRadius: 14, border: `2px solid ${V.amber}`, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", fontWeight: 600 }}>PLANO DE AÇÃO · PAGAMENTO ÚNICO</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.amber, fontWeight: 700 }}>R$497</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>15 ações priorizadas com conteúdo pronto.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>Cada ação tem o que fazer, por quê, quanto tempo leva e um botão que gera o conteúdo pronto — respostas para reviews, textos para o site, roteiros, templates. Copie e cole.</p>
          </div>
          {/* R$99/mês */}
          <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.slate}40`, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.slate, letterSpacing: "0.06em", fontWeight: 600 }}>AÇÕES SEMANAIS · CANCELE QUANDO QUISER</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.slate, fontWeight: 700 }}>R$99/mês</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>Contexto do mercado + conteúdos prontos toda sexta.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>Indicadores macro, movimentações do setor, oportunidades da semana. 5 posts com arco narrativo + 3 briefings estratégicos (equipe, agência, parceiro). Requer Plano de Ação.</p>
          </div>
        </div>
      </Section>

      {/* ═══ SECTION 6 — METODOLOGIA E FONTES ═══ */}
      <Section bg={V.white}>
        <SectionLabel>metodologia</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Dados reais do seu mercado
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 28px" }}>
          Não adivinhamos — coletamos. Virô cruza 12 fontes de dados reais para montar a leitura do seu mercado. Isso é o que nos diferencia de ferramentas genéricas de IA.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {[
            "Google Search", "Google Maps", "Google Places API", "Google Ads",
            "Instagram", "Perplexity AI", "DataForSEO",
            "IBGE", "PNCP", "CNPJá", "Receita Federal",
            "Claude AI", "fal.ai",
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
            Visibilidade (aparece quando buscam — Google, Maps, IA), Credibilidade (convence quem encontra — reviews, fotos, site) e Presença Digital (mantém relevância — conteúdo, menções, alcance). Tudo relativizado contra seus concorrentes reais no raio.
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
          { q: "O diagnóstico gratuito usa dados reais do meu negócio?", a: "Sim. O Virô consulta em tempo real o Google Maps, o Instagram, o volume de buscas no Google, dados demográficos do IBGE e a presença do seu negócio em respostas de IA. Nada é inventado — tudo vem de fontes públicas e verificáveis." },
          { q: "Quanto custa?", a: "O diagnóstico inicial é gratuito. O Plano de Ação completo custa R$497 (pagamento único, sem mensalidade obrigatória). A assinatura Virô Connect é opcional, custa R$99/mês e pode ser cancelada a qualquer momento direto pelo painel." },
          { q: "O que eu recebo com o Plano de Ação de R$497?", a: "15 ações priorizadas pelos seus gaps reais, cada uma com passo-a-passo de execução e textos prontos para copiar. Inclui também: respostas prontas para suas avaliações no Google, posts prontos para publicar, otimização da sua ficha do Google Meu Negócio, relatório setorial com tendências do seu mercado, e 30 dias do Agente Nelson (em breve) executando ações direto no seu Google Meu Negócio." },
          { q: "Em quanto tempo fico com o plano pronto?", a: "O diagnóstico inicial leva cerca de 60 segundos. Após o pagamento, o plano completo é gerado em 2 a 5 minutos e fica disponível no painel — você também recebe o link por email." },
          { q: "E a assinatura mensal de R$99 — o que inclui?", a: "Atualização semanal do seu mercado toda sexta-feira: novo relatório setorial, posts conectados ao contexto da semana e briefings prontos para sua equipe e parceiros. Em breve, também a continuidade do Agente Nelson operando seu Google Meu Negócio. Cancelamento sem fidelidade, direto pelo painel." },
          { q: "O Virô faz por mim ou só me mostra o caminho?", a: "Hoje o Virô gera todo o conteúdo pronto para você copiar e colar — posts, respostas a reviews, descrição da ficha, briefings. Em breve, o Agente Nelson vai executar essas ações direto no seu Google Meu Negócio com sua autorização (atualmente em processo de aprovação do Google). O caminho é claro: começa como ferramenta, vira agente." },
          { q: "Funciona para qualquer tipo de negócio?", a: "Para negócios locais com endereço físico ou área de atuação definida — restaurantes, clínicas, academias, escolas, salões, lojas, escritórios de serviço. Se você quer ser encontrado por quem está perto, o Virô serve para você. Para negócios 100% digitais (e-commerce nacional, SaaS), também funciona — basta marcar a opção 'Nacional' no formulário." },
          { q: "E se meu negócio ainda não aparece no Google Maps?", a: "O diagnóstico funciona mesmo assim. Analisamos a demanda real e a concorrência do seu raio independentemente do seu perfil — e o plano vai indicar exatamente o que fazer para você aparecer." },
          { q: "Meus dados são seguros?", a: "Sim. O Virô só coleta dados públicos do seu negócio (não dados de clientes), opera dentro da LGPD, e nunca vende, aluga ou compartilha seus dados com terceiros. A política completa está em /privacidade." },
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
