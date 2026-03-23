"use client";

const V = {
  night: "#161618", zinc: "#6E6E78", ash: "#9E9EA8", fog: "#EAEAEE",
  cloud: "#F4F4F7", white: "#FEFEFF", amber: "#CF8523", teal: "#2D9B83",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
};

interface Props {
  lockLevel: 1 | 2;
  ctaLabel: string;
  ctaUrl: string;
}

export function LockedTab({ lockLevel, ctaLabel, ctaUrl }: Props) {
  return (
    <div style={{ position: "relative", minHeight: 300 }}>
      {/* Blurred preview content */}
      <div style={{
        filter: "blur(6px)", pointerEvents: "none", userSelect: "none",
      }}>
        <div style={{
          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
          padding: "20px 24px", marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: V.amber, fontWeight: 600, marginBottom: 8 }}>
            BLOCO 1
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 12 }}>
            Análise de posicionamento digital
          </div>
          <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
          </div>
        </div>
        <div style={{
          background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`,
          padding: "20px 24px", marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: V.amber, fontWeight: 600, marginBottom: 8 }}>
            BLOCO 2
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 12 }}>
            Oportunidades identificadas
          </div>
          <div style={{ fontSize: 14, color: V.zinc, lineHeight: 1.7 }}>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(244,244,247,0.7)", borderRadius: 14,
      }}>
        <div style={{
          background: V.white, borderRadius: 16, padding: "32px 40px",
          textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: 360,
        }}>
          <div style={{
            fontSize: 32, marginBottom: 12,
            lineHeight: 1,
          }}>
            {lockLevel === 1 ? "🔒" : "🔒🔒"}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 600, color: V.night, marginBottom: 8,
          }}>
            {lockLevel === 1
              ? "Disponível no Diagnóstico Completo"
              : "Disponível para Assinantes"}
          </div>
          <p style={{
            fontSize: 13, color: V.ash, marginBottom: 20, lineHeight: 1.5,
          }}>
            {lockLevel === 1
              ? "Desbloqueie o diagnóstico completo com análise detalhada, checklist de melhorias e conteúdos prontos para suas redes."
              : "Assine para receber conteúdos novos toda semana, acompanhamento contínuo e suporte prioritário."}
          </p>
          <a
            href={ctaUrl}
            style={{
              display: "inline-block", padding: "12px 28px", borderRadius: 10,
              background: lockLevel === 1 ? V.night : V.teal,
              color: V.white, fontSize: 14, fontWeight: 600,
              textDecoration: "none", transition: "opacity 0.15s",
            }}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
