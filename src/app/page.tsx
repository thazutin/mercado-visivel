"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";
import { useLocale } from "@/hooks/useLocale";
import LocaleToggle from "@/components/LocaleToggle";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n-config";

// Map locale → default Google Places country (empty = no restriction)
const LOCALE_COUNTRY: Record<string, string> = { pt: "br", en: "", es: "" };
const LOCALE_LANGUAGE: Record<string, string> = { pt: "pt-BR", en: "en", es: "es" };


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
function PlacesAutocomplete({ value, onChange, onPlaceSelected, placeholder, country, language }: {
  value: string; onChange: (val: string) => void;
  onPlaceSelected: (place: { address: string; placeId: string; lat: number; lng: number }) => void;
  placeholder: string;
  country?: string;
  language?: string;
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
        const countryParam = country ? `&country=${country}` : '';
        const langParam = language ? `&language=${language}` : '';
        const url = `/api/places-autocomplete?input=${encodeURIComponent(text)}&sessiontoken=${sessionToken}${countryParam}${langParam}`;
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
  const { locale, setLocale, t } = useLocale();
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
        body: JSON.stringify({ ...formData, locale }),
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
          <Field label={t.formBusinessNameLabel}>
            <input style={inputStyle} type="text" placeholder={t.formBusinessNamePlaceholder} value={formData.businessName}
              onChange={(e: any) => updateField("businessName", e.target.value)} />
          </Field>
          <Field label={t.formProductLabel}>
            <input style={inputStyle} type="text"
              placeholder={t.formProductPlaceholderLong}
              value={formData.product}
              onChange={(e: any) => updateField("product", e.target.value)} />
            <p style={{ fontSize: 11, color: V.ash, margin: "6px 0 0", lineHeight: 1.4 }}>
              {t.formProductHintExtra}
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
                country={LOCALE_COUNTRY[locale] || ""}
                language={LOCALE_LANGUAGE[locale] || "en"}
              />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: V.ash, cursor: "pointer" }}>
              <input type="checkbox" checked={isNational} onChange={(e: any) => {
                setIsNational(e.target.checked);
                if (e.target.checked) updateField("region", t.formNationalRegionValue);
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
          <Field label={t.formNameLabel}>
            <input style={inputStyle} type="text" placeholder={t.formNamePlaceholder} value={(formData as any).name || ""}
              onChange={(e: any) => updateField("name" as any, e.target.value)} />
          </Field>
          <Field label={`${t.formEmailLabel} *`} hint={t.formEmailHint}>
            <input style={inputStyle} type="email" placeholder={t.formEmailPlaceholder} value={formData.email}
              onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label={t.formWhatsappLabel} hint={t.formWhatsappHint}>
            <input style={inputStyle} type="tel" placeholder={t.formWhatsappPlaceholder} value={formData.whatsapp}
              onChange={(e: any) => updateField("whatsapp", e.target.value)} />
          </Field>
          <Field label="Instagram" hint={t.formInstagramHint2}>
            <input style={inputStyle} type="text" placeholder={t.formInstagramPlaceholder2} value={formData.instagram}
              onChange={(e: any) => updateField("instagram", e.target.value)} />
          </Field>
          <Field label={t.formLinkedinLabel} hint={t.formLinkedinHint}>
            <input style={inputStyle} type="text" placeholder={t.formLinkedinPlaceholder} value={(formData as any).linkedin || ""}
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

      {/* ═══ SECTION 1 — HERO + FORM ═══ */}
      <div style={{
        background: V.night, padding: "60px 24px 48px", textAlign: "center",
        opacity: heroVisible ? 1 : 0, transition: "opacity 0.6s ease",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: V.display, fontSize: 24, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>
              Virô
            </span>
            <LocaleToggle locale={locale} onChange={setLocale} />
          </div>
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

      {/* ═══ FORM CARD ═══ */}
      <div style={{ maxWidth: 480, margin: "-24px auto 0", padding: "0 20px 0" }}>
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

      {/* ═══ SECTION 2 — MOCKUP ESTÁTICO DO RESULTADO ═══ */}
      <Section bg={V.white}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.25 }}>
            {t.mockupTitle}
          </h2>
          <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: 0 }}>{t.mockupSub}</p>
        </div>
        <div style={{ border: `1px solid ${V.fog}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.06)", position: "relative" }}>
          <div style={{ background: V.cloud, padding: "10px 18px", borderBottom: `1px solid ${V.fog}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash }}>{t.mockupLabel}</span>
          </div>
          <div style={{ padding: "20px 18px 0" }}>
            <div style={{ marginBottom: 20 }}><span style={{ fontSize: 12, color: V.ash }}>{t.mockupBusiness}</span></div>
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 10px" }}>{t.mockupSectionLabel}</p>
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.teal, letterSpacing: "-0.03em", lineHeight: 1 }}>~18k</div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>{t.mockupAudience}</p>
              <p style={{ fontSize: 9, color: V.ash, margin: "2px 0 0", fontFamily: V.mono }}>{t.mockupAudienceMeta}</p>
            </div>
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.night, letterSpacing: "-0.03em", lineHeight: 1 }}>3,200</div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>{t.mockupSearches}</p>
            </div>
            <div style={{ background: V.white, borderRadius: 12, padding: "18px 14px", textAlign: "center", border: `1px solid ${V.fog}`, marginBottom: 8 }}>
              <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.amber, letterSpacing: "-0.03em", lineHeight: 1 }}>12</div>
              <p style={{ fontSize: 11, color: V.zinc, margin: "4px 0 0" }}>{t.mockupCompetitors}</p>
              <span style={{ display: "inline-block", marginTop: 6, fontFamily: V.mono, fontSize: 9, padding: "2px 8px", borderRadius: 100, background: V.amberWash, color: V.amber, fontWeight: 600 }}>{t.mockupBalanced}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 10px" }}>
              <div style={{ flex: 1, height: 1, background: V.fog }} />
              <span style={{ fontSize: 9, fontFamily: V.mono, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{t.mockupVariable}</span>
              <div style={{ flex: 1, height: 1, background: V.fog }} />
            </div>
            <div style={{ background: V.night, borderRadius: 12, padding: "22px 14px", textAlign: "center", marginBottom: 0 }}>
              <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, color: V.amberSoft, letterSpacing: "-0.03em", lineHeight: 1 }}>18%</div>
              <p style={{ fontSize: 11, color: V.mist, margin: "6px 0 0" }}>{t.mockupInfluence}</p>
            </div>
          </div>
          <div style={{ padding: "14px 18px 0" }}>
            <p style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.ash, margin: "0 0 8px" }}>{t.mockupOpportunities}</p>
            {(t.mockupRoutes as any[]).map((r: any) => (
              <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: r.n < 3 ? `1px solid ${V.fog}` : "none" }}>
                <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 700, color: V.amber, background: V.amberWash, width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.n}</span>
                <span style={{ fontSize: 12, color: V.night, flex: 1 }}>{r.title}</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, color: V.teal, background: V.tealWash, padding: "2px 6px", borderRadius: 100, whiteSpace: "nowrap" as const }}>{r.horizon}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "32px 18px 20px", background: "linear-gradient(to bottom, rgba(254,254,255,0) 0%, rgba(254,254,255,0.95) 40%, rgba(254,254,255,1) 100%)", textAlign: "center", marginTop: -20, position: "relative" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: V.amber, margin: 0 }}>{t.mockupBlurCta}</p>
          </div>
        </div>
      </Section>

      {/* ═══ SECTION 3 — COMO FUNCIONA ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>{t.howSectionLabel}</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 32px", lineHeight: 1.25 }}>{t.howSectionTitle}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
          {(t.howCards as any[]).map((step: any, i: number) => (
            <div key={i} style={{ background: V.white, borderRadius: 14, padding: "24px 20px", border: `1px solid ${V.fog}` }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{step.icon}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: V.mono, fontSize: 10, fontWeight: 700, color: V.amber, background: V.amberWash, width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: V.night }}>{step.title}</span>
              </div>
              <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>{step.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ SECTION — É PARA MIM? ═══ */}
      <Section bg={V.white}>
        <SectionLabel>{t.forYouLabel}</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>{t.forYouTitle}</h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 12px" }}>{t.forYouP1}</p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>{t.forYouP2}</p>
      </Section>

      {/* ═══ SECTION 4 — O QUE VOCÊ VAI RECEBER ═══ */}
      <Section bg={V.white}>
        <SectionLabel>{t.whatYouGetLabel}</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>{t.whatYouGetTitle}</h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: "0 0 28px" }}>{t.whatYouGetSub}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(t.whatYouGetItems as any[]).map((item: any, i: number) => {
            const itemColor = item.color === "teal" ? V.teal : V.amber;
            return (
              <div key={i} style={{ padding: "20px", borderRadius: 12, border: `1px solid ${V.fog}`, background: V.white }}>
                <span style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", fontWeight: 600, color: itemColor, background: `${itemColor}15`, padding: "3px 8px", borderRadius: 4 }}>{item.label}</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: V.night, margin: "10px 0 6px" }}>{item.title}</div>
                <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ═══ SECTION 6 — METODOLOGIA E FONTES ═══ */}
      <Section bg={V.white}>
        <SectionLabel>{t.methodLabel}</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>{t.methodTitle}</h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 28px" }}>{t.methodSub}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {["Google Search", "Google Maps", "Google Ads", "Instagram", "Perplexity AI", "DataForSEO", "Census Data", "Claude AI"].map((source, i) => (
            <span key={i} style={{ fontFamily: V.mono, fontSize: 11, letterSpacing: "0.02em", color: V.teal, background: V.tealWash, padding: "6px 12px", borderRadius: 8, fontWeight: 500 }}>{source}</span>
          ))}
        </div>
        <div style={{ background: V.cloud, borderRadius: 12, padding: "20px", border: `1px solid ${V.fog}` }}>
          <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.7, margin: 0 }} dangerouslySetInnerHTML={{ __html: t.methodExplainer.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#161618">$1</strong>') }} />
        </div>
      </Section>

      {/* ═══ SECTION 7 — FAQ ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>{t.faqLabel}</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 24px", lineHeight: 1.25 }}>{t.faqTitle}</h2>
        {(t.faqs as any[]).map((faq: any, i: number) => (
          <FAQItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: V.night, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <span style={{ fontFamily: V.display, fontSize: 16, fontWeight: 700, color: V.white, letterSpacing: "-0.02em" }}>Virô</span>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
            <a href="/privacidade" style={{ fontSize: 13, color: V.ash, textDecoration: "none" }}>{t.footerPrivacy}</a>
            <a href="/termos" style={{ fontSize: 13, color: V.ash, textDecoration: "none" }}>{t.footerTerms}</a>
          </div>
          <p style={{ fontSize: 12, color: V.slate, marginTop: 16 }}>© {new Date().getFullYear()} Virô. {t.footerRights}</p>
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
