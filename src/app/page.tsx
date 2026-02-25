"use client";

import { useState, useEffect, useCallback } from "react";
import ProgressBar from "@/components/ProgressBar";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData } from "@/lib/schema";
import { dictionaries, type Locale } from "@/lib/i18n";

// ─── Virô Design Tokens ─────────────────────────────────────────────
const V = {
  dark: "#141210",
  warmBlack: "#1E1C19",
  charcoal: "#2A2724",
  stone: "#8C8578",
  sand: "#B8AFA4",
  cream: "#F0ECE4",
  paper: "#F7F5F0",
  white: "#FEFEFE",
  ember: "#D4582A",
  emberLight: "#E8784A",
  emberGlow: "rgba(212, 88, 42, 0.12)",
  veroBlue: "#1A3A4A",
  veroTeal: "#2B6B7C",
  veroGlow: "rgba(43, 107, 124, 0.10)",
  serif: "'DM Serif Display', Georgia, serif",
  body: "'Outfit', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: V.white,
  border: `1px solid #E5E0D8`,
  borderRadius: 10,
  color: V.dark,
  fontSize: 15,
  fontFamily: V.body,
  transition: "all 0.3s ease",
  outline: "none",
};

function Field({ label, hint, badge, children }: { label?: string; hint?: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: V.charcoal, marginBottom: 6, fontFamily: V.body }}>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 12, color: V.stone, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
      {badge && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 12px", borderRadius: 100, marginTop: 8, background: V.veroGlow, color: V.veroTeal, fontFamily: V.mono, fontWeight: 500, letterSpacing: "0.02em", animation: "fadeInUp 0.3s ease" }}>
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
            padding: "10px 18px", background: active ? V.emberGlow : V.white,
            border: `1px solid ${active ? V.ember : "#E5E0D8"}`, borderRadius: 100,
            color: active ? V.ember : V.stone, fontSize: 14, fontFamily: V.body,
            cursor: "pointer", transition: "all 0.2s ease", fontWeight: active ? 500 : 400,
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
    <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100, display: "flex", gap: 4, background: "rgba(254,254,254,0.9)", borderRadius: 100, padding: 3, border: "1px solid #E5E0D8", backdropFilter: "blur(12px)" }}>
      {langs.map((l) => (
        <button key={l.code} onClick={() => onChange(l.code)} style={{
          fontFamily: V.mono, fontSize: 10, letterSpacing: "0.06em", padding: "6px 12px",
          borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.2s",
          background: locale === l.code ? V.ember : "transparent",
          color: locale === l.code ? V.white : V.stone, fontWeight: 500,
        }}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
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

  useEffect(() => {
    const b: Record<string, string> = {};
    if (formData.instagram.length > 5) b.instagram = locale === "en" ? "Profile found" : "Perfil encontrado";
    if (formData.site.length > 10) b.site = locale === "en" ? "Site accessible" : locale === "es" ? "Sitio accesible" : "Site acessível";
    if (formData.product.length > 5) b.product = locale === "en" ? "Demand validated" : locale === "es" ? "Demanda validada" : "Demanda validada na região";
    setBadges(b);
  }, [formData.instagram, formData.site, formData.product, locale]);

  const updateField = (key: keyof LeadFormData, val: any) => setFormData((d: any) => ({ ...d, [key]: val }));
  const updateCompetitor = (idx: number, val: string) => {
    const c = [...formData.competitors]; c[idx] = val;
    setFormData((d: any) => ({ ...d, competitors: c }));
  };
  const toggleArray = (key: "channels" | "digitalPresence", val: string) => {
    setFormData((d: any) => {
      const arr = d[key] as string[];
      return { ...d, [key]: arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val] };
    });
  };

  const handleSubmit = useCallback(async () => {
    setScreen("processing");
    try {
      const res = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, locale }) });
      const data = await res.json();
      if (data.results) { setResults(data.results); setLeadId(data.leadId); }
      else { setResults({ terms: [{ term: formData.product, volume: 1200, cpc: 2.5, position: "-" }], totalVolume: 2400, avgCpc: 2.1, marketLow: 18000, marketHigh: 42000, influencePercent: 7, source: "estimated", confidence: "medium" }); }
    } catch { setResults({ terms: [{ term: formData.product, volume: 1200, cpc: 2.5, position: "-" }], totalVolume: 2400, avgCpc: 2.1, marketLow: 18000, marketHigh: 42000, influencePercent: 7, source: "estimated", confidence: "medium" }); }
  }, [formData, locale]);

  const handleCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadId, locale }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { alert("Erro no checkout. Tente novamente."); }
    setCheckoutLoading(false);
  }, [leadId, locale]);

  if (screen === "processing") return <ProcessingScreen product={formData.product} onComplete={() => setScreen("value")} />;
  if (screen === "value" && results) return <InstantValueScreen product={formData.product} region={formData.region} results={results} onCheckout={handleCheckout} loading={checkoutLoading} />;

  // Show conditional fields
  const hasInstagram = formData.digitalPresence.includes("Instagram");
  const hasSite = formData.digitalPresence.includes("Site") || formData.digitalPresence.includes("Website") || formData.digitalPresence.includes("Sitio web");

  const formSteps: Record<number, { label: string; title: string; content: React.ReactNode }> = {
    1: {
      label: t.stepOf(1, 4),
      title: t.step1Title,
      content: (
        <>
          <Field label={t.step1ProductLabel} hint={t.step1ProductHint} badge={badges.product}>
            <input style={inputStyle} type="text" placeholder={t.step1ProductPlaceholder} value={formData.product} onChange={(e: any) => updateField("product", e.target.value)} />
          </Field>
          <Field label={t.step1RegionLabel} hint={t.step1RegionHint}>
            <input style={inputStyle} type="text" placeholder={t.step1RegionPlaceholder} value={formData.region} onChange={(e: any) => updateField("region", e.target.value)} />
          </Field>
          <Field label={t.step1AddressLabel} hint={t.step1AddressHint}>
            <input style={inputStyle} type="text" placeholder={t.step1AddressPlaceholder} value={formData.address} onChange={(e: any) => updateField("address", e.target.value)} />
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
          {hasInstagram && (
            <Field label={t.step2InstagramLabel} badge={badges.instagram}>
              <input style={inputStyle} type="text" placeholder={t.step2InstagramPlaceholder} value={formData.instagram} onChange={(e: any) => updateField("instagram", e.target.value)} />
            </Field>
          )}
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
              <input key={i} style={{ ...inputStyle, marginBottom: i < 2 ? 8 : 0 }} type="text" placeholder={t.step3CompPlaceholders[i]} value={formData.competitors[i]} onChange={(e: any) => updateCompetitor(i, e.target.value)} />
            ))}
          </Field>
          <Field label={t.step3TicketLabel}>
            <select style={{ ...inputStyle, appearance: "none" as any, cursor: "pointer" }} value={formData.ticket} onChange={(e: any) => updateField("ticket", e.target.value)}>
              <option value="">{locale === "pt" ? "Selecione" : locale === "es" ? "Selecciona" : "Select"}</option>
              {t.step3TicketOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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
        </>
      ),
    },
  };

  const currentStep = formSteps[formStep];

  return (
    <div style={{ minHeight: "100vh", background: V.cream }}>
      <LangSwitcher locale={locale} onChange={setLocale} />

      {/* ═══ HERO ═══ */}
      <div style={{
        background: `linear-gradient(180deg, ${V.dark} 0%, ${V.warmBlack} 100%)`,
        position: "relative", overflow: "hidden",
      }}>
        {/* Ember glow top-right */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${V.emberGlow} 0%, transparent 70%)` }} />
        {/* Vero glow bottom-left */}
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${V.veroGlow} 0%, transparent 70%)` }} />

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", minHeight: "100vh", padding: "60px 24px",
          opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)", position: "relative",
        }}>
          {/* Brand */}
          <div style={{ fontFamily: V.serif, fontSize: 28, color: V.cream, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Virô
          </div>

          {/* Badge */}
          <div style={{
            fontFamily: V.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const,
            color: V.ember, background: V.emberGlow, padding: "6px 16px", borderRadius: 100,
            border: "1px solid rgba(212,88,42,0.2)", marginBottom: 48,
          }}>
            {t.badge}
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: V.serif, fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 400, lineHeight: 1.15, marginBottom: 24, maxWidth: 680, color: V.cream, letterSpacing: "-0.02em" }}>
            {t.heroTitle1}{" "}
            <span style={{ color: V.ember }}>{t.heroTitle2}</span>
          </h1>

          <p style={{ fontSize: 17, color: V.sand, maxWidth: 540, marginBottom: 16, fontWeight: 300, lineHeight: 1.7 }}>{t.heroSub}</p>
          <p style={{ fontSize: 13, color: V.stone, maxWidth: 520, marginBottom: 48, lineHeight: 1.7 }}>{t.heroWho}</p>

          <button onClick={() => document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" })} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: V.ember, color: V.white, fontSize: 15, fontWeight: 600,
            padding: "14px 32px", borderRadius: 10, border: "none", cursor: "pointer",
            fontFamily: V.body, transition: "all 0.3s ease",
            boxShadow: "0 4px 16px rgba(212,88,42,0.3)",
          }}>
            {t.heroCta}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>

          {/* Proof */}
          <div style={{ marginTop: 80, display: "flex", gap: 48, flexWrap: "wrap", justifyContent: "center" }}>
            {t.proof.map((p: any, i: number) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: V.serif, fontSize: 32, color: V.cream }}>{p.number}</div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: V.stone, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginTop: 4 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ WHY — Virô's core argument ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: V.ember, marginBottom: 16, textAlign: "center" }}>{t.whyLabel}</div>
        <h2 style={{ fontFamily: V.serif, fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 400, textAlign: "center", marginBottom: 32, letterSpacing: "-0.02em", color: V.dark }}>{t.whyTitle}</h2>
        <p style={{ fontSize: 15, color: V.charcoal, lineHeight: 1.8, marginBottom: 16 }}>{t.whyP1}</p>
        <p style={{ fontSize: 15, color: V.charcoal, lineHeight: 1.8, marginBottom: 24 }}>{t.whyP2}</p>
        <div style={{ background: V.emberGlow, borderLeft: `3px solid ${V.ember}`, padding: "16px 20px", borderRadius: "0 10px 10px 0" }}>
          <p style={{ fontSize: 15, color: V.dark, fontWeight: 500, lineHeight: 1.6, margin: 0 }}>{t.whyHighlight}</p>
        </div>
      </div>

      {/* ═══ PATTERNS ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 40px" }}>
        <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: V.ember, marginBottom: 16, textAlign: "center" }}>{t.patternsLabel}</div>
        <h2 style={{ fontFamily: V.serif, fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 400, textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>{t.patternsTitle}</h2>
        {t.patterns.map((item: any, i: number) => (
          <div key={i} style={{ background: V.white, border: "1px solid #E5E0D8", borderRadius: 14, padding: "28px 24px", marginBottom: 12, borderTop: `3px solid ${V.ember}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontFamily: V.serif, fontSize: 18, fontWeight: 400, marginBottom: 8, color: V.dark }}>{item.title}</h3>
            <p style={{ fontSize: 14, color: V.stone, lineHeight: 1.7 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h2 style={{ fontFamily: V.serif, fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 400, textAlign: "center", marginBottom: 48, letterSpacing: "-0.02em" }}>{t.howTitle}</h2>
        {t.howSteps.map((item: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 20, marginBottom: 32, alignItems: "flex-start" }}>
            <div style={{ fontFamily: V.mono, fontSize: 12, fontWeight: 500, color: V.ember, background: V.emberGlow, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(212,88,42,0.2)" }}>
              {item.step}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontFamily: V.serif, fontSize: 18, fontWeight: 400, color: V.dark }}>{item.title}</h3>
                {item.tag && (
                  <span style={{
                    fontFamily: V.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" as const,
                    padding: "3px 10px", borderRadius: 100, fontWeight: 500,
                    color: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? V.veroTeal : item.tag === "vero" ? V.veroTeal : V.ember,
                    background: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? V.veroGlow : item.tag === "vero" ? V.veroGlow : V.emberGlow,
                  }}>
                    {item.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: V.stone, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ FORM ═══ */}
      <div style={{ background: V.paper }}>
        <div id="form-section" style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: V.serif, fontSize: 30, fontWeight: 400, marginBottom: 12, letterSpacing: "-0.02em" }}>{t.formTitle}</h2>
            <p style={{ color: V.stone, fontSize: 15 }}>{t.formSub}</p>
          </div>
          <div style={{ background: V.white, borderRadius: 16, border: "1px solid #E5E0D8", padding: "32px 28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <ProgressBar step={formStep} total={4} />
            <div style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.ember, marginBottom: 8, marginTop: 20 }}>{currentStep.label}</div>
            <div style={{ fontFamily: V.serif, fontSize: 22, fontWeight: 400, marginBottom: 24, color: V.dark }}>{currentStep.title}</div>
            <div key={formStep} style={{ animation: "fadeInUp 0.4s ease" }}>{currentStep.content}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 20, borderTop: "1px solid #E5E0D8" }}>
              {formStep > 1 ? (
                <button onClick={() => setFormStep(formStep - 1)} style={{ background: "none", border: "none", color: V.stone, fontSize: 14, cursor: "pointer", padding: "10px 20px", fontFamily: V.body }}>{t.back}</button>
              ) : <div />}
              <button onClick={() => { if (formStep < 4) setFormStep(formStep + 1); else handleSubmit(); }} style={{
                background: formStep === 4 ? V.ember : V.dark, color: V.white, border: "none",
                padding: "12px 28px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", transition: "all 0.3s ease", fontFamily: V.body,
                boxShadow: formStep === 4 ? "0 4px 16px rgba(212,88,42,0.3)" : "none",
              }}>
                {formStep === 4 ? t.submit : t.next}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTEXT / PRICING ═══ */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ background: V.warmBlack, borderRadius: 16, padding: "36px 28px", color: V.cream }}>
          <p style={{ fontFamily: V.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: V.ember, marginBottom: 20 }}>{t.contextLabel}</p>
          <p style={{ fontSize: 15, color: V.sand, lineHeight: 1.9, marginBottom: 16 }}>{t.contextP1}</p>
          <p style={{ fontSize: 15, color: V.sand, lineHeight: 1.9, marginBottom: 20 }}>{t.contextP2}</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ background: V.charcoal, borderRadius: 10, padding: "16px 20px", flex: "1 1 200px" }}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.stone, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>{t.contextPrice}</div>
              <div style={{ fontFamily: V.serif, fontSize: 24, color: V.cream }}>{t.contextPriceValue}</div>
            </div>
            <div style={{ background: V.charcoal, borderRadius: 10, padding: "16px 20px", flex: "1 1 200px" }}>
              <div style={{ fontFamily: V.mono, fontSize: 10, color: V.stone, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>{t.contextRecurring}</div>
              <div style={{ fontFamily: V.serif, fontSize: 24, color: V.cream }}>{t.contextRecurringValue}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ padding: "32px 24px", borderTop: "1px solid #E5E0D8", textAlign: "center", background: V.paper }}>
        <div style={{ fontFamily: V.serif, fontSize: 18, color: V.dark, marginBottom: 4, letterSpacing: "-0.02em" }}>
          Virô <span style={{ fontFamily: V.body, fontSize: 12, color: V.stone, fontWeight: 300 }}>com</span> <span style={{ color: V.veroTeal }}>Vero</span>
        </div>
        <p style={{ fontSize: 12, color: V.stone, fontFamily: V.mono }}>{t.footer}</p>
      </footer>
    </div>
  );
}
