"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProgressBar from "@/components/ProgressBar";
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
  teal: "#2D9B83",
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

// ═════════════════════════════════════════════════════════════════════
export default function Home() {
  const [locale, setLocale] = useState<Locale>("pt");
  const t = dictionaries[locale];
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
            <input style={inputStyle} type="text" placeholder="Ex: Studio Profitteratti, Clínica Dente Feliz" value={formData.businessName}
              onChange={(e: any) => updateField("businessName", e.target.value)} />
          </Field>
          <Field label={t.formProductLabel} hint={t.formProductHint}>
            <input style={inputStyle} type="text" placeholder={t.formProductPlaceholder} value={formData.product}
              onChange={(e: any) => updateField("product", e.target.value)} />
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
        </>
      ),
    },
    2: {
      title: t.formStep2Title,
      content: (
        <>
          <p style={{ fontSize: 13, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>{t.formStep2Subtitle}</p>
          <Field label="Seu nome">
            <input style={inputStyle} type="text" placeholder="Como prefere ser chamado" value={(formData as any).name || ""}
              onChange={(e: any) => updateField("name" as any, e.target.value)} />
          </Field>
          <Field label={`${t.formWhatsappLabel} *`} hint="Obrigatório — enviamos seu resultado por aqui">
            <input style={inputStyle} type="tel" placeholder={t.formWhatsappPlaceholder} value={formData.whatsapp}
              onChange={(e: any) => updateField("whatsapp", e.target.value)} />
          </Field>
          <Field label={t.formEmailLabel} hint="Opcional — enviamos uma cópia do diagnóstico">
            <input style={inputStyle} type="email" placeholder={t.formEmailPlaceholder} value={formData.email}
              onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label="Instagram" hint="Opcional — usamos para analisar sua presença">
            <input style={inputStyle} type="text" placeholder="@seuperfil" value={formData.instagram}
              onChange={(e: any) => updateField("instagram", e.target.value)} />
          </Field>
          <Field label="LinkedIn" hint="Opcional — se atende outras empresas">
            <input style={inputStyle} type="text" placeholder="linkedin.com/company/sua-empresa" value={(formData as any).linkedin || ""}
              onChange={(e: any) => updateField("linkedin" as any, e.target.value)} />
          </Field>
        </>
      ),
    },
  };

  const currentStep = formSteps[formStep];
  const isStepValid = (stepValidation as any)[`step${formStep}`]?.(formData);

  return (
    <div style={{ minHeight: "100vh", background: V.white }}>
      {/* Google Places: API REST via proxy server-side (não precisa de JS client) */}

      {/* ═══ HERO ═══ */}
      <div style={{
        background: V.night, padding: "60px 24px 48px", textAlign: "center",
        opacity: heroVisible ? 1 : 0, transition: "opacity 0.6s ease",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Language toggle */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${V.slate}` }}>
              {(["pt", "en", "es"] as Locale[]).map(l => (
                <button key={l} onClick={() => { setLocale(l); updateField("locale", l); }}
                  style={{
                    padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: locale === l ? V.white : "transparent",
                    color: locale === l ? V.night : V.ash,
                    transition: "all 0.15s",
                  }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span style={{ fontFamily: V.display, fontSize: 24, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>
            Virô
          </span>
          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "24px 0 16px", lineHeight: 1.2,
          }}>
            {t.heroTitle1} <span style={{ color: V.amber }}>{t.heroTitle2}</span>
          </h1>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.6, margin: "0 0 8px" }}>
            {t.heroSubShort}
          </p>
          <p style={{ fontSize: 13, color: V.zinc }}>
            {t.heroFree}
          </p>
        </div>
      </div>

      {/* ═══ FORM ═══ */}
      <div style={{ maxWidth: 480, margin: "-24px auto 0", padding: "0 20px 60px" }}>
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

          {/* Honeypot — invisível para humanos, bots preenchem automaticamente */}
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
              onClick={() => { if (formStep < totalSteps) setFormStep(formStep + 1); else handleSubmit(); }}
              disabled={!isStepValid}
              style={{
                background: formStep === totalSteps ? V.amber : V.night,
                color: V.white, border: "none", padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: isStepValid ? "pointer" : "not-allowed",
                opacity: isStepValid ? 1 : 0.4, transition: "all 0.15s",
              }}
            >
              {formStep === totalSteps ? t.formSubmit : t.formNext}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ COMO OBTEMOS OS DADOS ═══ */}
      <div style={{ background: V.cloud, padding: "48px 24px", borderTop: `1px solid ${V.fog}` }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: V.night, marginBottom: 16, fontFamily: V.display }}>
            Como obtemos os dados
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: V.zinc }}>
            O Virô cruza 9 fontes em tempo real para montar o diagnóstico do seu mercado local:
            Google Search, Google Maps, Google Ads, Instagram (dados públicos), Perplexity AI,
            DataForSEO, IBGE, PNCP e modelos proprietários de inteligência artificial.
          </p>
        </div>
      </div>

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
