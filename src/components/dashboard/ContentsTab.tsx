"use client";

import { useEffect, useState } from "react";

import { V } from "@/lib/design-tokens";

const CHANNEL_LABELS: Record<string, { icon: string; color: string }> = {
  instagram_feed: { icon: "📸", color: "#E1306C" },
  instagram_stories: { icon: "📱", color: "#833AB4" },
  google_business: { icon: "📍", color: "#4285F4" },
  whatsapp_status: { icon: "💬", color: "#25D366" },
};

interface Content {
  id: string;
  channel: string;
  channel_key: string;
  content: string;
  hashtags: string[];
  best_time: string;
  tip: string;
  image_url?: string | null;
  status: string;
  created_at: string;
}

interface Props {
  leadId: string;
  showUpgradeBanner?: boolean;
}

export function ContentsTab({ leadId, showUpgradeBanner }: Props) {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchContents().then((items) => {
      // Se não há conteúdos, inicia polling automático (conteúdos podem estar sendo gerados)
      if (items.length === 0) {
        setPolling(true);
      }
    });
  }, [leadId]);

  // Polling: a cada 10s por até 2 minutos
  useEffect(() => {
    if (!polling) return;
    let attempts = 0;
    const maxAttempts = 12; // 12 * 10s = 2min
    const interval = setInterval(async () => {
      attempts++;
      const items = await fetchContents();
      if (items.length > 0 || attempts >= maxAttempts) {
        setPolling(false);
        clearInterval(interval);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [polling, leadId]);

  async function fetchContents(): Promise<Content[]> {
    try {
      const res = await fetch(`/api/contents?leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.contents || [];
        setContents(items);
        return items;
      }
    } catch (err) {
      console.error("Erro ao carregar conteúdos:", err);
    } finally {
      setLoading(false);
    }
    return [];
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/contents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) {
        await fetchContents();
      }
    } catch (err) {
      console.error("Erro ao gerar conteúdos:", err);
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div style={{
        background: V.white, borderRadius: 14, padding: "40px 24px",
        textAlign: "center", border: `1px solid ${V.fog}`,
      }}>
        <p style={{ fontSize: 14, color: V.ash }}>Carregando conteúdos...</p>
      </div>
    );
  }

  if (contents.length === 0) {
    // Se está em polling ou gerando, mostra estado intermediário
    if (polling || generating) {
      return (
        <div style={{
          background: V.white, borderRadius: 14, padding: "40px 24px",
          textAlign: "center", border: `1px solid ${V.fog}`,
        }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${V.fog}`,
            borderTopColor: V.amber, borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 15, color: V.zinc, marginBottom: 4 }}>
            Seus conteúdos estão sendo gerados...
          </p>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>
            Isso pode levar até 2 minutos. Não precisa sair desta página.
          </p>
        </div>
      );
    }

    return (
      <div style={{
        background: V.white, borderRadius: 14, padding: "40px 24px",
        textAlign: "center", border: `1px solid ${V.fog}`,
      }}>
        <p style={{ fontSize: 15, color: V.zinc, marginBottom: 8 }}>
          Nenhum conteúdo gerado ainda.
        </p>
        <p style={{ fontSize: 13, color: V.ash, marginBottom: 20 }}>
          Gere posts prontos para suas redes sociais com IA.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: "12px 28px", borderRadius: 10, border: "none",
            background: V.night, color: V.white, fontSize: 14,
            fontWeight: 600, cursor: generating ? "not-allowed" : "pointer",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Gerando..." : "Gerar conteúdos"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Upgrade banner for paid (non-subscriber) users */}
      {showUpgradeBanner && (
        <div style={{
          background: "rgba(45,155,131,0.06)", border: "1px solid rgba(45,155,131,0.15)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <p style={{ fontSize: 13, color: V.zinc, margin: 0, flex: 1 }}>
            Estes conteúdos foram gerados com base no seu diagnóstico. Assine para receber novos conteúdos toda sexta-feira.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/checkout/subscription", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ leadId }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }
              } catch (err) {
                console.error("Erro ao iniciar checkout:", err);
              }
            }}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: V.teal, color: V.white, fontSize: 13,
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Assinar por R$99/mês
          </button>
        </div>
      )}

      {/* Header com botão de regerar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: V.ash }}>
          {contents.length} posts gerados
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${V.fog}`,
            background: V.white, color: V.zinc, fontSize: 12,
            fontWeight: 500, cursor: generating ? "not-allowed" : "pointer",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Gerando..." : "Gerar novos"}
        </button>
      </div>

      {/* Cards de conteúdo */}
      {contents.map((c) => {
        const ch = CHANNEL_LABELS[c.channel_key] || { icon: "📝", color: V.ash };
        const fullText = c.hashtags?.length
          ? `${c.content}\n\n${c.hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}`
          : c.content;

        return (
          <div key={c.id} style={{
            background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
            padding: "20px 24px", marginBottom: 12,
          }}>
            {/* Channel badge + best time */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 12px", borderRadius: 100,
                background: `${ch.color}12`, fontSize: 12, fontWeight: 500,
                color: ch.color,
              }}>
                <span>{ch.icon}</span> {c.channel}
              </div>
              {c.best_time && (
                <span style={{ fontSize: 11, color: V.ash, fontFamily: V.mono }}>
                  {c.best_time}
                </span>
              )}
            </div>

            {/* Image */}
            {c.image_url ? (
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: "hidden" }}>
                <img
                  src={c.image_url}
                  alt={`Imagem para ${c.channel}`}
                  style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
                />
              </div>
            ) : (c.channel_key === "instagram_feed" || c.channel_key === "instagram_stories") ? (
              <div style={{
                marginBottom: 12, borderRadius: 10, height: 200,
                background: V.cloud, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 13, color: V.ash }}>Imagem sendo gerada...</span>
              </div>
            ) : null}

            {/* Content */}
            <div style={{
              fontSize: 14, color: V.zinc, lineHeight: 1.7,
              whiteSpace: "pre-wrap", marginBottom: 12,
            }}>
              {c.content}
            </div>

            {/* Hashtags */}
            {c.hashtags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {c.hashtags.map((h, i) => (
                  <span key={i} style={{
                    fontSize: 12, color: V.teal, background: "rgba(45,155,131,0.08)",
                    padding: "2px 8px", borderRadius: 6,
                  }}>
                    {h.startsWith("#") ? h : `#${h}`}
                  </span>
                ))}
              </div>
            )}

            {/* Tip */}
            {c.tip && (
              <div style={{
                padding: "10px 14px", background: V.cloud, borderRadius: 8,
                borderLeft: `3px solid ${V.amber}`, fontSize: 13,
                color: V.zinc, marginBottom: 12,
              }}>
                <strong style={{ color: V.night, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Dica:
                </strong>{" "}
                {c.tip}
              </div>
            )}

            {/* Copy button */}
            <button
              onClick={() => copyToClipboard(fullText, c.id)}
              style={{
                padding: "8px 16px", borderRadius: 8, border: `1px solid ${V.fog}`,
                background: copied === c.id ? V.teal : V.white,
                color: copied === c.id ? V.white : V.zinc,
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied === c.id ? "Copiado!" : "Copiar texto"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
