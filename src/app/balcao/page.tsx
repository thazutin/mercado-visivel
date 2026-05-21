// ============================================================================
// /balcao — Landing page Balcão Urbano × Virô
//
// Audiência: franqueado de vending machine Balcão Urbano.
// Perfil: empreendedor iniciante, renda complementar, 3 pontos em média,
// quer crescer encontrando pontos premium (Metro, galpões, hospitais,
// empresas grandes) e abrindo porta do decisor (RH/Facilities).
// Virada estratégica: ser BUSCADO em vez de prospectar (awareness local).
// ============================================================================

import Link from "next/link";
import { V } from "@/lib/design-tokens";

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

export default function BalcaoLanding() {
  return (
    <div style={{ minHeight: "100vh", background: V.white }}>

      {/* ═══ HERO ═══ */}
      <div style={{ background: V.night, padding: "60px 24px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          {/* Co-branding badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "8px 18px", borderRadius: 100,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            marginBottom: 28,
          }}>
            <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.white, letterSpacing: "-0.01em" }}>
              Balcão Urbano
            </span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: V.amber }} />
            <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.white, letterSpacing: "-0.01em" }}>
              Virô<span style={{ color: V.teal }}>.</span>
            </span>
          </div>

          <h1 style={{
            fontFamily: V.display, fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 700,
            color: V.white, letterSpacing: "-0.03em", margin: "0 0 18px", lineHeight: 1.15,
          }}>
            Sua máquina precisa estar <span style={{ color: V.amber }}>na cabeça das empresas certas</span> antes de você bater na porta.
          </h1>
          <p style={{ fontSize: 16, color: V.ash, lineHeight: 1.65, margin: "0 0 28px" }}>
            A Virô é a consultora estratégica de marketing dos franqueados Balcão Urbano. Mapeia pontos premium na sua região, identifica decisores e monta a estratégia de conteúdo pra fazer as empresas <strong style={{ color: V.white }}>te procurarem</strong>.
          </p>

          <Link href="/balcao/diagnostico" style={{
            display: "inline-block", background: V.amber, color: V.white,
            padding: "14px 32px", borderRadius: 10,
            fontSize: 15, fontWeight: 700, textDecoration: "none",
          }}>
            Diagnóstico gratuito em 60s →
          </Link>
          <p style={{ fontSize: 12, color: V.slate, margin: "14px 0 0" }}>
            Exclusivo para franqueados Balcão Urbano · Sem cadastro de cartão
          </p>
        </div>
      </div>

      {/* ═══ PRA QUEM É ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>é pra você</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 16px", lineHeight: 1.25 }}>
          Franqueado Balcão Urbano que quer crescer com método.
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: "0 0 16px" }}>
          Você juntou capital, abriu sua operação Balcão Urbano e está em busca de pontos premium —
          Metrôs, hospitais, galpões logísticos, empresas com muitos funcionários. Sabe que cada ponto
          bem escolhido muda a economia da sua máquina.
        </p>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.7, margin: 0 }}>
          O problema não é o produto — Balcão Urbano resolveu isso. O desafio é{" "}
          <strong style={{ color: V.night }}>chegar nos pontos certos e abrir a porta do decisor</strong>{" "}
          (RH, Facilities, Operações) que diz sim. E quando você não tem um pitch de marketing pronto, é fácil cair em "tentar conhecidos e torcer".
        </p>
      </Section>

      {/* ═══ O QUE A VIRÔ ENTREGA ═══ */}
      <Section bg={V.white}>
        <SectionLabel>o que entregamos</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 32px", lineHeight: 1.2 }}>
          Três frentes que mudam o jogo do seu marketing.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Frente 1 — Mapeamento */}
          <div style={{ background: V.cloud, borderRadius: 14, padding: "22px 22px", border: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: V.amberWash, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontSize: 18,
              }}>📍</div>
              <div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", fontWeight: 700, marginBottom: 4 }}>
                  FRENTE 1 · MAPEAMENTO
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: V.night, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                  Pontos premium da sua região, com decisor identificado.
                </h3>
                <p style={{ fontSize: 13, color: V.zinc, margin: 0, lineHeight: 1.6 }}>
                  Cruzamos CNPJá + Receita Federal + Hunter.io + Google Maps pra mapear as empresas
                  com perfil ideal (porte, número de funcionários, setor) no raio que você opera —
                  com o nome e contato do decisor de cada uma. Você não prospecta no escuro.
                </p>
              </div>
            </div>
          </div>

          {/* Frente 2 — Abordagem */}
          <div style={{ background: V.cloud, borderRadius: 14, padding: "22px 22px", border: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: V.tealWash, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontSize: 18,
              }}>🤝</div>
              <div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: "0.06em", fontWeight: 700, marginBottom: 4 }}>
                  FRENTE 2 · ABORDAGEM
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: V.night, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                  Script de abordagem pronto, personalizado por empresa.
                </h3>
                <p style={{ fontSize: 13, color: V.zinc, margin: 0, lineHeight: 1.6 }}>
                  Cada empresa-alvo recebe um pitch ajustado: mensagem de LinkedIn pro decisor,
                  email frio, roteiro pra ligação. Você fala com confiança porque a proposta já está
                  ancorada na realidade daquela empresa específica — não é texto genérico.
                </p>
              </div>
            </div>
          </div>

          {/* Frente 3 — Awareness */}
          <div style={{ background: V.cloud, borderRadius: 14, padding: "22px 22px", border: `1px solid ${V.fog}` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "rgba(225,48,108,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                fontSize: 18,
              }}>📢</div>
              <div>
                <div style={{ fontFamily: V.mono, fontSize: 10, color: "#E1306C", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 4 }}>
                  FRENTE 3 · AWARENESS LOCAL
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: V.night, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                  Conteúdo semanal pra empresas chegarem em você.
                </h3>
                <p style={{ fontSize: 13, color: V.zinc, margin: 0, lineHeight: 1.6 }}>
                  Roteiros e textos prontos pra Instagram e LinkedIn — focados em decisor corporativo.
                  Quando RH e Facilities da sua região começarem a ver o seu conteúdo, a equação
                  inverte: <strong style={{ color: V.night }}>elas te procuram antes de você procurar.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ A VIRADA ═══ */}
      <Section bg={V.night}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>
            a virada
          </div>
          <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700, color: V.white, letterSpacing: "-0.02em", margin: "0 0 18px", lineHeight: 1.25 }}>
            Prospectar é caro. <span style={{ color: V.amber }}>Ser procurado é diferente.</span>
          </h2>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.7, margin: "0 0 16px", maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
            Todo franqueado Balcão Urbano que está crescendo entendeu a mesma coisa:
            o ponto mais rentável da carteira veio porque a empresa procurou eles, não o contrário.
            Foi indicação, foi um post visto, foi um cliente impactado.
          </p>
          <p style={{ fontSize: 15, color: V.ash, lineHeight: 1.7, margin: 0, maxWidth: 540, marginLeft: "auto", marginRight: "auto" }}>
            A Virô estrutura isso. Em vez de você bater porta a porta, monta sua presença pra que
            as empresas certas comecem a olhar pra você — toda semana, com método.
          </p>
        </div>
      </Section>

      {/* ═══ COMO FUNCIONA ═══ */}
      <Section bg={V.cloud}>
        <SectionLabel>como funciona</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 28px", lineHeight: 1.25 }}>
          Diagnóstico grátis hoje. Acompanhamento semanal pra quem decidir crescer com método.
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { num: "1", title: "Conte sobre sua operação em 60s", text: "Onde você atende, quantos pontos tem hoje, perfil que mais quer atrair, principal desafio. Quanto mais específico, mais cirúrgico o plano." },
            { num: "2", title: "Recebe seu diagnóstico estratégico — grátis", text: "Mapa de empresas-alvo na sua região, decisores identificados, 3 teses de crescimento, scripts de abordagem, checklist do básico." },
            { num: "3", title: "Acompanhamento semanal pelo WhatsApp", text: "Sexta — abertura da semana com a prioridade da vez. Terça — checagem de execução. Quinta — balanço e captura de aprendizado. Tudo evolutivo." },
          ].map((step, i) => (
            <div key={i} style={{ background: V.white, borderRadius: 14, padding: "20px", border: `1px solid ${V.fog}`, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ fontFamily: V.mono, fontSize: 12, fontWeight: 700, color: V.amber, background: V.amberWash, width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {step.num}
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: V.night, marginBottom: 4 }}>{step.title}</div>
                <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ PRICING ═══ */}
      <Section bg={V.white}>
        <SectionLabel>preço</SectionLabel>
        <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.25 }}>
          Diagnóstico grátis. Acompanhamento sob condições especiais Balcão Urbano.
        </h2>
        <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: "0 0 28px" }}>
          Valor exclusivo para a rede — bem abaixo da consultoria estratégica de mercado.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: V.white, borderRadius: 14, border: `1px solid ${V.fog}`, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.teal, letterSpacing: "0.06em", fontWeight: 600 }}>DIAGNÓSTICO ESTRATÉGICO</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.teal, fontWeight: 700 }}>R$0</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>O frame estratégico de marketing que franqueado nenhum recebeu antes.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: 0 }}>
              Mapeamento da sua região, identificação de decisores, 3 teses de crescimento com passo
              a passo, scripts de abordagem prontos e checklist do básico. Sem cadastro de cartão.
            </p>
          </div>

          <div style={{ background: V.white, borderRadius: 14, border: `2px solid ${V.amber}`, padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: V.mono, fontSize: 10, color: V.amber, letterSpacing: "0.06em", fontWeight: 600 }}>RADAR BALCÃO · CANCELE QUANDO QUISER</span>
              <span style={{ fontFamily: V.mono, fontSize: 11, color: V.amber, fontWeight: 700 }}>R$97/mês*</span>
            </div>
            <p style={{ fontSize: 14, color: V.night, fontWeight: 600, margin: "0 0 6px" }}>Sua consultora estratégica no WhatsApp, toda semana.</p>
            <p style={{ fontSize: 13, color: V.zinc, lineHeight: 1.6, margin: "0 0 14px" }}>
              Sexta abre a semana com a prioridade da vez. Terça checagem. Quinta balanço.
              Cada ciclo evolui com base no que você executou.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {['Mapa de pontos', 'Decisores nominados', 'Scripts prontos', 'WhatsApp 6ª/3ª/5ª', 'Conteúdo semanal IG/LinkedIn', 'Memória crescente'].map((tag, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 600, color: V.amber, background: V.amberWash, padding: "3px 8px", borderRadius: 4 }}>{tag}</span>
              ))}
            </div>
            <p style={{ fontSize: 11, color: V.ash, margin: "14px 0 0", fontStyle: "italic" }}>
              *Valor proposta — sujeito a ajuste após reunião com a Balcão Urbano.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══ CTA FINAL ═══ */}
      <Section bg={V.cloud}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontFamily: V.display, fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 700, color: V.night, letterSpacing: "-0.02em", margin: "0 0 16px", lineHeight: 1.25 }}>
            Comece com o diagnóstico estratégico — grátis.
          </h2>
          <p style={{ fontSize: 15, color: V.zinc, lineHeight: 1.6, margin: "0 0 28px", maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            60 segundos pra contar sobre sua operação. Em poucos minutos você recebe o mapeamento
            da sua região e as primeiras alavancas para crescer.
          </p>
          <Link href="/balcao/diagnostico" style={{
            display: "inline-block", background: V.amber, color: V.white,
            padding: "16px 36px", borderRadius: 10,
            fontSize: 16, fontWeight: 700, textDecoration: "none",
          }}>
            Quero meu diagnóstico →
          </Link>
        </div>
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ background: V.night, padding: "40px 24px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.white }}>Balcão Urbano</span>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: V.amber }} />
            <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.white }}>
              Virô<span style={{ color: V.teal }}>.</span>
            </span>
          </div>
          <p style={{ fontSize: 12, color: V.slate, margin: 0, lineHeight: 1.6 }}>
            Parceria piloto · Consultoria estratégica de marketing exclusiva para a rede
          </p>
        </div>
      </footer>
    </div>
  );
}
