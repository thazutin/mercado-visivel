"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState<LeadFormData>(initialFormData);
  const [leadId, setLeadId] = useState("");
  const [heroVisible, setHeroVisible] = useState(false);
  const [isNational, setIsNational] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { setTimeout(() => setHeroVisible(true), 200); }, []);

  const updateField = (key: keyof LeadFormData, val: any) => setFormData((d: any) => ({ ...d, [key]: val }));

  const handleSubmit = useCallback(async () => {
    if (honeypot || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // POST agora retorna {lead_id, status:"processing"} em <1s — o pipeline
      // roda em background no servidor via waitUntil. A gente redireciona
      // imediatamente para /resultado/[leadId] que mostra PollingScreen até
      // o status virar 'done' no DB. Se o usuário fechar a aba durante o
      // processing, não perde nada: o lead está salvo e o link do resultado
      // funciona quando voltar.
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.lead_id) {
        setSubmitError(
          data?.message || data?.error || "Erro ao iniciar diagnóstico. Tente novamente.",
        );
        setSubmitting(false);
        return;
      }
      setLeadId(data.lead_id);
      // router.push pra navegação real — Next.js monta o server component de
      // /resultado/[leadId] que vai renderizar o PollingScreen enquanto o
      // pipeline roda em background.
      router.push(`/resultado/${data.lead_id}`);
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.");
      setSubmitting(false);
    }
  }, [formData, honeypot, router, submitting]);

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
  // O POST dispara o pipeline em background e router.push imediatamente pra
  // /resultado/[leadId]. Enquanto a navegação acontece (<500ms), mostramos
  // um overlay mínimo pra não deixar o formulário "congelado sem feedback".
  if (submitting && !submitError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: V.night,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: `3px solid ${V.graphite}`,
            borderTopColor: V.amber,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: V.mist, fontSize: 14, fontFamily: V.body, margin: 0 }}>
          Ativando seu radar de crescimento...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
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

          {/* Seu mercado */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
            <Field label={t.formClientTargetLabel}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {t.formClientTargetOptions.map((opt: string) => {
                  const val = opt === "Pessoa física" ? "b2c" : opt === "Empresa" ? "b2b" : opt === "Governo" ? "b2g" : "mixed";
                  const selected = (formData as any).clientType === val;
                  return (
                    <button key={val} type="button" onClick={() => updateField("clientType" as any, val)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                        border: `1.5px solid ${selected ? V.amber : V.fog}`,
                        background: selected ? V.amberWash : V.white,
                        color: selected ? V.night : V.zinc,
                        transition: "all 0.15s",
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t.formSalesChannelLabel}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {t.formSalesChannelOptions.map((opt: string) => {
                  const channelMap: Record<string, string> = {
                    "Loja física": "loja_fisica",
                    "Online / e-commerce": "online",
                    "Prestação de serviço": "servico",
                    "Marketplace (iFood, Mercado Livre, etc)": "marketplace",
                    "Direto (WhatsApp, telefone)": "direto",
                  };
                  const val = channelMap[opt] || "servico";
                  const selected = (formData as any).salesChannel === val;
                  return (
                    <button key={val} type="button" onClick={() => updateField("salesChannel" as any, val)}
                      style={{
                        padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                        border: `1.5px solid ${selected ? V.amber : V.fog}`,
                        background: selected ? V.amberWash : V.white,
                        color: selected ? V.night : V.zinc,
                        textAlign: "left", transition: "all 0.15s",
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Ticket médio */}
          <Field label="Ticket médio de uma venda (R$)" hint="Aproximado — ajuda a dimensionar seu mercado">
            <input style={inputStyle} type="text" inputMode="numeric" placeholder="Ex: 150"
              value={formData.ticket}
              onChange={(e: any) => updateField("ticket", e.target.value)} />
          </Field>

          {/* Onde quer crescer */}
          <Field label="Se você pudesse resolver uma coisa agora, seria:">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Meu cliente voltar mais vezes", value: "frequencia" },
                { label: "Meu cliente comprar mais itens por compra", value: "cross_sell" },
                { label: "Tirar clientes dos meus concorrentes", value: "market_share" },
                { label: "Ser encontrado por quem ainda não me conhece mas já compra o que vendo", value: "awareness" },
                { label: "Vender pra um público diferente do atual", value: "novo_segmento" },
                { label: "Abrir em novas regiões ou cidades", value: "expansao_geo" },
                { label: "Vender por um canal novo (online, delivery, marketplace)", value: "novo_canal" },
                { label: "Lançar um produto ou serviço novo", value: "novo_produto" },
              ].map(({ label, value }) => {
                const selected = formData.challenge === value;
                return (
                  <button key={value} type="button" onClick={() => updateField("challenge", value)}
                    style={{
                      padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                      border: `1.5px solid ${selected ? V.amber : V.fog}`,
                      background: selected ? V.amberWash : V.white,
                      color: selected ? V.night : V.zinc,
                      textAlign: "left", transition: "all 0.15s",
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Presença digital */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 4 }}>Sua presença digital</div>
            <p style={{ fontSize: 12, color: V.ash, margin: "0 0 16px", lineHeight: 1.4 }}>
              Opcional — quanto mais, mais personalizado o diagnóstico.
            </p>
            <Field label="Instagram">
              <input style={inputStyle} type="text" placeholder="@seunegocio" value={formData.instagram}
                onChange={(e: any) => updateField("instagram", e.target.value)} />
            </Field>
            {(formData as any).clientType === 'b2b' && (
              <Field label="LinkedIn">
                <input style={inputStyle} type="text" placeholder="linkedin.com/company/seunegocio" value={(formData as any).linkedin || ""}
                  onChange={(e: any) => updateField("linkedin" as any, e.target.value)} />
              </Field>
            )}

            {/* Campos condicionais por canal de venda */}
            {(formData as any).salesChannel === 'marketplace' && (
              <Field label="Seu perfil no Mercado Livre" hint="Link direto — ex: mercadolivre.com.br/perfil/SEUNOME">
                <input style={inputStyle} type="text" placeholder="mercadolivre.com.br/perfil/seunegocio"
                  value={(formData as any).mercadoLivreUrl || ""}
                  onChange={(e: any) => updateField("mercadoLivreUrl" as any, e.target.value)} />
              </Field>
            )}

            {/* iFood: mostra se marketplace OU produto parece food */}
            {((formData as any).salesChannel === 'marketplace' || /restaurante|lanchonete|pizzaria|hamburgue|doceria|padaria|café|cafeteria|açaí|sushi|food|delivery|cozinha|buffet|sorveteria|pastelaria|bar /i.test(formData.product || '')) && (
              <Field label="Seu link no iFood" hint="Link direto — ex: ifood.com.br/delivery/cidade/seu-restaurante">
                <input style={inputStyle} type="text" placeholder="ifood.com.br/delivery/..."
                  value={(formData as any).ifoodUrl || ""}
                  onChange={(e: any) => updateField("ifoodUrl" as any, e.target.value)} />
              </Field>
            )}

            <Field label="Site">
              <input style={inputStyle} type="text" placeholder="www.seunegocio.com.br" value={formData.site}
                onChange={(e: any) => updateField("site", e.target.value)} />
            </Field>
          </div>
        </>
      ),
    },
    2: {
      title: "Onde enviamos seu diagnóstico",
      content: (
        <>
          <p style={{ fontSize: 13, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>
            Resultado sai em 60 segundos. Enviamos também por email.
          </p>
          <Field label={`${t.formEmailLabel} *`}>
            <input style={inputStyle} type="email" placeholder={t.formEmailPlaceholder} value={formData.email}
              onChange={(e: any) => updateField("email", e.target.value)} />
          </Field>
          <Field label={t.formWhatsappLabel} hint="Opcional">
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
          {/* Estandarte (pennant) — compacto, max ~20% da viewport */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{
              background: V.cloud,
              clipPath: "polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%)",
              padding: "12px 22px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <img
                src="/viro-logo.svg"
                alt="Virô"
                style={{ display: "block", height: 88, width: "auto" }}
              />
            </div>
          </div>
          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "24px 0 16px", lineHeight: 1.2,
          }}>
            Seu mercado mapeado. <span style={{ color: V.amber }}>Tudo pronto pra crescer.</span>
          </h1>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.6, margin: 0 }}>
            Dados reais, ações prontas, conteúdo pra copiar e colar. Grátis em 60 segundos.
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
            { title: "Seu radar de crescimento analisa o mercado", text: "Cruzamos Google, Maps, Instagram, iFood, Reclame Aqui, IBGE e mais 12 fontes pra mapear sua posição, seus concorrentes e sua oportunidade real." },
            { title: "Você recebe o diagnóstico grátis", text: "Quantos clientes você pode ter a mais por mês, quem disputa com você e o que está te impedindo de crescer." },
            { title: "Tudo pronto pra você executar", text: "Ações com passo a passo, conteúdo pronto pra copiar e colar, e um plano com metas claras — baseado nos dados reais do SEU mercado." },
            { title: "Radar ativo toda semana — R$247/mês", text: "Monitoramento contínuo, ações atualizadas e materiais prontos toda semana. Seu marketing no piloto automático." },
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
          Pra qualquer negócio que quer crescer
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 12px" }}>
          Restaurantes, clínicas, e-commerces, agências, B2B, energia, agro, criadores de conteúdo — 25 segmentos com fontes de dados e ações específicas pro seu mercado.
        </p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
          Se você quer saber onde estão seus próximos clientes, o que seus concorrentes estão fazendo, e ter um plano pronto pra executar — sem contratar equipe e sem gastar mais em mídia — Virô é seu radar de crescimento.
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
          <div style={{ background: V.cloud, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, letterSpacing: "0.08em", marginBottom: 8 }}>DIAGNÓSTICO GRATUITO · 60 SEGUNDOS · EXEMPLO ILUSTRATIVO</div>
            <div style={{ fontFamily: V.display, fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 16 }}>Qual fatia do seu mercado você disputa?</div>

            {/* Score Ring */}
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 16px" }}>
              <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={60} cy={60} r={54} fill="none" stroke={V.fog} strokeWidth={5} />
                <circle cx={60} cy={60} r={54} fill="none" stroke={V.amber} strokeWidth={5} strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 - (29 / 100) * 339} />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 800, color: V.night }}>29</div>
                <div style={{ fontFamily: V.mono, fontSize: 8, color: V.ash }}>de 100</div>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              <div style={{ padding: "8px 4px", background: V.white, borderRadius: 6 }}>
                <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 800, color: V.amber }}>29</div>
                <div style={{ fontSize: 9, color: V.ash }}>Você hoje</div>
              </div>
              <div style={{ padding: "8px 4px", background: V.white, borderRadius: 6 }}>
                <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 800, color: V.teal }}>64</div>
                <div style={{ fontSize: 9, color: V.ash }}>Potencial</div>
              </div>
              <div style={{ padding: "8px 4px", background: V.white, borderRadius: 6 }}>
                <div style={{ fontFamily: V.display, fontSize: 18, fontWeight: 800, color: V.zinc }}>42</div>
                <div style={{ fontSize: 9, color: V.ash }}>Média mercado</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: V.zinc, lineHeight: 1.6, margin: 0 }}>
              Você disputa <strong>29%</strong> da demanda. Concorrentes em ~42%. Com as ações certas, chegar a <strong style={{ color: V.teal }}>64%</strong> é viável em 90 dias.
            </p>
          </div>

          {/* ─── BLOCO 2: RADAR ─── */}
          <div style={{ padding: "24px", borderTop: `2px solid ${V.amber}` }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", marginBottom: 12 }}>RADAR DE CRESCIMENTO · R$247/MÊS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: V.night, marginBottom: 16 }}>Seu radar detecta, analisa e entrega tudo pronto</div>

            {/* Exemplo 1: Oportunidade detectada */}
            <div style={{ background: V.amberWash, borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: `1px solid ${V.amber}30` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14 }}>📡</span>
                <div>
                  <p style={{ fontSize: 13, color: V.night, margin: "0 0 4px", fontWeight: 600 }}>Seu radar detectou:</p>
                  <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.5 }}>3 concorrentes não respondem avaliações. Nenhum posta no Instagram há 2 semanas. Oportunidade clara de se destacar agora.</p>
                </div>
              </div>
            </div>

            {/* Exemplo 2: Ação pronta */}
            <div style={{ background: V.cloud, borderRadius: 12, padding: "16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Responder 17 avaliações do Google</span>
                <span style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, background: V.white, padding: "2px 8px", borderRadius: 100 }}>~10 min</span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 10px" }}>Sua nota: 3.8★ — meta: 4.5★. Respostas aumentam confiança em 40% e geram mais avaliações.</p>
              <div style={{ background: V.white, borderRadius: 8, padding: "12px", borderLeft: `3px solid ${V.amber}` }}>
                <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, marginBottom: 6 }}>PRONTO PRA COPIAR</div>
                <p style={{ fontSize: 12, color: V.night, margin: "0 0 4px", lineHeight: 1.5 }}>
                  "Muito obrigado pelo feedback, João! Ficamos felizes que tenha gostado. Esperamos você de volta — Equipe Studio Fitness"
                </p>
                <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontStyle: "italic" }}>+ 16 respostas personalizadas prontas</p>
              </div>
            </div>

            {/* Exemplo 3: Post pronto */}
            <div style={{ background: V.cloud, borderRadius: 12, padding: "16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Post Instagram pronto pra publicar</span>
                <span style={{ fontSize: 10, color: "#E1306C", fontWeight: 600, background: "rgba(225,48,108,0.08)", padding: "2px 8px", borderRadius: 100 }}>Feed</span>
              </div>
              <div style={{ background: V.white, borderRadius: 8, padding: "12px", borderLeft: `3px solid ${V.amber}` }}>
                <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.5 }}>
                  "Campinas tem mais de 200 academias. Só 12 oferecem pilates com acompanhamento individual. Aqui no Studio Fitness, cada aluno tem um plano personalizado desde o primeiro dia..."
                </p>
              </div>
            </div>
          </div>

          {/* ─── BLOCO 3: AÇÕES SEMANAIS ─── */}
          <div style={{ padding: "24px", borderTop: `2px solid ${V.slate}`, background: V.cloud }}>
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.slate, letterSpacing: "0.06em", marginBottom: 12 }}>MONITORAMENTO SEMANAL · INCLUSO</div>
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

      {/* ═══ CARROSSEL — Exemplos por segmento ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>exemplos reais</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          O que a Virô entrega pra cada segmento
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: "0 0 24px" }}>
          Cada negócio recebe ações específicas pro seu mercado.
        </p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory" as const }}>
          {[
            { icon: "🍽️", segment: "Pizzaria Artesanal", region: "Sumarezinho, SP", type: "free", score: 29, benchmark: 38, insight: "88 avaliações no Google sem resposta. 3 concorrentes no raio de 500m respondem todas.", action: "Respostas prontas pra 88 reviews no tom do negócio" },
            { icon: "💇", segment: "Barbearia", region: "Savassi, BH", type: "radar", score: 22, benchmark: 35, insight: "@barbearia tem 340 seguidores e 0 posts no mês. Concorrente @cortecerto: 2.100 seg, 12 posts.", action: "Bio otimizada + 12 posts prontos + 4 roteiros de reels" },
            { icon: "⚖️", segment: "Escritório de Advocacia", region: "Centro, Florianópolis", type: "free", score: 41, benchmark: 33, insight: "'advogado trabalhista florianópolis': 320 buscas/mês. Posição 12 — fora da primeira página.", action: "Artigo SEO otimizado pro termo + ajustes na ficha Google" },
            { icon: "⚡", segment: "Comercializadora de Energia", region: "Nacional", type: "radar", score: 8, benchmark: 22, insight: "142 empresas elegíveis no mercado livre em SP. 3 licitações abertas no PNCP esta semana.", action: "Paper do setor + 6 posts LinkedIn + jornada de 6 emails" },
            { icon: "📡", segment: "Provedor de Internet", region: "Campos do Jordão, SP", type: "radar", score: 68, benchmark: 35, insight: "Líder local com 340 reviews. São Luiz do Paraitinga tem 1 ISP com score 15 — expansão viável.", action: "Comparativo de 5 cidades + plano de lançamento São Luiz" },
            { icon: "🏥", segment: "Clínica de Estética", region: "Tatuapé, SP", type: "free", score: 19, benchmark: 30, insight: "Nota 3.8 no Google vs média 4.4 do setor. 12 reviews negativos sobre atendimento.", action: "Respostas pra reviews negativos + mensagem WhatsApp pós-atendimento" },
            { icon: "🐾", segment: "Pet Shop", region: "Boa Viagem, Recife", type: "radar", score: 33, benchmark: 30, insight: "Nenhum concorrente local posta no Instagram mais que 2x/mês. Oportunidade de se destacar.", action: "Calendário semanal de posts + parcerias com 3 veterinárias" },
            { icon: "🎨", segment: "Criadora de Conteúdo", region: "Nacional", type: "free", score: 14, benchmark: 25, insight: "'artesanato macramê' tem 1.900 buscas/mês. Seus reels alcançam 200 pessoas — potencial: 15x mais.", action: "Bio otimizada + 3 termos SEO + estrutura de loja online" },
          ].map((card, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 280, scrollSnapAlign: "start" as const,
              background: V.white, borderRadius: 14, border: `1px solid ${card.type === 'radar' ? V.amber : V.fog}`,
              padding: "20px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V.night }}>{card.segment}</div>
                    <div style={{ fontSize: 10, color: V.ash }}>{card.region}</div>
                  </div>
                </div>
                <span style={{
                  fontFamily: V.mono, fontSize: 9, padding: "2px 8px", borderRadius: 100,
                  background: card.type === 'radar' ? V.amberWash : V.tealWash,
                  color: card.type === 'radar' ? V.amber : V.teal, fontWeight: 700,
                }}>
                  {card.type === 'radar' ? 'RADAR' : 'GRÁTIS'}
                </span>
              </div>
              <div style={{
                display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10,
              }}>
                <div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: V.night, fontFamily: V.display }}>{card.score}</span>
                  <span style={{ fontSize: 11, color: V.ash }}>/100</span>
                </div>
                <span style={{ fontSize: 10, color: card.score >= card.benchmark ? V.teal : V.amber, fontFamily: V.mono }}>
                  média {card.benchmark}
                </span>
              </div>
              <p style={{ fontSize: 12, color: V.zinc, lineHeight: 1.5, margin: "0 0 12px", minHeight: 54 }}>
                {card.insight}
              </p>
              <div style={{
                background: V.cloud, borderRadius: 8, padding: "8px 10px",
                borderLeft: `3px solid ${card.type === 'radar' ? V.amber : V.teal}`,
              }}>
                <div style={{ fontFamily: V.mono, fontSize: 8, color: V.ash, letterSpacing: "0.04em", marginBottom: 2 }}>
                  AÇÃO PRONTA
                </div>
                <p style={{ fontSize: 11, color: V.night, margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                  {card.action}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ SECTION 5 — O QUE VOCÊ RECEBE (simplificado) ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>o que você recebe</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 28px", lineHeight: 1.25 }}>
          Um produto. Dois níveis.
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Grátis */}
          <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "24px", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: "0.06em", fontWeight: 600 }}>DIAGNÓSTICO GRATUITO · 60 SEGUNDOS</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.teal, fontWeight: 700 }}>R$0</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>Seu mercado mapeado com dados reais.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>Score com benchmark do setor, gap de mercado, análise de concorrentes, termos de busca reais, audiência estimada e ações rápidas prontas pra executar.</p>
          </div>
          {/* Radar R$247/mês */}
          <div style={{ background: V.white, borderRadius: 14, border: `2px solid ${V.amber}`, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", fontWeight: 600 }}>RADAR DE CRESCIMENTO · CANCELE QUANDO QUISER</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.amber, fontWeight: 700 }}>R$247/mês</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>Seu marketing montado + radar semanal do mercado.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: "0 0 12px" }}>Ações prontas com texto pra copiar e colar, conteúdo personalizado pro seu segmento, monitoramento do mercado e materiais novos toda semana.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {['Ações rápidas', 'Pilares estratégicos', 'Copy pronto', 'Radar semanal', '25 segmentos', '12+ fontes de dados'].map((tag, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 600, color: V.amber, background: V.amberWash, padding: "3px 8px", borderRadius: 4 }}>{tag}</span>
              ))}
            </div>
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
          Não adivinhamos — coletamos. Virô cruza Google, Maps, Instagram, iFood, Reclame Aqui, IBGE, Google Trends e mais fontes reais pra montar a leitura do seu mercado. Dados reais, não palpites de IA.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {[
            "Google Search", "Google Maps", "Google Places API", "Google Ads",
            "Instagram", "Perplexity AI", "DataForSEO",
            "IBGE", "PNCP", "CNPJá", "Receita Federal", "Hunter.io",
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
          { q: "Quanto custa?", a: "O diagnóstico é gratuito e já entrega ações práticas pro seu negócio. O Radar custa R$247/mês — inclui tudo pronto pra você executar: ações, conteúdo, monitoramento semanal. Cancele quando quiser, sem fidelidade." },
          { q: "O que eu recebo com o Radar?", a: "Ações prontas com texto pra copiar (otimização do Google, bio do Instagram, respostas a reviews), conteúdo personalizado pro seu setor, monitoramento semanal do mercado e dos concorrentes, e sazonalidade — tudo atualizado toda semana." },
          { q: "Em quanto tempo fico com o plano pronto?", a: "O diagnóstico inicial leva cerca de 60 segundos. Após o pagamento, o plano completo é gerado em 2 a 5 minutos e fica disponível no painel — você também recebe o link por email." },
          { q: "O Virô faz por mim ou só me mostra o caminho?", a: "Hoje o Virô monta a operação inteira — posts prontos, respostas a reviews, papers, roteiros, emails, tudo com copy pronto pra copiar e usar. Em breve, o Agente Nelson vai executar direto no Google, Instagram e WhatsApp com sua autorização. Começa como copiloto, vira piloto automático." },
          { q: "Funciona para qualquer tipo de negócio?", a: "Sim. Virô tem 25 blueprints de segmento — restaurantes, clínicas, e-commerce, B2B, energia, agro, criadores de conteúdo, provedores de internet e mais. Cada segmento recebe fontes de dados, ações e canais específicos pro seu mercado." },
          { q: "E se meu negócio ainda não aparece no Google Maps?", a: "O diagnóstico funciona mesmo assim. Analisamos a demanda real e a concorrência do seu raio independentemente do seu perfil — e o plano vai indicar exatamente o que fazer para você aparecer." },
          { q: "Meus dados são seguros?", a: "Sim. O Virô só coleta dados públicos do seu negócio (não dados de clientes), opera dentro da LGPD, e nunca vende, aluga ou compartilha seus dados com terceiros. A política completa está em /privacidade." },
        ].map((faq, i) => (
          <FAQItem key={i} question={faq.q} answer={faq.a} />
        ))}
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: V.night, padding: "40px 24px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
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
          <div style={{
            marginTop: 28, paddingTop: 24,
            borderTop: `1px solid rgba(255,255,255,0.08)`,
            fontSize: 11, color: V.slate, lineHeight: 1.7, textAlign: "left" as const,
          }}>
            <p style={{ margin: "0 0 8px" }}>
              <strong style={{ color: V.ash }}>Dados reais + metodologia Virô.</strong>{" "}
              Todos os números exibidos são coletados em tempo real de fontes públicas e
              processados por metodologia proprietária que combina cruzamentos, benchmarks
              setoriais e inferência por modelos de linguagem.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              <strong style={{ color: V.ash }}>Marketing é probabilístico, não determinístico.</strong>{" "}
              As recomendações do Virô aumentam a <em>probabilidade</em> de resultado — não o
              garantem. Fatores externos ao Virô (concorrência, execução, preço, experiência,
              algoritmos de terceiros) influenciam o resultado final.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: V.ash }}>Execução é do usuário.</strong>{" "}
              O Virô não se responsabiliza por resultados específicos de faturamento, ranking,
              captação de clientes ou qualquer indicador comercial decorrente da aplicação das
              recomendações. Detalhes completos em <a href="/termos" style={{ color: V.amber, textDecoration: "none" }}>Termos de Serviço</a>.
            </p>
          </div>
          <p style={{ fontSize: 12, color: V.slate, marginTop: 24 }}>
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
