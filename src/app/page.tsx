"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ProgressBar from "@/components/ProgressBar";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData, stepValidation } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";
import Script from "next/script";

// ─── Virô Design Tokens (from brand spec) ──────────────────────────
const V = {
  // Primary
  night: "#161618",
  graphite: "#232326",
  slate: "#3A3A40",
  zinc: "#6E6E78",
  ash: "#9E9EA8",
  mist: "#C8C8D0",
  fog: "#EAEAEE",
  cloud: "#F4F4F7",
  white: "#FEFEFF",

  // Accent — warm amber
  amber: "#CF8523",
  amberSoft: "#E6A445",
  amberWash: "rgba(207,133,35,0.08)",
  amberWash2: "rgba(207,133,35,0.15)",

  // Functional
  teal: "#2D9B83",
  tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F",

  // Typography
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: V.white,
  border: `1px solid ${V.fog}`,
  borderRadius: 10,
  color: V.night,
  fontSize: 15,
  fontFamily: V.body,
  transition: "all 0.15s",
  outline: "none",
};

// ─── Reusable Components ────────────────────────────────────────────

function Field({ label, hint, badge, children }: { label?: string; hint?: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: V.slate, marginBottom: 6, fontFamily: V.body }}>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 12, color: V.ash, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
      {badge && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 12px", borderRadius: 100, marginTop: 8, background: V.tealWash, color: V.teal, fontFamily: V.mono, fontWeight: 500, letterSpacing: "0.02em" }}>
          ✓ {badge}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt: string) => {
        const active = selected.includes(opt);
        return (
          <button type="button" key={opt} onClick={() => onToggle(opt)} style={{
            padding: "10px 18px", background: active ? V.amberWash : V.white,
            border: `1px solid ${active ? V.amber : V.fog}`, borderRadius: 100,
            color: active ? V.amber : V.zinc, fontSize: 14, fontFamily: V.body,
            cursor: "pointer", transition: "all 0.15s", fontWeight: active ? 500 : 400,
          }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function LangSwitcher({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  const langs: { code: Locale; label: string }[] = [
    { code: "pt", label: "PT" },
    { code: "en", label: "EN" },
    { code: "es", label: "ES" },
  ];
  return (
    <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100, display: "flex", gap: 4, background: "rgba(254,254,255,0.9)", borderRadius: 100, padding: 3, border: `1px solid ${V.fog}`, backdropFilter: "blur(12px)" }}>
      {langs.map((l) => (
        <button key={l.code} onClick={() => onChange(l.code)} style={{
          fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", padding: "6px 12px",
          borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.15s",
          background: locale === l.code ? V.night : "transparent",
          color: locale === l.code ? V.white : V.ash, fontWeight: 500,
        }}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ─── Google Places Autocomplete ─────────────────────────────────────

function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  onPlaceSelected: (place: { address: string; placeId: string; lat: number; lng: number }) => void;
  placeholder: string;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return; // already initialized

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["(regions)"],
      fields: ["formatted_address", "place_id", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
        onPlaceSelected({
          address: place.formatted_address,
          placeId: place.place_id || "",
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        });
      }
    });

    autocompleteRef.current = ac;
  }, [onChange, onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, ...style }}
    />
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
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [placesReady, setPlacesReady] = useState(false);
  const [noInstagram, setNoInstagram] = useState(false);

  // Auto-detect locale
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = navigator.language?.toLowerCase() || "";
      const brTimezones = ["America/Sao_Paulo","America/Fortaleza","America/Recife","America/Bahia","America/Belem","America/Manaus","America/Cuiaba","America/Porto_Velho","America/Rio_Branco","America/Noronha"];
      const isBrazil = brTimezones.some(z => tz.startsWith(z)) || lang.startsWith("pt-br");
      const esTimezones = ["America/Argentina","America/Mexico","America/Bogota","America/Santiago","America/Lima","Europe/Madrid"];
      const isSpanish = !isBrazil && (lang.startsWith("es") || esTimezones.some(z => tz.startsWith(z)));
      setLocale(isBrazil ? "pt" : isSpanish ? "es" : "en");
    } catch { /* fallback pt */ }
  }, []);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  // Badges — only show for fields that have real validation
  // (removed fake "Perfil encontrado" and "Demanda validada" — not real until Apify validates)

  const updateField = (key: keyof LeadFormData, val: any) => setFormData((d: any) => ({ ...d, [key]: val }));
  const updateCompetitor = (idx: number, field: "name" | "instagram", val: string) => {
    const c = [...formData.competitors];
    c[idx] = { ...c[idx], [field]: val };
    setFormData((d: any) => ({ ...d, competitors: c }));
  };
  const toggleArray = (key: "channels" | "digitalPresence", val: string) => {
    setFormData((d: any) => {
      const arr = d[key] as string[];
      return { ...d, [key]: arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val] };
    });
  };

  const [apiDone, setApiDone] = useState(false);
  const [animDone, setAnimDone] = useState(false);

  const handleSubmit = useCallback(async () => {
    setScreen("processing");
    setApiDone(false);
    setAnimDone(false);
    try {
      const res = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, locale }) });
      const data = await res.json();
      if (data.results) { setResults(data.results); setLeadId(data.lead_id); }
      else { setResults({ terms: [{ term: formData.product, volume: 0, cpc: 0, position: "—" }], totalVolume: 0, avgCpc: 0, marketLow: 0, marketHigh: 0, influencePercent: 0, source: "error", confidence: "low" }); }
    } catch { setResults({ terms: [{ term: formData.product, volume: 0, cpc: 0, position: "—" }], totalVolume: 0, avgCpc: 0, marketLow: 0, marketHigh: 0, influencePercent: 0, source: "error", confidence: "low" }); }
    setApiDone(true);
  }, [formData, locale]);

  // Transition to value screen only when BOTH animation finished AND API returned
  useEffect(() => {
    if (apiDone && animDone && results) {
      setScreen("value");
    }
  }, [apiDone, animDone, results]);

  const handleCheckout = useCallback(async (coupon?: string) => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadId, locale, coupon }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert("Erro no checkout. Tente novamente."); }
    setCheckoutLoading(false);
  }, [leadId, locale]);

  const handlePlaceSelected = useCallback((place: { address: string; placeId: string; lat: number; lng: number }) => {
    setFormData((d: any) => ({
      ...d,
      region: place.address,
      placeId: place.placeId,
      lat: place.lat,
      lng: place.lng,
    }));
  }, []);

  // Show conditional fields
  const hasInstagram = formData.digitalPresence.includes("Instagram");
  const hasSite = formData.digitalPresence.includes("Site") || formData.digitalPresence.includes("Website") || formData.digitalPresence.includes("Sitio web");

  // ─── Screen routing (NO home redirect) ────────────────────────────
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
      />
    );
  }

  const formSteps: Record<number, { label: string; title: string; content: React.ReactNode }> = {
    1: {
      label: t.stepOf(1, 4),
      title: t.step1Title,
      content: (
        <>
          <Field label={t.step1ProductLabel} hint={t.step1ProductHint} badge={badges.product}>
            <input style={inputStyle} type="text" placeholder={t.step1ProductPlaceholder} value={formData.product} onChange={(e: any) => updateField("product", e.target.value)} />
          </Field>
          <Field label={t.step1CustomerDescLabel} hint={t.step1CustomerDescHint}>
            <input style={inputStyle} type="text" placeholder={t.step1CustomerDescPlaceholder} value={formData.customerDescription} onChange={(e: any) => updateField("customerDescription", e.target.value)} />
          </Field>
          <Field label={t.step1RegionLabel} hint={t.step1RegionHint}>
            {placesReady ? (
              <PlacesAutocomplete
                value={formData.region}
                onChange={(val) => updateField("region", val)}
                onPlaceSelected={handlePlaceSelected}
                placeholder={t.step1RegionPlaceholder}
              />
            ) : (
              <input style={inputStyle} type="text" placeholder={t.step1RegionPlaceholder} value={formData.region} onChange={(e: any) => updateField("region", e.target.value)} />
            )}
          </Field>
        </>
      ),
    },
    2: {
      label: t.stepOf(2, 4),
      title: t.step2Title,
      content: (
        <>
          <Field label={t.step2ChannelsLabel}>
            <MultiSelect options={t.step2Channels} selected={formData.channels} onToggle={(v: string) => toggleArray("channels", v)} />
          </Field>
          <Field label={t.step2PresenceLabel} hint={t.step2PresenceHint}>
            <MultiSelect options={t.step2PresenceOptions} selected={formData.digitalPresence} onToggle={(v: string) => toggleArray("digitalPresence", v)} />
          </Field>
          <Field label={t.step2InstagramLabel} badge={badges.instagram}>
            {noInstagram ? (
              <div style={{
                padding: "12px 16px", borderRadius: 10, background: "#F4F4F7",
                fontSize: 13, color: "#6E6E78", lineHeight: 1.5,
              }}>
                {locale === "pt" ? "Sem problema — o diagnóstico vai focar nos outros canais e incluir recomendações para Instagram."
                  : locale === "es" ? "Sin problema — el diagnóstico se enfocará en otros canales e incluirá recomendaciones para Instagram."
                  : "No problem — the diagnostic will focus on other channels and include Instagram recommendations."}
              </div>
            ) : (
              <input style={inputStyle} type="text" placeholder={t.step2InstagramPlaceholder} value={formData.instagram} onChange={(e: any) => updateField("instagram", e.target.value)} />
            )}
            <label style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 8,
              fontSize: 13, color: "#6E6E78", cursor: "pointer", userSelect: "none" as const,
            }}>
              <input
                type="checkbox"
                checked={noInstagram}
                onChange={(e: any) => {
                  setNoInstagram(e.target.checked);
                  updateField("noInstagram", e.target.checked);
                  if (e.target.checked) updateField("instagram", "");
                }}
                style={{ width: 16, height: 16, accentColor: "#CF8523", cursor: "pointer" }}
              />
              {locale === "pt" ? "Não tenho Instagram" : locale === "es" ? "No tengo Instagram" : "I don't have Instagram"}
            </label>
          </Field>
          {hasSite && (
            <Field label={t.step2SiteLabel} badge={badges.site}>
              <input style={inputStyle} type="url" placeholder={t.step2SitePlaceholder} value={formData.site} onChange={(e: any) => updateField("site", e.target.value)} />
            </Field>
          )}
        </>
      ),
    },
    3: {
      label: t.stepOf(3, 4),
      title: t.step3Title,
      content: (
        <>
          <Field label={t.step3DiffLabel}>
            <input style={inputStyle} type="text" placeholder={t.step3DiffPlaceholder} value={formData.differentiator} onChange={(e: any) => updateField("differentiator", e.target.value)} />
          </Field>
          <Field label={t.step3CompLabel} hint={t.step3CompHint}>
            {[0, 1, 2].map((i: number) => (
              <div key={i} style={{ marginBottom: i < 2 ? 8 : 0 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: "1 1 60%" }}
                    type="text"
                    placeholder={t.step3CompPlaceholders[i]}
                    value={formData.competitors[i]?.name || ""}
                    onChange={(e: any) => updateCompetitor(i, "name", e.target.value)}
                  />
                  <input
                    style={{ ...inputStyle, flex: "1 1 40%", fontSize: 13 }}
                    type="text"
                    placeholder={t.step3CompInstagramPlaceholder}
                    value={formData.competitors[i]?.instagram || ""}
                    onChange={(e: any) => updateCompetitor(i, "instagram", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </Field>
          <Field label={t.step3TicketLabel} hint={t.step3TicketHint}>
            <input
              style={inputStyle}
              type="number"
              placeholder={t.step3TicketPlaceholder}
              min="1"
              step="1"
              value={formData.ticket || ""}
              onChange={(e: any) => updateField("ticket", e.target.value ? Number(e.target.value) : "")}
            />
          </Field>
        </>
      ),
    },
    4: {
      label: t.stepOf(4, 4),
      title: t.step4Title,
      content: (
        <>
          <Field label={t.step4ChallengeLabel}>
            <select style={{ ...inputStyle, appearance: "none" as any, cursor: "pointer" }} value={formData.challenge} onChange={(e: any) => updateField("challenge", e.target.value)}>
              <option value="">{locale === "pt" ? "Selecione" : locale === "es" ? "Selecciona" : "Select"}</option>
              {t.step4Challenges.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t.step4FreeTextLabel}>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder={t.step4FreeTextPlaceholder} value={formData.freeText} onChange={(e: any) => updateField("freeText", e.target.value)} />
          </Field>
          <Field label={t.step4EmailLabel}>
            <input style={inputStyle} type="email" placeholder={t.step4EmailPlaceholder} value={formData.email} onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label={t.step4WhatsappLabel} hint={t.step4WhatsappHint}>
            <input style={inputStyle} type="tel" placeholder={t.step4WhatsappPlaceholder} value={formData.whatsapp} onChange={(e: any) => updateField("whatsapp", e.target.value)} />
          </Field>
        </>
      ),
    },
  };

  const currentStep = formSteps[formStep];

  return (
    <div style={{ minHeight: "100vh", background: V.cloud }}>
      {/* Google Places Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY || ""}&libraries=places`}
        onReady={() => setPlacesReady(true)}
        strategy="lazyOnload"
      />

      <LangSwitcher locale={locale} onChange={setLocale} />

      {/* ═══ HERO ═══ */}
      <div style={{
        background: V.night,
        position: "relative", overflow: "hidden",
      }}>
        {/* Amber glow top-right */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${V.amberWash2} 0%, transparent 70%)` }} />

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", minHeight: "100vh", padding: "60px 24px",
          opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)", position: "relative",
        }}>
          {/* Brand */}
          <div style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, color: V.white, letterSpacing: "-0.03em", marginBottom: 8 }}>
            Virô
          </div>

          {/* Badge */}
          <div style={{
            fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const,
            color: V.amber, background: V.amberWash, padding: "6px 16px", borderRadius: 100,
            border: "1px solid rgba(207,133,35,0.2)", marginBottom: 48,
          }}>
            {t.badge}
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: V.display, fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, lineHeight: 1.15, marginBottom: 24, maxWidth: 680, color: V.white, letterSpacing: "-0.03em" }}>
            {t.heroTitle1}{" "}
            <span style={{ color: V.amber }}>{t.heroTitle2}</span>
          </h1>

          <p style={{ fontSize: 15, color: V.ash, maxWidth: 540, marginBottom: 16, fontWeight: 400, lineHeight: 1.75 }}>{t.heroSub}</p>
          <p style={{ fontSize: 13, color: V.zinc, maxWidth: 520, marginBottom: 48, lineHeight: 1.75 }}>{t.heroWho}</p>

          <button onClick={() => document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" })} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: V.night, color: V.white, fontSize: 14, fontWeight: 600,
            padding: "12px 28px", borderRadius: 10, border: `1px solid ${V.amber}`, cursor: "pointer",
            fontFamily: V.body, transition: "all 0.15s",
          }}>
            {t.heroCta}
            <span style={{ fontSize: 16 }}>→</span>
          </button>

          {/* Proof */}
          <div style={{ marginTop: 80, display: "flex", gap: 48, flexWrap: "wrap", justifyContent: "center" }}>
            {t.proof.map((p: any, i: number) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>{p.number}</div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: V.zinc, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ WHY ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.amber, marginBottom: 16, textAlign: "center" }}>{t.whyLabel}</div>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, textAlign: "center", marginBottom: 32, letterSpacing: "-0.03em", color: V.night }}>{t.whyTitle}</h2>
        <p style={{ fontSize: 15, color: V.slate, lineHeight: 1.75, marginBottom: 16 }}>{t.whyP1}</p>
        <p style={{ fontSize: 15, color: V.slate, lineHeight: 1.75, marginBottom: 24 }}>{t.whyP2}</p>
        <div style={{ background: V.amberWash, borderLeft: `3px solid ${V.amber}`, padding: "16px 20px", borderRadius: "0 10px 10px 0" }}>
          <p style={{ fontSize: 15, color: V.night, fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{t.whyHighlight}</p>
        </div>
      </div>

      {/* ═══ PATTERNS ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 40px" }}>
        <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.amber, marginBottom: 16, textAlign: "center" }}>{t.patternsLabel}</div>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, textAlign: "center", marginBottom: 48, letterSpacing: "-0.03em", color: V.night }}>{t.patternsTitle}</h2>
        {t.patterns.map((item: any, i: number) => (
          <div key={i} style={{ background: V.white, border: `1px solid ${V.fog}`, borderRadius: 14, padding: "28px 24px", marginBottom: 12, borderTop: `3px solid ${V.amber}`, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontFamily: V.display, fontSize: 18, fontWeight: 600, marginBottom: 8, color: V.night, letterSpacing: "-0.02em" }}>{item.title}</h3>
            <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, textAlign: "center", marginBottom: 48, letterSpacing: "-0.03em", color: V.night }}>{t.howTitle}</h2>
        {t.howSteps.map((item: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 20, marginBottom: 32, alignItems: "flex-start" }}>
            <div style={{ fontFamily: V.mono, fontSize: 12, fontWeight: 500, color: V.amber, background: V.amberWash, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(207,133,35,0.2)" }}>
              {item.step}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontFamily: V.display, fontSize: 18, fontWeight: 600, color: V.night, letterSpacing: "-0.02em" }}>{item.title}</h3>
                {item.tag && (
                  <span style={{
                    fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const,
                    padding: "3px 10px", borderRadius: 100, fontWeight: 500,
                    color: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? V.teal : V.amber,
                    background: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? V.tealWash : V.amberWash,
                  }}>
                    {item.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ FORM ═══ */}
      <div style={{ background: V.fog }}>
        <div id="form-section" style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: V.display, fontSize: 28, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.03em", color: V.night }}>{t.formTitle}</h2>
            <p style={{ color: V.ash, fontSize: 15 }}>{t.formSub}</p>
          </div>
          <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "32px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <ProgressBar step={formStep} total={4} />
            <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.amber, marginBottom: 8, marginTop: 20 }}>{currentStep.label}</div>
            <div style={{ fontFamily: V.display, fontSize: 22, fontWeight: 700, marginBottom: 24, color: V.night, letterSpacing: "-0.02em" }}>{currentStep.title}</div>
            <div key={formStep}>{currentStep.content}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 20, borderTop: `1px solid ${V.fog}` }}>
              {formStep > 1 ? (
                <button onClick={() => setFormStep(formStep - 1)} style={{ background: "none", border: "none", color: V.ash, fontSize: 14, cursor: "pointer", padding: "10px 20px", fontFamily: V.body }}>{t.back}</button>
              ) : <div />}
              <button
                onClick={() => { if (formStep < 4) setFormStep(formStep + 1); else handleSubmit(); }}
                disabled={!(stepValidation as any)[`step${formStep}`]?.(formData)}
                style={{
                  background: formStep === 4 ? V.amber : V.night, color: V.white, border: "none",
                  padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: (stepValidation as any)[`step${formStep}`]?.(formData) ? "pointer" : "not-allowed",
                  transition: "all 0.15s", fontFamily: V.body,
                  opacity: (stepValidation as any)[`step${formStep}`]?.(formData) ? 1 : 0.4,
                }}>
                {formStep === 4 ? t.submit : t.next}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTEXT / PRICING ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ background: V.night, borderRadius: 14, padding: "36px 28px", color: V.white }}>
          <p style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: V.amber, marginBottom: 20 }}>{t.contextLabel}</p>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.75, marginBottom: 16 }}>{t.contextP1}</p>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.75, marginBottom: 20 }}>{t.contextP2}</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ background: V.graphite, borderRadius: 10, padding: "16px 20px", flex: "1 1 200px" }}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.zinc, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>{t.contextPrice}</div>
              <div style={{ fontFamily: V.display, fontSize: 24, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>{t.contextPriceValue}</div>
            </div>
            <div style={{ background: V.graphite, borderRadius: 10, padding: "16px 20px", flex: "1 1 200px" }}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.zinc, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>{t.contextRecurring}</div>
              <div style={{ fontFamily: V.display, fontSize: 24, fontWeight: 700, color: V.white, letterSpacing: "-0.03em" }}>{t.contextRecurringValue}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ padding: "32px 24px", borderTop: `1px solid ${V.fog}`, textAlign: "center", background: V.cloud }}>
        <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 700, color: V.night, marginBottom: 8, letterSpacing: "-0.03em" }}>
          Virô
        </div>
        <p style={{ fontSize: 12, color: V.ash, fontFamily: V.mono }}>{t.footer}</p>
      </footer>
    </div>
  );
}
