"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProgressBar from "@/components/ProgressBar";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";
import Script from "next/script";

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

// ─── Google Places Autocomplete (PlaceAutocompleteElement — new API) ─
declare global { interface Window { google: any } }

function PlacesAutocomplete({ value, onChange, onPlaceSelected, placeholder }: {
  value: string; onChange: (val: string) => void;
  onPlaceSelected: (place: { address: string; placeId: string; lat: number; lng: number }) => void;
  placeholder: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onChangeRef.current = onChange;
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    if (!containerRef.current || !window.google?.maps?.places) return;
    if (elementRef.current) return;

    const placeAC = new window.google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: "br" },
      types: ["address"],
    });

    placeAC.setAttribute("placeholder", placeholder);

    // Capture typing via standard input events (bubble through shadow DOM)
    placeAC.addEventListener("input", (e: any) => {
      const source = e.composedPath?.()?.[0] as HTMLInputElement | undefined;
      if (source?.value !== undefined) {
        onChangeRef.current(source.value);
      }
    });

    // Capture place selection
    placeAC.addEventListener("gmp-placeselect", async (event: any) => {
      const place = event.place;
      try {
        await place.fetchFields({ fields: ["formattedAddress", "location", "id"] });
        const address = place.formattedAddress || "";
        const lat = place.location?.lat() || 0;
        const lng = place.location?.lng() || 0;
        const placeId = place.id || "";
        onChangeRef.current(address);
        onPlaceSelectedRef.current({ address, placeId, lat, lng });
      } catch (err) {
        console.error("[PlacesAutocomplete] fetchFields failed:", err);
      }
    });

    containerRef.current.appendChild(placeAC);
    elementRef.current = placeAC;
  }, [placeholder]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <style>{`
        gmp-place-autocomplete {
          width: 100%;
          --gmpac-color-surface: ${V.cloud};
          --gmpac-color-on-surface: ${V.night};
          --gmpac-color-on-surface-variant: ${V.zinc};
          --gmpac-color-outline: ${V.fog};
          --gmpac-color-primary: ${V.amber};
          --gmpac-font-family-base: ${V.body};
          --gmpac-font-size-body: 15px;
          --gmpac-size-border-radius: 10px;
          --gmpac-size-icon: 0px;
          --gmpac-padding-inline-start: 16px;
        }
      `}</style>
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
  const [placesReady, setPlacesReady] = useState(false);
  const [noInstagram, setNoInstagram] = useState(false);
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
        onComplete={() => setAnimDone(true)}
        steps={t.processingSteps}
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
          <Field label={t.formProductLabel} hint={t.formProductHint}>
            <input style={inputStyle} type="text" placeholder={t.formProductPlaceholder} value={formData.product}
              onChange={(e: any) => updateField("product", e.target.value)} />
          </Field>

          <Field label={t.formDiffLabel} hint={t.formDiffHint}>
            <input style={inputStyle} type="text" placeholder={t.formDiffPlaceholder} value={formData.differentiator}
              onChange={(e: any) => updateField("differentiator", e.target.value)} />
          </Field>

          <Field label={t.formInstagramLabel} hint={t.formInstagramHint}>
            {noInstagram ? (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: V.cloud, fontSize: 13, color: V.zinc }}>
                {t.formNoInstagramMsg}
              </div>
            ) : (
              <input style={inputStyle} type="text" placeholder={t.formInstagramPlaceholder} value={formData.instagram}
                onChange={(e: any) => updateField("instagram", e.target.value)} />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: V.ash, cursor: "pointer" }}>
              <input type="checkbox" checked={noInstagram} onChange={(e: any) => {
                setNoInstagram(e.target.checked);
                updateField("noInstagram", e.target.checked);
                if (e.target.checked) updateField("instagram", "");
              }} style={{ width: 16, height: 16, accentColor: V.amber }} />
              {t.formNoInstagram}
            </label>
          </Field>

          <Field label={t.formRegionLabel} hint={isNational ? t.formRegionNationalHint : t.formRegionHint}>
            {isNational ? (
              <div style={{ padding: "14px 16px", borderRadius: 10, background: V.cloud, fontSize: 13, color: V.zinc }}>
                {t.formNationalMsg}
              </div>
            ) : placesReady ? (
              <PlacesAutocomplete
                value={formData.region}
                onChange={(val) => updateField("region", val)}
                onPlaceSelected={handlePlaceSelected}
                placeholder={t.formRegionPlaceholder}
              />
            ) : (
              <input style={inputStyle} type="text" placeholder={t.formRegionPlaceholder} value={formData.region}
                onChange={(e: any) => updateField("region", e.target.value)} />
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

          <Field label={t.formSiteLabel} hint={t.formSiteHint}>
            <input style={inputStyle} type="url" placeholder={t.formSitePlaceholder} value={formData.site}
              onChange={(e: any) => updateField("site", e.target.value)} />
          </Field>
        </>
      ),
    },
    2: {
      title: t.formStep2Title,
      content: (
        <>
          <p style={{ fontSize: 13, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>{t.formStep2Subtitle}</p>
          <Field label={t.formEmailLabel}>
            <input style={inputStyle} type="email" placeholder={t.formEmailPlaceholder} value={formData.email}
              onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label={t.formWhatsappLabel}>
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
      {/* Google Places Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ""}&libraries=places&loading=async`}
        onReady={() => setPlacesReady(true)}
        strategy="lazyOnload"
      />

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
            O Virô cruza 8 fontes em tempo real para montar o diagnóstico do seu mercado local:
            Google Search, Google Maps, Instagram (dados públicos), Perplexity AI, DataForSEO, IBGE
            e modelos proprietários de scoring e análise.
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
