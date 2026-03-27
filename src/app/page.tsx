"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";


// ─── Design Tokens ─────────────────────────────────────────────────
const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", mist: "#C8C8D0",
  fog: "#EAEAEE", cloud: "#F4F4F7", white: "#FEFEFF",
  amber: "#CF8523", amberSoft: "#E6A445", amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83", tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

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
          <span style={{ fontFamily: V.display, fontSize: 24, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>
            Virô
          </span>
          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "24px 0 16px", lineHeight: 1.2,
          }}>
            Qual é sua <span style={{ color: V.amber }}>posição competitiva</span> no mercado local?
          </h1>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.6, margin: 0 }}>
            Em 60 segundos você sabe quanto do seu mercado disputa hoje — e o que fazer para disputar mais.
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
              PRÉVIA DO RESULTADO
            </span>
          </div>

          <div style={{ padding: "20px 18px 0" }}>
            {/* Mockup header */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: V.ash }}>Clínica de estética · Av. Paulista, São Paulo</span>
            </div>

            {/* Section label */}
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 10px" }}>
              Seu mercado em números
            </p>

            {/* Card 1 — Mercado Endereçável */}
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.teal, letterSpacing: "-0.03em", lineHeight: 1 }}>
                ~18 mil
              </div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>pessoas que poderiam contratar você no raio de 3km</p>
              <p style={{ fontSize: 9, color: V.ash, margin: "2px 0 0", fontFamily: V.mono }}>Mercado endereçável · São Paulo · Alta densidade</p>
            </div>

            {/* Card 2 — Demanda Ativa */}
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.night, letterSpacing: "-0.03em", lineHeight: 1 }}>
                3.200
              </div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>buscas/mês que poderiam levar até você</p>
            </div>

            {/* Card 3 — Concorrência */}
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.amber, letterSpacing: "-0.03em", lineHeight: 1 }}>
                12
              </div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>negócios disputando atenção com você</p>
              <span style={{ display: "inline-block", marginTop: 6, fontFamily: V.mono, fontSize: 9, padding: "2px 8px", borderRadius: 100, background: V.amberWash, color: V.amber, fontWeight: 600 }}>
                Concorrência compatível com a demanda
              </span>
            </div>

            {/* Card 4 — O que está em jogo */}
            <div style={{ background: "#161618", borderRadius: 12, padding: "20px 14px", marginBottom: 8 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#6E6E78",
                letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 12 }}>
                O que está em jogo
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div style={{ background: "#232326", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Satoshi', sans-serif", fontSize: 18, fontWeight: 700, color: "#C8C8D0" }}>R$960/mês</div>
                  <div style={{ fontSize: 10, color: "#6E6E78", marginTop: 2 }}>você disputa hoje (18%)</div>
                </div>
                <div style={{ background: "#232326", borderRadius: 8, padding: "10px 12px", textAlign: "center",
                  border: "1px solid rgba(207,133,35,0.3)" }}>
                  <div style={{ fontFamily: "'Satoshi', sans-serif", fontSize: 18, fontWeight: 700, color: "#E6A445" }}>R$5.760/mês</div>
                  <div style={{ fontSize: 10, color: "#6E6E78", marginTop: 2 }}>poderia disputar (36%)</div>
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#9E9EA8" }}>
                +2 clientes/mês · 18 mil pessoas no raio · 3.200 buscas/mês
              </div>
            </div>
          </div>

          {/* Checklist preview */}
          <div style={{ padding: "14px 18px 0" }}>
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 10px" }}>
              Primeiros Passos
            </p>
            {/* Item desbloqueado */}
            <div style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "12px 14px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: V.teal, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: V.night, flex: 1 }}>Cadastrar e otimizar perfil no Google Meu Negócio</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, marginLeft: 22 }}>
                <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(217,83,79,0.08)", color: V.coral, fontWeight: 600 }}>Alta prioridade</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, padding: "2px 8px", borderRadius: 100, background: V.tealWash, color: V.teal }}>1–4 semanas</span>
              </div>
              <p style={{ fontSize: 11, color: V.ash, margin: "6px 0 0 22px", lineHeight: 1.5 }}>
                Passo a passo: acesse business.google.com, adicione fotos, horário, categoria principal e responda às primeiras avaliações.
              </p>
            </div>
            {/* Itens bloqueados */}
            {[
              { title: "Otimizar bio do Instagram com palavras-chave locais", desc: "Atualize bio, link e destaques com termos que seus clientes buscam." },
              { title: "Criar página de serviços com SEO local", desc: "Página com title, meta description e conteúdo estruturado para IA." },
            ].map((item, i) => (
              <div key={i} style={{ background: V.white, borderRadius: 10, border: `1px solid ${V.fog}`, padding: "12px 14px", marginBottom: 6, filter: "blur(1.5px)", opacity: 0.6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: V.ash, fontSize: 14, flexShrink: 0 }}>○</span>
                  <span style={{ fontSize: 12, color: V.zinc }}>{item.title}</span>
                </div>
                <p style={{ fontSize: 11, color: V.ash, margin: "4px 0 0 22px", lineHeight: 1.4 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Content preview */}
          <div style={{ padding: "14px 18px 0" }}>
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 10px" }}>
              Exemplo de conteúdo gerado
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
                    847
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)",
                    letterSpacing: "0.12em", textTransform: "uppercase" as const,
                    fontFamily: "'JetBrains Mono', monospace", marginTop: 6,
                  }}>
                    ATENDIMENTOS EM MARÇO
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
                    Cada cliente aqui saiu melhor do que entrou.
                    Você é o próximo?
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%",
                      background: "#FF3366", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                      AGENDAMENTOS ABERTOS · LINK NA BIO
                    </span>
                  </div>
                </div>

              </div>

              {/* Legenda */}
              <div style={{ padding: "12px 14px 0" }}>
                <p style={{ fontSize: 12, color: V.zinc, lineHeight: 1.7, margin: "0 0 8px" }}>
                  Março foi nosso melhor mês — 847 atendimentos e cada um deles com cuidado real. Obrigada a cada cliente que confiou na gente. Agendamentos para abril já abertos. 🖤
                </p>
              </div>

              {/* Hashtags */}
              <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {["#estéticapaulista", "#cuidadocomavida", "#SãoPaulo", "#agendamentosabertos"].map((tag) => (
                  <span key={tag} style={{ fontSize: 10, color: V.teal, background: V.tealWash,
                    padding: "2px 8px", borderRadius: 6 }}>{tag}</span>
                ))}
              </div>

              {/* Meta: horário + dica */}
              <div style={{ margin: "0 14px 14px", padding: "10px 12px",
                background: V.cloud, borderRadius: 8,
                borderLeft: `3px solid ${V.amber}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: V.amber,
                    textTransform: "uppercase" as const, letterSpacing: "0.04em",
                    fontFamily: V.mono }}>
                    Melhor horário
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: V.night,
                    fontFamily: V.mono }}>
                    Ter–Qui · 19h–21h
                  </span>
                </div>
                <p style={{ fontSize: 11, color: V.zinc, margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: V.night }}>Por que este conteúdo:</strong> prova social com número real gera confiança e urgência — quem está considerando agendar vê movimento e decide.
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
            { icon: "🔍", title: "A Virô analisa seu mercado", text: "Cruzamos Google, Instagram, Maps, IBGE e IA em tempo real." },
            { icon: "📊", title: "Você recebe o relatório grátis", text: "Sua posição competitiva, quem disputa com você e quanto está em jogo." },
            { icon: "🔓", title: "Desbloqueie o Diagnóstico Completo — R$497", text: "Itens estruturantes, relatório setorial do seu mercado e posts conectados ao contexto da semana. Disponível em até 15 minutos." },
            { icon: "🔄", title: "Assine para conteúdos toda semana — R$99/mês", text: "Você recebe toda sexta-feira 4 posts prontos para copiar e colar + 3 briefings para compartilhar com time ou agência." },
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
          Lojas, clínicas, restaurantes, escritórios, studios e prestadores de serviço. Com ou sem presença digital forte.
        </p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
          Se você quer entender como sua empresa aparece hoje, quem disputa atenção com você e onde há oportunidade de crescer — a Virô é para você.
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
            { title: "Gap financeiro", desc: "Quanto você está deixando na mesa todo mês" },
            { title: "Demanda ativa", desc: "Buscas com intenção de compra no seu raio" },
            { title: "Concorrência", desc: "Quem disputa os mesmos clientes" },
            { title: "Posição Competitiva", desc: "Quanto do seu mercado você disputa hoje — e o que move esse número" },
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
            { title: "Diagnóstico completo", desc: "Por canal: Google, Instagram, Maps e IA" },
            { title: "Itens estruturantes", desc: "O básico que precisa estar no lugar — checklist dinâmica baseada no seu diagnóstico" },
            { title: "Relatório setorial", desc: "Tendências do seu mercado com dados reais desta semana" },
            { title: "Amostra de conteúdos", desc: "4 posts prontos para publicar" },
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
              Disponível após o Diagnóstico Completo
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
            <strong style={{ color: V.night }}>Medimos 4 dimensões:</strong>{" "}
            Descoberta (aparece quando buscam), Credibilidade (convence quem encontra), Presença (mantém relacionamento com quem já conhece) e Reputação (sua base te recomenda). Tudo relativizado contra seus concorrentes reais no raio.
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
          { q: "O relatório inicial é mesmo gratuito?", a: "Sim, 100% gratuito. Você preenche o formulário, a Virô analisa seu mercado em tempo real e entrega o relatório sem precisar criar conta ou inserir cartão." },
          { q: "O que está incluído no Diagnóstico Completo?", a: "O Diagnóstico Completo (R$497, pagamento único) inclui: diagnóstico detalhado por canal (Google, Instagram, Maps e IA), itens estruturantes — uma checklist dinâmica com o básico que precisa estar no lugar baseada nos gaps do seu negócio, relatório setorial com tendências reais do seu mercado, e posts prontos para publicar conectados ao contexto da semana. Tudo fica disponível no painel em até 15 minutos após o pagamento." },
          { q: "Quanto tempo leva para receber o diagnóstico?", a: "O relatório inicial fica pronto em até 1 minuto após você preencher o formulário. O Diagnóstico Completo fica disponível no painel em até 15 minutos após a confirmação do pagamento." },
          { q: "Como acesso meu painel depois de pagar?", a: "Após o pagamento, você recebe um email com o link de acesso direto ao painel. O login é feito com o mesmo email usado no cadastro — sem senha, via link mágico." },
          { q: "O que são os Conteúdos Semanais?", a: "São 4 posts prontos para publicar (Instagram ou LinkedIn, dependendo do perfil do seu negócio) e 3 briefings para sua equipe ou agência executarem — gerados toda sexta-feira com base no contexto atual do seu mercado. Disponível por R$99/mês após a contratação do Diagnóstico Completo." },
          { q: "Posso cancelar a recorrência?", a: "Sim, a qualquer momento direto no painel ou por email. Não há fidelidade nem multa." },
          { q: "Funciona para qualquer negócio?", a: "Funciona para negócios locais com atendimento físico ou regional: lojas, clínicas, restaurantes, escritórios, studios, prestadores de serviço. Se você depende de clientes na sua cidade ou região, a Virô é para você." },
          { q: "Meus dados ficam seguros?", a: "Sim. Seus dados são usados exclusivamente para gerar seu diagnóstico e nunca são compartilhados com terceiros. Veja nossa Política de Privacidade para mais detalhes." },
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
