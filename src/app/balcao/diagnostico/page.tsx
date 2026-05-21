"use client";

// ============================================================================
// /balcao/diagnostico — Form especializado pro franqueado Balcão Urbano
//
// Campos adaptados ao perfil de vending operator + prospecção B2B.
// Mapeia internamente pro schema Zod existente (LeadFormData) e marca
// source="balcao" pra rastrear no funil.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { V } from "@/lib/design-tokens";
import { initialFormData } from "@/lib/schema";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: 10,
  border: `1px solid ${V.fog}`, fontSize: 15, fontFamily: V.body,
  color: V.night, background: V.cloud, outline: "none",
  transition: "border-color 0.15s",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: V.ash, margin: "-2px 0 8px", lineHeight: 1.4 }}>{hint}</p>}
      {children}
    </div>
  );
}

// Places Autocomplete (igual ao da homepage)
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(text: string) {
    onChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(text)}&sessiontoken=${sessionToken}`);
        const data = await res.json();
        setSuggestions(data.predictions || []);
        setShowDropdown((data.predictions || []).length > 0);
      } catch { /* ignore */ }
    }, 300);
  }

  async function handleSelect(prediction: { description: string; place_id: string }) {
    onChange(prediction.description);
    setShowDropdown(false);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/places-details?place_id=${encodeURIComponent(prediction.place_id)}&sessiontoken=${sessionToken}`);
      const data = await res.json();
      if (data.lat && data.lng) onPlaceSelected({ address: data.address || prediction.description, placeId: data.placeId || prediction.place_id, lat: data.lat, lng: data.lng });
    } catch { /* ignore */ }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text" value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder} style={inputStyle} autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: V.white, border: `1px solid ${V.fog}`, borderRadius: 10, marginTop: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          {suggestions.map((s, i) => (
            <div key={s.place_id} onClick={() => handleSelect(s)} style={{ padding: "12px 16px", fontSize: 13, color: V.night, cursor: "pointer", borderBottom: i < suggestions.length - 1 ? `1px solid ${V.fog}` : "none" }}>
              {s.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BalcaoForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState({
    name: "",
    region: "",
    address: "",
    placeId: "",
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    // Campos específicos vending operator
    pontosAtuais: "",         // quantos pontos opera
    tipoPontos: "",           // metro / empresa / hospital / outro
    desafio: "",              // mais pontos / consumo / abrir porta decisor
    instagram: "",
    email: "",
    whatsapp: "",
    whatsappOptin: false,
  });

  const update = (k: keyof typeof data, v: any) => setData((d) => ({ ...d, [k]: v }));

  const handlePlace = useCallback((place: { address: string; placeId: string; lat: number; lng: number }) => {
    setData((d) => ({ ...d, address: place.address, region: place.address, placeId: place.placeId, lat: place.lat, lng: place.lng }));
  }, []);

  const isStep1Valid = data.name.length >= 2 && data.region.length >= 2 && !!data.lat && data.pontosAtuais && data.desafio;
  const isStep2Valid = data.email.includes("@") && data.email.length >= 5;

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    // Mapeia campos balcao → schema padrão LeadFormData
    const challengeMap: Record<string, string> = {
      mais_pontos: "expansao_geo",
      consumo: "frequencia",
      decisor: "market_share",
      lancar_operacao: "awareness",
    };
    const productLabel = `Operação Balcão Urbano${data.tipoPontos ? ` (${data.tipoPontos})` : ""}`;
    const freeTextDesc = [
      `Franqueado Balcão Urbano com ${data.pontosAtuais} ponto(s) ativo(s).`,
      data.tipoPontos ? `Tipo de pontos: ${data.tipoPontos}.` : null,
      `Desafio principal: ${data.desafio}.`,
    ].filter(Boolean).join(" ");

    const payload = {
      ...initialFormData,
      businessName: data.name,
      product: productLabel,
      region: data.region,
      address: data.address,
      placeId: data.placeId,
      lat: data.lat,
      lng: data.lng,
      clientType: "b2b" as const,           // franqueado vende pra empresas (RH/Facilities)
      salesChannel: "direto" as const,
      ticket: "300",                          // estimativa média mensal por ponto — ajustável
      challenge: challengeMap[data.desafio] || "expansao_geo",
      instagram: data.instagram,
      email: data.email,
      whatsapp: data.whatsapp,
      whatsappOptin: data.whatsappOptin,
      freeText: freeTextDesc,
      customerDescription: "Empresas com fluxo de pessoas: Metro, galpões logísticos, hospitais, empresas com muitos funcionários.",
      source: "balcao",                       // marcação custom — backend filtra/anota
    };

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.lead_id) {
        setSubmitError(result?.message || result?.error || "Erro ao iniciar diagnóstico. Tente novamente.");
        setSubmitting(false);
        return;
      }
      router.push(`/resultado/${result.lead_id}`);
    } catch (err) {
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.");
      setSubmitting(false);
    }
  }

  // Loading overlay
  if (submitting && !submitError) {
    return (
      <div style={{ minHeight: "100vh", background: V.night, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "32px 20px" }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${V.graphite}`, borderTopColor: V.amber, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: V.mist, fontSize: 14, margin: 0 }}>Ativando seu radar de prospecção…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: V.white }}>
      {/* Hero compacto */}
      <div style={{ background: V.night, padding: "44px 24px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", borderRadius: 100, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 18 }}>
            <span style={{ fontFamily: V.display, fontSize: 12, fontWeight: 700, color: V.white }}>Balcão Urbano</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: V.amber }} />
            <span style={{ fontFamily: V.display, fontSize: 12, fontWeight: 700, color: V.white }}>Virô<span style={{ color: V.teal }}>.</span></span>
          </div>
          <h1 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.white, letterSpacing: "-0.02em", margin: "0 0 8px", lineHeight: 1.2 }}>
            Seu diagnóstico estratégico — 60 segundos.
          </h1>
          <p style={{ fontSize: 13, color: V.ash, margin: 0, lineHeight: 1.55 }}>
            Quanto mais específico, mais cirúrgico o plano.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div style={{ maxWidth: 480, margin: "-20px auto 0", padding: "0 20px 48px" }}>
        <div style={{ background: V.white, borderRadius: 16, border: `1px solid ${V.fog}`, padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Progress */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
            {[1, 2].map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? V.amber : V.fog, transition: "background 0.3s" }} />
            ))}
          </div>

          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            Passo {step} de 2
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: V.night, marginBottom: 24 }}>
            {step === 1 ? "Sua operação" : "Onde enviamos o diagnóstico"}
          </div>

          {step === 1 && (
            <>
              <Field label="Seu nome *">
                <input style={inputStyle} type="text" placeholder="Ex: João Silva" value={data.name} onChange={(e) => update("name", e.target.value)} />
              </Field>

              <Field label="Sua cidade ou região de atuação *" hint="Selecione uma sugestão do dropdown do Google para o diagnóstico ficar preciso.">
                <PlacesAutocomplete
                  value={data.region}
                  onChange={(val) => { update("region", val); if (data.lat || data.lng) setData((d) => ({ ...d, lat: undefined, lng: undefined, placeId: "" })); }}
                  onPlaceSelected={handlePlace}
                  placeholder="Ex: São Paulo, SP"
                />
              </Field>

              <Field label="Quantos pontos você opera hoje? *">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: "Ainda não tenho — vou começar", value: "0" },
                    { label: "1 a 2", value: "1_2" },
                    { label: "3 a 5", value: "3_5" },
                    { label: "6 a 10", value: "6_10" },
                    { label: "Mais de 10", value: "10_plus" },
                  ].map((opt) => {
                    const selected = data.pontosAtuais === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => update("pontosAtuais", opt.value)}
                        style={{
                          padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                          border: `1.5px solid ${selected ? V.amber : V.fog}`,
                          background: selected ? V.amberWash : V.white,
                          color: selected ? V.night : V.zinc, transition: "all 0.15s",
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Tipo de ponto que mais quer atrair">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Empresas com muitos funcionários (escritórios)",
                    "Galpões logísticos e indústrias",
                    "Hospitais e clínicas",
                    "Metrô, estações e terminais",
                    "Universidades e escolas",
                    "Misto / ainda estou avaliando",
                  ].map((opt) => {
                    const selected = data.tipoPontos === opt;
                    return (
                      <button key={opt} type="button" onClick={() => update("tipoPontos", opt)}
                        style={{
                          padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                          border: `1.5px solid ${selected ? V.amber : V.fog}`,
                          background: selected ? V.amberWash : V.white,
                          color: selected ? V.night : V.zinc, transition: "all 0.15s",
                        }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Se você pudesse resolver UMA coisa agora, seria: *">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "Encontrar mais pontos premium na minha região", value: "mais_pontos" },
                    { label: "Aumentar consumo nos pontos que já tenho", value: "consumo" },
                    { label: "Abrir a porta do decisor (RH/Facilities) das empresas-alvo", value: "decisor" },
                    { label: "Lançar minha operação — ainda não tenho pontos", value: "lancar_operacao" },
                  ].map((opt) => {
                    const selected = data.desafio === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => update("desafio", opt.value)}
                        style={{
                          padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                          border: `1.5px solid ${selected ? V.amber : V.fog}`,
                          background: selected ? V.amberWash : V.white,
                          color: selected ? V.night : V.zinc, transition: "all 0.15s",
                        }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: V.night, marginBottom: 4 }}>Sua presença digital</div>
                <p style={{ fontSize: 12, color: V.ash, margin: "0 0 16px", lineHeight: 1.4 }}>
                  Opcional. Se você tem Instagram da operação, a Virô analisa o que já está funcionando.
                </p>
                <Field label="Instagram" hint="Ex: @suaoperacaobalcao">
                  <input style={inputStyle} type="text" placeholder="@seuusername ou instagram.com/seuusername" value={data.instagram} onChange={(e) => update("instagram", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ fontSize: 13, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>
                Resultado sai em ~60 segundos. Enviamos também por email.
              </p>
              <Field label="Email *">
                <input style={inputStyle} type="email" placeholder="seu@email.com" value={data.email} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <Field label="WhatsApp" hint="Opcional, mas recomendado — o WhatsApp é o canal do acompanhamento semanal.">
                <input style={inputStyle} type="tel" placeholder="(11) 9 9999-9999" value={data.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
              </Field>

              {data.whatsapp && data.whatsapp.replace(/\D/g, "").length >= 10 && (
                <div style={{ marginTop: 8, marginBottom: 16, background: V.amberWash, borderRadius: 10, padding: "14px 16px", border: `1px solid rgba(180,83,9,0.18)` }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={data.whatsappOptin} onChange={(e) => update("whatsappOptin", e.target.checked)} style={{ width: 16, height: 16, marginTop: 3, accentColor: V.amber, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: V.night, marginBottom: 4, lineHeight: 1.4 }}>
                        Autorizo o acompanhamento estratégico semanal pelo WhatsApp.
                      </div>
                      <p style={{ fontSize: 12, color: V.zinc, margin: 0, lineHeight: 1.55 }}>
                        Sexta: abertura da prioridade. Terça: checagem de execução. Quinta: balanço.
                        Você responde quando for possível. Sai quando quiser respondendo PARE.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </>
          )}

          {submitError && (
            <div style={{ background: "rgba(217,90,79,0.08)", border: `1px solid rgba(217,90,79,0.25)`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#9F2D24", marginBottom: 16 }}>
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, paddingTop: 16, borderTop: `1px solid ${V.fog}` }}>
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", color: V.ash, fontSize: 14, cursor: "pointer", padding: "10px 16px" }}>
                ← Voltar
              </button>
            ) : (
              <Link href="/balcao" style={{ color: V.ash, fontSize: 13, textDecoration: "none" }}>← Sobre a Virô</Link>
            )}
            <button
              onClick={() => {
                if (step < 2) {
                  if (isStep1Valid) setStep(2);
                } else {
                  if (isStep2Valid) handleSubmit();
                }
              }}
              disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
              style={{
                background: step === 2 ? V.amber : V.white,
                color: step === 2 ? V.white : V.night,
                border: step === 2 ? "none" : `2px solid ${V.night}`,
                padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                cursor: (step === 1 ? isStep1Valid : isStep2Valid) ? "pointer" : "not-allowed",
                opacity: (step === 1 ? isStep1Valid : isStep2Valid) ? 1 : 0.4,
                transition: "all 0.15s",
              }}
            >
              {step === 2 ? "Receber meu diagnóstico" : "Próximo →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
