"use client";

import { useState, useEffect, useCallback } from "react";
import ProgressBar from "@/components/ProgressBar";
import ProcessingScreen from "@/components/ProcessingScreen";
import InstantValueScreen from "@/components/InstantValueScreen";
import { initialFormData, type LeadFormData } from "@/lib/schema";
import pt, { dictionaries, type Locale } from "@/lib/i18n";

const T = {
  bg: "#0a0a0f",
  bgCard: "#111118",
  accent: "#f0a030",
  accentGlow: "rgba(240, 160, 48, 0.13)",
  accentSoft: "#f7c46c",
  green: "#00d4aa",
  greenGlow: "rgba(0, 212, 170, 0.15)",
  text: "#e8e8f0",
  textMuted: "#8888a0",
  textDim: "#555568",
  border: "#222233",
  mono: "'Space Mono', monospace",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  color: T.text,
  fontSize: 15,
  fontFamily: "'DM Sans', sans-serif",
  transition: "all 0.3s ease",
  outline: "none",
};

function Field({ label, hint, badge, children }: { label?: string; hint?: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textMuted, marginBottom: 6 }}>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>{hint}</div>}
      {badge && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 12px", borderRadius: 100, marginTop: 8, background: T.greenGlow, color: T.green, border: "1px solid rgba(0,212,170,0.2)", animation: "fadeInUp 0.3s ease" }}>
          ✓ {badge}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button type="button" key={opt} onClick={() => onToggle(opt)} style={{
            padding: "10px 18px", background: active ? T.accentGlow : T.bgCard,
            border: `1px solid ${active ? T.accent : T.border}`, borderRadius: 100,
            color: active ? T.accent : T.textMuted, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", transition: "all 0.2s ease",
          }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Language Switcher ──────────────────────────────────────────────────
function LangSwitcher({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  const langs: { code: Locale; label: string }[] = [
    { code: "pt", label: "PT" },
    { code: "en", label: "EN" },
    { code: "es", label: "ES" },
  ];
  return (
    <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100, display: "flex", gap: 4, background: "rgba(10,10,15,0.8)", borderRadius: 100, padding: 3, border: `1px solid ${T.border}`, backdropFilter: "blur(10px)" }}>
      {langs.map((l) => (
        <button key={l.code} onClick={() => onChange(l.code)} style={{
          fontFamily: T.mono, fontSize: 10, letterSpacing: 1, padding: "6px 12px",
          borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.2s",
          background: locale === l.code ? T.accent : "transparent",
          color: locale === l.code ? "#fff" : T.textDim,
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

  // Auto-detect locale from browser
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = navigator.language?.toLowerCase() || "";
      const isBrazil = tz.startsWith("America/Sao_Paulo") || tz.startsWith("America/Fortaleza") || tz.startsWith("America/Recife") || tz.startsWith("America/Bahia") || tz.startsWith("America/Belem") || tz.startsWith("America/Manaus") || tz.startsWith("America/Cuiaba") || tz.startsWith("America/Porto_Velho") || tz.startsWith("America/Rio_Branco") || tz.startsWith("America/Noronha") || lang.startsWith("pt-br");
      const isSpanish = !isBrazil && (lang.startsWith("es") || tz.startsWith("America/Argentina") || tz.startsWith("America/Mexico") || tz.startsWith("America/Bogota") || tz.startsWith("America/Santiago") || tz.startsWith("America/Lima") || tz.startsWith("Europe/Madrid"));
      if (isBrazil) setLocale("pt");
      else if (isSpanish) setLocale("es");
      else setLocale("en");
    } catch { /* fallback to pt */ }
  }, []);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  useEffect(() => {
    const b: Record<string, string> = {};
    if (formData.instagram.length > 5) b.instagram = locale === "pt" ? "Perfil encontrado" : locale === "es" ? "Perfil encontrado" : "Profile found";
    if (formData.site.length > 10) b.site = locale === "pt" ? "Site acessível" : locale === "es" ? "Sitio accesible" : "Site accessible";
    if (formData.product.length > 5) b.product = locale === "pt" ? "Demanda validada na região" : locale === "es" ? "Demanda validada en la zona" : "Demand validated in region";
    setBadges(b);
  }, [formData.instagram, formData.site, formData.product, locale]);

  const updateField = (key: keyof LeadFormData, val: any) => setFormData((d) => ({ ...d, [key]: val }));
  const updateCompetitor = (idx: number, val: string) => {
    const c = [...formData.competitors]; c[idx] = val;
    setFormData((d) => ({ ...d, competitors: c }));
  };
  const toggleArray = (key: "channels" | "digitalPresence", val: string) => {
    setFormData((d) => {
      const arr = d[key] as string[];
      return { ...d, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  };

  const handleSubmit = useCallback(async () => {
    setScreen("processing");
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, locale }),
      });
      const data = await res.json();
      if (data.results) { setResults(data.results); setLeadId(data.lead_id); }
    } catch (err) { console.error("Diagnose failed:", err); }
  }, [formData, locale]);

  const handleProcessingComplete = useCallback(() => { if (results) setScreen("value"); }, [results]);

  const handleCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: leadId, locale }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { console.error("Checkout failed:", err); setCheckoutLoading(false); }
  }, [leadId]);

  if (screen === "processing") return <><LangSwitcher locale={locale} onChange={setLocale} /><ProcessingScreen product={formData.product} onComplete={handleProcessingComplete} /></>;
  if (screen === "value" && results) return <><LangSwitcher locale={locale} onChange={setLocale} /><InstantValueScreen product={formData.product} region={formData.region} results={results} onCheckout={handleCheckout} loading={checkoutLoading} /></>;

  // ─── Form Steps (redesigned: business-first, inclusive) ───────────
  const formSteps: Record<number, { label: string; title: string; content: React.ReactNode }> = {
    1: {
      label: t.stepOf(1, 4),
      title: t.step1Title,
      content: (
        <>
          <Field label={t.step1ProductLabel} hint={t.step1ProductHint} badge={badges.product}>
            <input style={inputStyle} type="text" placeholder={t.step1ProductPlaceholder} value={formData.product} onChange={(e) => updateField("product", e.target.value)} />
          </Field>
          <Field label={t.step1RegionLabel} hint={t.step1RegionHint}>
            <input style={inputStyle} type="text" placeholder={t.step1RegionPlaceholder} value={formData.region} onChange={(e) => updateField("region", e.target.value)} />
          </Field>
          <Field label={t.step1AddressLabel} hint={t.step1AddressHint}>
            <input style={inputStyle} type="text" placeholder={t.step1AddressPlaceholder} value={formData.address} onChange={(e) => updateField("address", e.target.value)} />
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
            <MultiSelect options={t.step2Channels} selected={formData.channels} onToggle={(v) => toggleArray("channels", v)} />
          </Field>
          <Field label={t.step2PresenceLabel} hint={t.step2PresenceHint}>
            <MultiSelect options={t.step2PresenceOptions} selected={formData.digitalPresence} onToggle={(v) => toggleArray("digitalPresence", v)} />
          </Field>
          {formData.digitalPresence.includes("Instagram") && (
            <Field label={t.step2InstagramLabel} badge={badges.instagram}>
              <input style={inputStyle} type="text" placeholder={t.step2InstagramPlaceholder} value={formData.instagram} onChange={(e) => updateField("instagram", e.target.value)} />
            </Field>
          )}
          {(formData.digitalPresence.includes("Site") || formData.digitalPresence.includes("Website") || formData.digitalPresence.includes("Sitio web")) && (
            <Field label={t.step2SiteLabel} badge={badges.site}>
              <input style={inputStyle} type="url" placeholder={t.step2SitePlaceholder} value={formData.site} onChange={(e) => updateField("site", e.target.value)} />
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
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder={t.step3DiffPlaceholder} value={formData.differentiator} onChange={(e) => updateField("differentiator", e.target.value)} />
          </Field>
          <Field label={t.step3CompLabel} hint={t.step3CompHint}>
            {[0, 1, 2].map((i) => (
              <input key={i} style={{ ...inputStyle, marginBottom: i < 2 ? 8 : 0 }} type="text" placeholder={t.step3CompPlaceholders[i]} value={formData.competitors[i]} onChange={(e) => updateCompetitor(i, e.target.value)} />
            ))}
          </Field>
          <Field label={t.step3TicketLabel}>
            <select style={{ ...inputStyle, appearance: "none" as any, cursor: "pointer" }} value={formData.ticket} onChange={(e) => updateField("ticket", e.target.value)}>
              <option value="">{locale === "pt" ? "Selecione" : locale === "es" ? "Selecciona" : "Select"}</option>
              {t.step3TicketOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <select style={{ ...inputStyle, appearance: "none" as any, cursor: "pointer" }} value={formData.challenge} onChange={(e) => updateField("challenge", e.target.value)}>
              <option value="">{locale === "pt" ? "Selecione" : locale === "es" ? "Selecciona" : "Select"}</option>
              {t.step4Challenges.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t.step4EmailLabel}>
            <input style={inputStyle} type="email" placeholder={t.step4EmailPlaceholder} value={formData.email} onChange={(e) => updateField("email", e.target.value)} />
          </Field>
        </>
      ),
    },
  };

  const currentStep = formSteps[formStep];

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <LangSwitcher locale={locale} onChange={setLocale} />

      {/* ═══ HERO ═══ */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "100vh", padding: "40px 24px", opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(20px)", transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: T.accent, background: T.accentGlow, padding: "8px 20px", borderRadius: 100, border: "1px solid rgba(240,160,48,0.25)", marginBottom: 40 }}>
          {t.badge}
        </div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 700, lineHeight: 1.1, marginBottom: 24, maxWidth: 700 }}>
          {t.heroTitle1}{" "}
          <span style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accentSoft})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {t.heroTitle2}
          </span>
        </h1>
        <p style={{ fontSize: 18, color: T.textMuted, maxWidth: 560, marginBottom: 20 }}>{t.heroSub}</p>
        <p style={{ fontSize: 14, color: T.textDim, maxWidth: 520, marginBottom: 48 }}>{t.heroIcp}</p>
        <button onClick={() => document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" })} style={{ display: "inline-flex", alignItems: "center", gap: 12, background: T.accent, color: "#fff", fontSize: 16, fontWeight: 600, padding: "16px 36px", borderRadius: 100, border: "none", cursor: "pointer", transition: "all 0.3s ease" }}>
          {t.heroCta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
        <div style={{ marginTop: 80, display: "flex", gap: 48 }}>
          {t.proof.map((p, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: T.mono, fontSize: 28, fontWeight: 700, color: T.green }}>{p.number}</div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PATTERNS ═══ */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px 40px" }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: T.accent, marginBottom: 16, textAlign: "center" }}>{t.patternsLabel}</div>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, textAlign: "center", marginBottom: 48 }}>{t.patternsTitle}</h2>
        {t.patterns.map((item, i) => (
          <div key={i} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "28px 24px", marginBottom: 12, display: "flex", gap: 20 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, textAlign: "center", marginBottom: 48 }}>{t.howTitle}</h2>
        {t.howSteps.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 20, marginBottom: 32, alignItems: "flex-start" }}>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, background: T.accentGlow, width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(240,160,48,0.25)" }}>
              {item.step}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{item.title}</h3>
                {item.tag && (
                  <span style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? T.green : T.accent, background: item.tag === "grátis" || item.tag === "free" || item.tag === "gratis" ? T.greenGlow : T.accentGlow, padding: "3px 8px", borderRadius: 100 }}>
                    {item.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ FORM ═══ */}
      <div id="form-section" style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>{t.formTitle}</h2>
          <p style={{ color: T.textMuted, fontSize: 15 }}>{t.formSub}</p>
        </div>
        <ProgressBar step={formStep} total={4} />
        <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>{currentStep.label}</div>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>{currentStep.title}</div>
        <div key={formStep} style={{ animation: "fadeInUp 0.4s ease" }}>{currentStep.content}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 36, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
          {formStep > 1 ? (
            <button onClick={() => setFormStep(formStep - 1)} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 14, cursor: "pointer", padding: "10px 20px" }}>{t.back}</button>
          ) : <div />}
          <button onClick={() => { if (formStep < 4) setFormStep(formStep + 1); else handleSubmit(); }} style={{ background: formStep === 4 ? T.green : T.accent, color: "#fff", border: "none", padding: "12px 32px", borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "all 0.3s ease" }}>
            {formStep === 4 ? t.submit : t.next}
          </button>
        </div>
      </div>

      {/* ═══ CONTEXT ═══ */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "36px 28px" }}>
          <p style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: T.accent, marginBottom: 20 }}>{t.contextLabel}</p>
          <p style={{ fontSize: 15, color: T.textMuted, lineHeight: 1.9, marginBottom: 16 }}>{t.contextP1}</p>
          <p style={{ fontSize: 15, color: T.textMuted, lineHeight: 1.9, marginBottom: 16 }}>{t.contextP2}</p>
          <p style={{ fontSize: 15, color: T.text, lineHeight: 1.9 }}>
            {t.contextPrice} <strong>{t.contextPriceValue}</strong>. {t.contextRecurring} <strong>{t.contextRecurringValue}</strong>.
          </p>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ padding: 32, borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: T.textDim }}>© 2026 Mercado Visível · {t.footer}</p>
      </footer>
    </div>
  );
}
