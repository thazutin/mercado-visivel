"use client";

import { useState, useEffect } from "react";
import AnimatedCounter from "./AnimatedCounter";
import FeedbackWidget from "./FeedbackWidget";
import { NelsonLogo } from "./NelsonLogo";

const V = {
  night: "#161618", graphite: "#232326", slate: "#3A3A40",
  zinc: "#6E6E78", ash: "#9E9EA8", mist: "#C8C8D0",
  fog: "#EAEAEE", cloud: "#F4F4F7", white: "#FEFEFF",
  amber: "#CF8523", amberSoft: "#E6A445",
  amberWash: "rgba(207,133,35,0.08)",
  teal: "#2D9B83", tealWash: "rgba(45,155,131,0.08)",
  coral: "#D9534F", coralWash: "rgba(217,83,79,0.08)",
  display: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  body: "'Satoshi', 'General Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

interface TermData { term: string; volume: number; cpc: number; position: string; intent?: string; serpFeatures?: string[]; }
interface Results {
  terms: TermData[]; totalVolume: number; avgCpc: number;
  marketLow: number; marketHigh: number; influencePercent: number;
  source: string; confidence: string; gapHeadline?: string;
  termGeneration?: { count: number };
  influenceBreakdown?: {
    google: number;
    instagram: number;
    web: number | null;
    levers?: Array<{
      dimension: 'alcance' | 'descoberta' | 'credibilidade';
      action: string;
      impact: number;
      effort: 'baixo' | 'médio' | 'alto';
      horizon: '1-2 semanas' | '1-2 meses' | '3-6 meses';
      currentValue?: string;
      targetValue?: string;
    }>;
  };
  maps?: { found: boolean; rating: number | null; reviewCount: number | null; categories: string[]; inLocalPack: boolean; photos: number };
  instagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes: number; avgViews: number; recentPostsCount?: number; recentAvgReach?: number; dataAvailable: boolean };
  competitorInstagram?: { handle: string; followers: number; engagementRate: number; postsLast30d: number; avgLikes?: number; avgViews?: number }[];
  serpSummary?: { termsScraped: number; termsRanked: number; hasLocalPack: boolean; hasAds: boolean };
  pipeline?: { version: string; durationMs: number; sourcesUsed: string[]; sourcesUnavailable: string[] };
  gaps?: any[]; gapPattern?: any;
  workRoutes?: { priority: number; title: string; rationale: string; connection: string; horizon: string; expectedImpact: string }[];
  aiVisibility?: { score: number; summary: string; likelyMentioned: boolean; factors: any[]; competitorMentions: any[] } | null;
  audiencia?: {
    populacaoRaio: number; raioKm: number | null; densidade: string;
    municipioNome: string; targetProfile: string; estimatedPercentage: number;
    audienciaTarget: number; rationale: string; ibgeAno?: number;
  } | null;
  competitionIndex?: {
    totalCompetitors: number; activeCompetitors: number; totalSearchVolume: number;
    indexValue: number; label: 'subatendido' | 'equilibrado' | 'saturado';
    labelText: string; color: 'green' | 'yellow' | 'red';
    competitors: { name: string; hasWebsite: boolean; hasInstagram: boolean; mapsPosition?: number; rating?: number; reviewCount?: number }[];
  } | null;
  lat?: number | null;
  lng?: number | null;
  clientType?: 'b2c' | 'b2b' | 'b2g';
  volumeGeo?: { level: string; label: string } | null;
  pncp?: {
    totalEncontradas: number; valorTotalEstimado: number;
    modalidades: { modalidade: string; count: number }[];
    orgaosUnicos: number; periodoConsultado: string;
    contratacoes: { objeto: string; orgaoEntidade: string; valorEstimado: number; modalidade: string }[];
  } | null;
  projecaoFinanceira?: {
    buscasNoRaio: number;
    receitaAtual: number;
    receitaPotencial: number;
    gapCaptura: number;
    clientesAtual: number;
    clientesPotencial: number;
    clientesGap: number;
    audienciaTarget: number;
    familiasAtual: number;
    familiasPotencial: number;
    familiasGap: number;
    mercadoTotal: number;
    posicaoLider: number | null;
    receitaLider: number | null;
    nomeLider: string | null;
    influenciaAtual: number;
    influenciaMeta: number;
    ticketMedio: number;
    taxaConversao: number;
    ticketRationale: string;
    geoAdjustedVolume: number;
    gapMensal?: number;
    buscasNoTarget?: number;
  } | null;
}
interface Props { product: string; region: string; results: Results; onCheckout: (coupon?: string) => void; loading?: boolean; leadId?: string; hideCTA?: boolean; hideWorkRoutes?: boolean; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPop(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 2 ? `${m.toFixed(1).replace(".", ",")} milhões` : `${m.toFixed(1).replace(".", ",")} milhão`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return n.toLocaleString("pt-BR");
}

function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `R$${Math.round(n / 1_000)}k`;
  return `R$${n.toLocaleString('pt-BR')}`;
}

function inferIntent(term: string, isB2B?: boolean): { label: string; color: string } {
  const t = term.toLowerCase();
  if (/contrat|preço|preco|quanto custa|orçamento|orcamento|comprar|agendar|marcar|valor/.test(t)) {
    return { label: "Transacional", color: V.teal };
  }
  if (/perto|próximo|proximo|bairro|centro|zona|região|regiao|em\s+\w+$/.test(t)) {
    return { label: isB2B ? "Setorial" : "Local", color: "#3B82F6" };
  }
  return { label: "Informacional", color: V.ash };
}

function generateCirclePath(lat: number, lng: number, radiusKm: number, points: number = 36): string {
  const coords: string[] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / 111.32) * Math.cos(angle);
    const dLng = (radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    coords.push(`${(lat + dLat).toFixed(6)},${(lng + dLng).toFixed(6)}`);
  }
  return coords.join('|');
}

function Expandable({ title, icon, children, defaultOpen = false, badge }: {
  title: string; icon?: string; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", borderRadius: 10, border: `1px solid ${V.fog}`,
        background: V.white, cursor: "pointer", textAlign: "left", gap: 10,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 600, color: V.night }}>{title}</span>
          {badge}
        </span>
        <span style={{ fontSize: 16, color: V.ash, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "16px 18px", background: V.white, borderRadius: "0 0 10px 10px", border: `1px solid ${V.fog}`, borderTopColor: "transparent", marginTop: -1 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Chip({ children, color = V.ash }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontFamily: V.mono, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase" as const, color, background: `${color}18`, padding: "3px 8px", borderRadius: 100, fontWeight: 500 }}>{children}</span>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InstantValueScreen({ product, region, results, onCheckout, loading, leadId, hideCTA, hideWorkRoutes }: Props) {
  const [show, setShow] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  const termCount = results.termGeneration?.count || results.terms.length;
  const hasVolume = results.totalVolume > 0;
  const serpData = results.serpSummary;
  const igData = results.instagram;
  const breakdown = results.influenceBreakdown;
  const levers = breakdown?.levers || [];
  const hasLevers = levers.length > 0;
  const competitors = results.competitorInstagram || [];
  const shortRegion = region.split(",")[0].trim();
  const aud = results.audiencia;
  const hasAudiencia = aud && aud.audienciaTarget > 0;
  const hasInfluence = results.influencePercent > 0;
  const proj = results.projecaoFinanceira;
  const hasProj = proj && (proj.gapCaptura > 0 || (proj.gapMensal && proj.gapMensal > 0)) && proj.mercadoTotal > 0;
  const ci = results.competitionIndex;
  const hasCi = ci && (ci.totalSearchVolume > 0 || ci.totalCompetitors > 0);
  const isB2B = results.clientType === 'b2b';
  const isB2G = results.clientType === 'b2g';
  const isNacional = /brasil|nacional/i.test(results.audiencia?.municipioNome || '');
  const isNacionalAny = isNacional;
  const isB2BNacional = isB2B && isNacional;
  const audienciaLabel = isB2G ? 'órgãos públicos potenciais' : isB2B ? 'empresas no seu mercado' : 'pessoas no seu mercado';
  const audienciaUnit = isB2G ? 'órgãos' : isB2B ? 'empresas' : 'pessoas';

  const audSublabel = aud
    ? aud.densidade === "nacional"
      ? "Nacional"
      : `Raio ${aud.raioKm}km`
    : "";

  // Fontes encontradas
  const fontesEncontradas = [
    results.maps?.found && { label: 'Google Maps', ok: true,
      detail: results.maps.rating ? `★ ${results.maps.rating} · ${results.maps.reviewCount} avaliações` : 'encontrado' },
    results.instagram?.handle && { label: 'Instagram',
      ok: (results.instagram.followers || 0) > 0,
      detail: results.instagram.handle ? `@${results.instagram.handle}` : 'encontrado' },
    (results.serpSummary?.termsRanked || 0) > 0 && { label: 'Google Search', ok: true,
      detail: `${results.serpSummary!.termsRanked} termos rankeados` },
    results.aiVisibility?.likelyMentioned && { label: 'IA', ok: true,
      detail: 'mencionado em buscas de IA' },
  ].filter(Boolean);
  const nenhumEncontrado = fontesEncontradas.length === 0 && results.influencePercent === 0;

  // Oportunidade calculations — garantir que familiasAtual <= audienciaTotal
  const audienciaTotal = results.audiencia?.audienciaTarget || 0;
  const familiasAtual = proj?.familiasAtual != null
    ? Math.min(proj.familiasAtual, audienciaTotal)
    : Math.round(audienciaTotal * (results.influencePercent / 100));
  const familiasPotencial = proj?.familiasPotencial != null
    ? Math.min(proj.familiasPotencial, audienciaTotal)
    : Math.round(audienciaTotal * (Math.min(results.influencePercent + 6, 100) / 100));
  const oportunidade = nenhumEncontrado ? 0 : Math.max(0, familiasPotencial - familiasAtual);
  const raioKm = results.audiencia?.raioKm || 3;

  // Pilar status indicators
  const pilar1Status = !results.maps?.found
    ? { text: "⚠️ Não encontrado no Google Maps — primeira ação", bg: V.coralWash, color: V.coral }
    : !results.maps?.inLocalPack
    ? { text: "📍 No Maps mas fora do top 3", bg: V.amberWash, color: V.amber }
    : { text: "✅ Visível no Google Maps", bg: V.tealWash, color: V.teal };
  const pilar2Status = (results.maps?.reviewCount || 0) < 10
    ? { text: "⚠️ Poucas avaliações — prioridade alta", bg: V.coralWash, color: V.coral }
    : (results.maps?.rating || 0) >= 4.0
    ? { text: "✅ Boa reputação base", bg: V.tealWash, color: V.teal }
    : { text: "📍 Avaliações precisam melhorar", bg: V.amberWash, color: V.amber };
  const pilar3Status = !igData?.dataAvailable || (igData?.recentPostsCount ?? 0) === 0
    ? { text: "⚠️ Presença digital parada", bg: V.coralWash, color: V.coral }
    : { text: "✅ Presença ativa", bg: V.tealWash, color: V.teal };

  const pilar1Acoes = isB2B
    ? ["Otimizar LinkedIn Company Page com palavras-chave do setor e localização", "Criar página de serviços com SEO para termos B2B específicos do segmento", "Aparecer em buscas de IA: publicar conteúdo técnico que responde perguntas do decisor", "Listar empresa em diretórios setoriais que indexam bem no Google"]
    : ["Criar ou otimizar perfil no Google Meu Negócio com categoria, horário e fotos reais", "Adicionar cidade + serviço nas meta tags do site (ex: 'clínica de estética em Pinheiros')", "Configurar WhatsApp Business com palavras-chave do segmento na bio", "Aparecer em buscas de IA: descrição detalhada no Maps + responder avaliações"];
  const pilar2Acoes = isB2B
    ? ["Publicar 2-3 cases reais com resultados mensuráveis no site e LinkedIn", "Solicitar depoimento em vídeo de 3 clientes satisfeitos esta semana", "Criar página 'Sobre' com time, metodologia e diferenciais concretos", "Newsletter mensal com insight do setor — demonstra autoridade antes da venda"]
    : ["Pedir avaliação para os últimos 20 clientes via mensagem no WhatsApp esta semana", "Adicionar 10+ fotos reais do espaço, equipe e resultado de serviços no Maps", "Reescrever bio do Instagram com proposta de valor clara e CTA direto", "Responder 100% das avaliações do Google — aumenta ranking e confiança"];
  const pilar3Acoes = isB2B
    ? ["Publicar artigo técnico em portal do setor (1x/mês)", "Identificar newsletters de nicho onde decisores estão e pedir menção", "Participar de podcast ou evento do segmento como convidado", "Fazer parceria com players complementares que aparecem em buscas de IA"]
    : ["Criar 2 posts/semana respondendo perguntas reais que clientes fazem", "Pedir menção a parceiros locais (outros negócios complementares no raio)", "Identificar portais do setor que indexam bem no ChatGPT e pedir presença", "Colaborar com criadores de conteúdo locais do mesmo segmento"];

  return (
    <div style={{ minHeight: "100vh", background: V.cloud, padding: "48px 20px", opacity: show ? 1 : 0, transition: "opacity 0.5s ease" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <NelsonLogo size={40} />
          </div>
          <p style={{ fontSize: 13, color: V.ash, margin: 0 }}>{product} · {shortRegion}</p>
        </div>

        {/* ═══ CONFIRMAÇÃO DE FONTES ═══ */}
        {nenhumEncontrado ? (
          <div style={{ background: "#FFF3E0", borderRadius: 10, padding: "12px 16px", marginBottom: 16, border: "1px solid #FFB74D" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#E65100", marginBottom: 4 }}>
              ⚠️ Não encontramos seu negócio online
            </div>
            <p style={{ fontSize: 12, color: "#BF360C", margin: 0, lineHeight: 1.5 }}>
              Nenhuma presença digital detectada. O plano de ação foi gerado para quem está começando do zero.
            </p>
          </div>
        ) : fontesEncontradas.length > 0 ? (
          <div style={{ background: V.cloud, borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: `1px solid ${V.fog}` }}>
            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>
              Dados analisados de
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {fontesEncontradas.map((fonte: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: V.white, borderRadius: 6, padding: "4px 8px", border: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 10, color: V.teal }}>✓</span>
                  <span style={{ fontSize: 11, color: V.night, fontWeight: 500 }}>{fonte.label}</span>
                  {fonte.detail && (
                    <span style={{ fontSize: 10, color: V.ash }}>· {fonte.detail}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ═══ BLOCO 1 — OPORTUNIDADE ═══ */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ background: V.night, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 16 }}>
              Oportunidade identificada
            </div>
            {nenhumEncontrado ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 900, color: V.ash, lineHeight: 1, fontFamily: V.display, marginBottom: 8 }}>
                  Começando do zero
                </div>
                <div style={{ fontSize: 14, color: V.mist, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 14px" }}>
                  Seu negócio ainda não tem presença digital detectável.
                  <strong style={{ color: V.white }}> O plano mostra por onde começar.</strong>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 64, fontWeight: 900, color: V.teal, lineHeight: 1, fontFamily: V.display, letterSpacing: "-0.03em", marginBottom: 8 }}>
                  +{oportunidade > 0 ? oportunidade.toLocaleString('pt-BR') : '—'}
                </div>
                <div style={{ fontSize: 15, color: V.mist, lineHeight: 1.5, maxWidth: 280, margin: "0 auto 16px" }}>
                  {isB2B ? 'empresas' : 'pessoas'} a mais por mês conhecendo você<br/>
                  <strong style={{ color: V.white }}>sem investimento adicional em mídia</strong>
                </div>
              </>
            )}
            <div style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, letterSpacing: "0.04em" }}>
              {isNacionalAny ? 'Mercado nacional' : `Raio de ${raioKm}km · ${shortRegion}`}
            </div>
          </div>
          <div style={{ background: V.cloud, borderRadius: 10, padding: "12px 16px", border: `1px solid ${V.fog}` }}>
            <p style={{ fontSize: 13, color: V.zinc, margin: 0, lineHeight: 1.6, textAlign: "center" }}>
              {isNacionalAny
                ? `No mercado nacional de ${product}, centenas de ${isB2B ? 'empresas' : 'players'} competem pela mesma atenção. Os itens estruturantes mostram como aumentar essa posição.`
                : audienciaTotal > 0
                ? `De ${audienciaTotal.toLocaleString('pt-BR')} ${isB2B ? 'empresas' : 'pessoas'} no seu mercado, você chega hoje a ${familiasAtual.toLocaleString('pt-BR')}. Com as ações certas, passa a ${familiasPotencial.toLocaleString('pt-BR')}.`
                : `Você disputa ${results.influencePercent}% do seu mercado hoje. Com as ações certas, pode disputar mais.`}
            </p>
          </div>
        </div>

        {/* ═══ BLOCO 2 — POR QUE ESSA OPORTUNIDADE EXISTE ═══ */}
        <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12, paddingLeft: 4 }}>
          Por que essa oportunidade existe
        </div>

        {/* ── Card 1: Mercado no raio ── */}
        <div style={{ marginBottom: 4 }}>
          {hasAudiencia ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.teal, letterSpacing: "-0.03em", lineHeight: 1 }}>
                ~{fmtPop(aud!.audienciaTarget)}
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>{isB2G ? 'órgãos públicos' : isB2B ? 'empresas' : 'pessoas'} no seu mercado{aud!.raioKm && aud!.densidade !== "nacional" ? ` · raio ${aud!.raioKm}km` : ''}</p>
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Mercado endereçável indisponível para este município</p>
            </div>
          )}
          <Expandable title="Tamanho da audiência" icon="👥">
          {aud && aud.populacaoRaio > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                <span style={{ fontSize: 12, color: V.zinc }}>População no raio</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>
                  {fmtPop(aud.populacaoRaio)} {audienciaUnit}
                  {aud.densidade !== "nacional" && aud.raioKm && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: V.ash }}> em {aud.raioKm}km</span>
                  )}
                  {aud.ibgeAno && (
                    <span style={{ fontSize: 10, fontWeight: 400, color: V.ash }}> (IBGE {aud.ibgeAno})</span>
                  )}
                </span>
              </div>
              {aud.targetProfile && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 12, color: V.zinc }}>{isB2B ? 'Empresa-alvo' : 'Perfil target'}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: V.night, textAlign: "right", maxWidth: "60%" }}>{aud.targetProfile}</span>
                </div>
              )}
              {aud.audienciaTarget > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${V.fog}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>Audiência estimada</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: V.teal }}>
                    ~{fmtPop(aud.audienciaTarget)} {audienciaUnit}
                    <span style={{ fontSize: 11, fontWeight: 400, color: V.ash, marginLeft: 4 }}>
                      ({Math.round(aud.estimatedPercentage * 100)}%)
                    </span>
                  </span>
                </div>
              )}
              {aud.rationale && (
                <p style={{ fontSize: 11, color: V.ash, margin: "8px 0 0", fontStyle: "italic", lineHeight: 1.5 }}>{aud.rationale}</p>
              )}
              {results.lat && results.lng && aud.raioKm && aud.densidade !== "nacional" && (
                <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${V.fog}` }}>
                  <img
                    src={`https://maps.googleapis.com/maps/api/staticmap?center=${results.lat},${results.lng}&zoom=${aud.raioKm <= 5 ? 13 : 10}&size=560x200&scale=2&maptype=roadmap&style=feature:all|saturation:-50&markers=size:small|color:0x2D9B83|${results.lat},${results.lng}&path=color:0x2D9B8380|weight:2|fillcolor:0x2D9B8318|${generateCirclePath(results.lat!, results.lng!, aud.raioKm!)}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY}`}
                    alt={`Mapa do raio de ${aud.raioKm}km`}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                  <div style={{ padding: "8px 12px", background: V.cloud, fontSize: 11, color: V.zinc, textAlign: "center" }}>
                    Raio de análise: {aud.raioKm}km a partir de {aud.municipioNome}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 10, color: V.ash, margin: "10px 0 0", fontFamily: V.mono }}>Fonte: IBGE{aud.ibgeAno ? ` ${aud.ibgeAno}` : ''} · Estimativa Virô</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Dados IBGE indisponíveis para este município.</p>
          )}
        </Expandable>
        </div>

        {/* ── Card 2: Demanda ativa ── */}
        <div style={{ marginBottom: 4 }}>
          {hasVolume ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, color: V.night, letterSpacing: "-0.03em", lineHeight: 1 }}>
                <AnimatedCounter target={results.totalVolume} duration={1500} />
              </div>
              <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>buscas/mês com intenção de compra</p>
              {results.volumeGeo && results.volumeGeo.level !== 'city' && (
                <p style={{ fontSize: 10, color: V.amber, margin: "4px 0 0", fontFamily: V.mono }}>
                  Dados de {results.volumeGeo.level === 'regional' ? results.volumeGeo.label : results.volumeGeo.level === 'state' ? `estado ${results.volumeGeo.label}` : 'Brasil'}
                </p>
              )}
              {results.pipeline?.sourcesUsed?.includes("claude_volume_estimate") && (
                <p style={{ fontSize: 10, color: V.ash, margin: "4px 0 0", fontFamily: V.mono }}>volume estimado</p>
              )}
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Demanda ativa indisponível para este mercado</p>
            </div>
          )}
          <Expandable title="Volume de buscas" icon="🔍">
          <p style={{ fontSize: 12, color: V.ash, margin: "0 0 12px", lineHeight: 1.5 }}>
            Estas são as buscas que importam para o seu negócio na sua região.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${V.fog}`, fontSize: 10, color: V.ash, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
            <span style={{ flex: 1 }}>Termo</span>
            <span style={{ width: 60, textAlign: "right" }}>Vol/mês</span>
            <span style={{ width: 60, textAlign: "right" }}>Posição</span>
            <span style={{ width: 80, textAlign: "right" }}>Intenção</span>
          </div>
          {(() => {
            const maxVol = Math.max(...results.terms.slice(0, 15).map(t => t.volume), 0);
            return results.terms.slice(0, 15).map((t, i) => {
              const intent = inferIntent(t.term, isB2B);
              const isTop = t.volume > 0 && t.volume === maxVol;
              const pos = t.position && t.position !== "—" ? Number(t.position) : null;
              const posLabel = pos ? (pos <= 3 ? "Top 3" : pos <= 10 ? "Top 10" : `#${pos}`) : "—";
              const posColor = pos ? (pos <= 3 ? V.teal : pos <= 10 ? V.amber : V.ash) : V.ash;
              return (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 0", borderBottom: i < 14 ? `1px solid ${V.fog}` : "none",
                  background: isTop ? V.amberWash : "transparent",
                  marginLeft: isTop ? -4 : 0, marginRight: isTop ? -4 : 0,
                  paddingLeft: isTop ? 4 : 0, paddingRight: isTop ? 4 : 0,
                  borderRadius: isTop ? 4 : 0,
                }}>
                  <span style={{ fontSize: 13, color: V.night, lineHeight: 1.4, flex: 1 }}>{t.term}</span>
                  <span style={{ fontFamily: V.mono, fontSize: 11, color: t.volume > 0 ? V.night : V.ash, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {t.volume > 0 ? t.volume.toLocaleString("pt-BR") : "—"}
                  </span>
                  <span style={{ fontFamily: V.mono, fontSize: 11, color: posColor, fontWeight: pos && pos <= 10 ? 600 : 400, width: 60, textAlign: "right", flexShrink: 0 }}>
                    {posLabel}
                  </span>
                  <span style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                    <span style={{
                      fontFamily: V.mono, fontSize: 9, letterSpacing: "0.04em",
                      color: intent.color, background: `${intent.color}18`,
                      padding: "2px 6px", borderRadius: 100,
                    }}>
                      {intent.label}
                    </span>
                  </span>
                </div>
              );
            });
          })()}
          {results.terms.length > 15 && (
            <p style={{ fontSize: 11, color: V.ash, marginTop: 8, textAlign: "center" }}>+{results.terms.length - 15} termos no diagnóstico completo</p>
          )}
          <p style={{ fontSize: 10, color: V.ash, margin: "12px 0 0", fontFamily: V.mono }}>
            Fonte: Google Ads + SERP{results.volumeGeo ? ` · ${results.volumeGeo.level === 'city' ? results.volumeGeo.label : results.volumeGeo.level === 'regional' ? results.volumeGeo.label : results.volumeGeo.level === 'state' ? results.volumeGeo.label : 'Brasil'}` : ''}
          </p>
        </Expandable>
        </div>

        {/* ── Card 3: Concorrência ── */}
        <div style={{ marginBottom: 4 }}>
          {hasCi ? (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none" }}>
              {ci!.activeCompetitors === 0 && ci!.totalCompetitors === 0 ? (
                <>
                  <div style={{ fontFamily: V.display, fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 700, color: V.teal, lineHeight: 1.2 }}>Sem concorrência</div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>nenhum concorrente digital no seu raio</p>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: V.display, fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>
                    {ci!.activeCompetitors}
                  </div>
                  <p style={{ fontSize: 12, color: V.zinc, margin: "6px 0 0", lineHeight: 1.4 }}>negócio{ci!.activeCompetitors !== 1 ? 's' : ''} disputando atenção com você</p>
                  <span style={{
                    display: "inline-block", marginTop: 8, fontFamily: V.mono, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 600,
                    background: ci!.color === 'green' ? "rgba(45,155,131,0.12)" : ci!.color === 'yellow' ? V.amberWash : V.coralWash,
                    color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral,
                  }}>
                    {ci!.labelText}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div style={{ background: V.white, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.fog}`, borderBottom: "none", opacity: 0.6 }}>
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Concorrência indisponível para esta região</p>
            </div>
          )}
          <Expandable title="Concorrência no seu raio" icon="🏪">
            {!hasCi ? (
              <p style={{ fontSize: 12, color: V.ash, margin: 0, lineHeight: 1.5 }}>Dados de concorrência não disponíveis para esta região.</p>
            ) : ci!.activeCompetitors === 0 && ci!.totalCompetitors === 0 ? (
              <p style={{ fontSize: 12, color: V.teal, margin: 0 }}>Nenhum concorrente digital encontrado no seu raio — oportunidade.</p>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: V.zinc, margin: "0 0 12px", lineHeight: 1.5 }}>
                  {ci!.activeCompetitors} negócio{ci!.activeCompetitors !== 1 ? 's' : ''} disputa{ci!.activeCompetitors === 1 ? '' : 'm'} atenção com você nesta região.
                </p>
                  {ci!.competitors.filter(c => c.hasWebsite || c.hasInstagram).slice(0, 8).map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: V.zinc, borderBottom: i < Math.min(ci!.competitors.filter(cc => cc.hasWebsite || cc.hasInstagram).length, 8) - 1 ? `1px solid ${V.fog}` : "none" }}>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ display: "flex", gap: 4, fontSize: 10 }}>
                        {c.hasWebsite && <span title="Site" style={{ background: V.tealWash, color: V.teal, padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>Site</span>}
                        {c.hasInstagram && <span title="Instagram" style={{ background: "#E1306C18", color: "#E1306C", padding: "1px 5px", borderRadius: 4, fontFamily: V.mono }}>IG</span>}
                      </span>
                      {c.rating && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>★{c.rating}</span>}
                      {c.mapsPosition && <span style={{ fontFamily: V.mono, fontSize: 10, color: V.ash }}>#{c.mapsPosition}</span>}
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: "10px 14px", background: ci!.color === 'green' ? "rgba(45,155,131,0.08)" : ci!.color === 'yellow' ? V.amberWash : V.coralWash, borderRadius: 8, textAlign: "center" }}>
                    <span style={{ fontFamily: V.mono, fontSize: 11, fontWeight: 600, color: ci!.color === 'green' ? V.teal : ci!.color === 'yellow' ? V.amber : V.coral }}>
                      {ci!.labelText} · {ci!.indexValue.toLocaleString("pt-BR")} buscas por concorrente
                    </span>
                  </div>
                </div>
              )}
            </Expandable>
        </div>

        {/* ── Card 4: Sua posição ── */}
        <div style={{ marginBottom: 4 }}>
          {hasInfluence ? (
            <div style={{ background: V.night, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.slate}`, borderBottom: "none" }}>
              <div style={{
                fontFamily: V.display, fontSize: "clamp(36px, 8vw, 52px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
                color: results.influencePercent < 20 ? V.amberSoft : V.teal,
              }}>
                {results.influencePercent}%
              </div>
              <p style={{ fontSize: 13, color: V.mist, margin: "8px 0 0", lineHeight: 1.4 }}>{isNacionalAny ? "é sua posição competitiva no mercado digital nacional" : "é sua posição competitiva no mercado local"}</p>
            </div>
          ) : (
            <div style={{ background: V.night, borderRadius: "14px 14px 0 0", padding: "24px 18px", textAlign: "center", border: `1px solid ${V.slate}`, borderBottom: "none" }}>
              <div style={{ fontFamily: V.display, fontSize: "clamp(36px, 8vw, 52px)", fontWeight: 700, color: V.coral, letterSpacing: "-0.03em", lineHeight: 1 }}>0%</div>
              <p style={{ fontSize: 13, color: V.mist, margin: "8px 0 0", lineHeight: 1.4 }}>{isNacionalAny ? "é sua posição competitiva no mercado digital nacional" : "é sua posição competitiva no mercado local"}</p>
              <p style={{ fontSize: 11, color: V.coral, margin: "4px 0 0" }}>Invisível no mercado</p>
            </div>
          )}
          <Expandable title="Sua Posição — 3 Pilares" icon="📊">
          {(() => {
            const bd = results.influenceBreakdown4D || results.influenceBreakdown;
            const d1 = (bd as any)?.d1_descoberta ?? (bd as any)?.d1_discovery ?? 0;
            const d2 = (bd as any)?.d2_credibilidade ?? (bd as any)?.d2_credibility ?? 0;
            const d3 = (bd as any)?.d3_presenca ?? (bd as any)?.d3_reach ?? 0;
            const d4 = (bd as any)?.d4_reputacao ?? 0;

            const pilaresScore = [
              {
                icon: "🔍", label: "Seja Encontrável",
                score: Math.round(d1), color: V.teal,
                detail: results.maps?.found
                  ? `Maps: ★ ${results.maps.rating} (${results.maps.reviewCount} avaliações)`
                  : "Não encontrado no Google Maps",
              },
              {
                icon: "⭐", label: "Construa Credibilidade",
                score: Math.round((d2 + d4) / 2), color: V.amber,
                detail: results.maps?.reviewCount
                  ? `${results.maps.reviewCount} avaliações · ★ ${results.maps.rating}`
                  : "Sem avaliações detectadas",
              },
              {
                icon: "📣", label: "Participe da Cultura",
                score: Math.round(d3), color: "#8B5CF6",
                detail: results.instagram?.handle
                  ? `@${results.instagram.handle} · ${results.instagram.followers?.toLocaleString('pt-BR')} seguidores`
                  : "Presença digital não detectada",
              },
            ];

            return (
              <div>
                <p style={{ fontSize: 12, color: V.ash, margin: "0 0 16px", lineHeight: 1.5 }}>
                  Probabilidade de ser escolhido quando alguém no seu raio decide contratar.
                </p>
                {pilaresScore.map((p, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{p.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: V.night }}>{p.label}</span>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{p.score}</span>
                    </div>
                    <div style={{ height: 4, background: V.fog, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ height: "100%", background: p.color, borderRadius: 2, width: `${p.score}%`, transition: "width 0.6s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, color: V.ash }}>{p.detail}</div>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: "8px 10px", background: V.cloud, borderRadius: 6,
                  fontSize: 10, color: V.ash, textAlign: "center" as const, fontFamily: V.mono }}>
                  Score geral = média ponderada: Descoberta (35%), Credibilidade+Reputação (45%), Cultura (20%) — ajustado por compressão realista
                </div>
              </div>
            );
          })()}
        </Expandable>
        </div>

        {/* ── Conclusão expansível ── */}
        <details style={{ marginBottom: 16 }}>
          <summary style={{ background: V.amberWash, borderRadius: 12, padding: "14px 16px", border: `1px solid ${V.amber}30`, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: V.mono, fontSize: 9, color: V.amber, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                A fórmula
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: V.night, margin: 0, lineHeight: 1.5 }}>
                {audienciaTotal > 0
                  ? `${audienciaTotal.toLocaleString('pt-BR')} ${isB2B ? 'empresas' : 'pessoas'} no raio · você disputa ${results.influencePercent}% · potencial +${oportunidade.toLocaleString('pt-BR')}/mês`
                  : `Você disputa ${results.influencePercent}% do mercado · há espaço para crescer`}
              </p>
            </div>
            <span style={{ fontSize: 14, color: V.ash, flexShrink: 0, marginLeft: 8 }}>▾</span>
          </summary>
          <div style={{ padding: "12px 16px", background: V.cloud, borderRadius: "0 0 12px 12px", border: `1px solid ${V.fog}`, borderTop: "none" }}>
            <div style={{ fontSize: 12, color: V.zinc, lineHeight: 1.8 }}>
              <div>📊 <strong>Mercado total no raio:</strong> {audienciaTotal.toLocaleString('pt-BR')} {isB2B ? 'empresas' : 'pessoas'}</div>
              <div>🔍 <strong>Buscas ativas/mês:</strong> {(results.totalVolume || 0).toLocaleString('pt-BR')} com intenção de compra</div>
              <div>🏪 <strong>Concorrentes:</strong> {results.competitionIndex?.activeCompetitors || '—'} disputando atenção</div>
              <div>📈 <strong>Sua posição hoje:</strong> {results.influencePercent}% → disputa {familiasAtual.toLocaleString('pt-BR')} {isB2B ? 'empresas' : 'pessoas'}/mês</div>
              <div style={{ marginTop: 8, padding: "8px 10px", background: `${V.teal}15`, borderRadius: 8, color: V.teal, fontWeight: 600 }}>
                🎯 Com o plano: {results.influencePercent + (proj?.influenciaMeta ? proj.influenciaMeta - results.influencePercent : 6)}% → +{oportunidade.toLocaleString('pt-BR')} {isB2B ? 'empresas' : 'pessoas'} adicionais/mês · sem mídia paga
              </div>
            </div>
            {results.pipeline?.durationMs && (
              <p style={{ fontFamily: V.mono, fontSize: 10, color: V.ash, marginTop: 10, textAlign: "center" as const }}>
                {(results.pipeline.durationMs / 1000).toFixed(1)}s · {results.pipeline.version} · {(results.pipeline.sourcesUsed || []).length} fontes
              </p>
            )}
          </div>
        </details>

        {/* ═══ BLOCO 3 — COMO AUMENTAR ESSA POSIÇÃO ═══ */}
        <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12, paddingLeft: 4, marginTop: 24 }}>
          Como aumentar essa posição
        </div>

        {/* Pilar 1 — Seja Encontrável */}
        <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Seja Encontrável</span>
            </div>
            <Chip color={V.teal}>Grátis</Chip>
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc", color: V.zinc }}>
            {pilar1Acoes.map((acao, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 2 }}>{acao}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, padding: "6px 10px", background: pilar1Status.bg, borderRadius: 6, fontSize: 11, color: pilar1Status.color, fontWeight: 500 }}>
            {pilar1Status.text}
          </div>
        </div>

        {/* Pilar 2 — Construa Credibilidade */}
        <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Construa Credibilidade</span>
            </div>
            <Chip color={V.amber}>No plano</Chip>
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc", color: V.zinc }}>
            {pilar2Acoes.map((acao, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 2 }}>{acao}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, padding: "6px 10px", background: pilar2Status.bg, borderRadius: 6, fontSize: 11, color: pilar2Status.color, fontWeight: 500 }}>
            {pilar2Status.text}
          </div>
        </div>

        {/* Pilar 3 — Participe da Cultura */}
        <div style={{ background: V.white, borderRadius: 12, border: `1px solid ${V.fog}`, padding: "16px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🌐</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: V.night }}>Participe da Cultura</span>
            </div>
            <Chip color={V.amber}>No plano</Chip>
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc", color: V.zinc }}>
            {pilar3Acoes.map((acao, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 2 }}>{acao}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10, padding: "6px 10px", background: pilar3Status.bg, borderRadius: 6, fontSize: 11, color: pilar3Status.color, fontWeight: 500 }}>
            {pilar3Status.text}
          </div>
        </div>

        {/* ═══ PNCP — Contratações Públicas (B2G only) ═══ */}
        {isB2G && results.pncp && results.pncp.totalEncontradas > 0 && (
          <Expandable title="Contratações Públicas (PNCP)" icon="📋">
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.night }}>{results.pncp.totalEncontradas}</div>
                  <div style={{ fontSize: 10, color: V.ash }}>contratações</div>
                </div>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.teal }}>R${(results.pncp.valorTotalEstimado / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 10, color: V.ash }}>valor total</div>
                </div>
                <div style={{ flex: 1, background: V.cloud, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: V.night }}>{results.pncp.orgaosUnicos}</div>
                  <div style={{ fontSize: 10, color: V.ash }}>órgãos</div>
                </div>
              </div>
              {results.pncp.modalidades.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: V.zinc, margin: "0 0 6px" }}>Modalidades mais comuns:</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {results.pncp.modalidades.slice(0, 5).map((m, i) => (
                      <Chip key={i} color={V.teal}>{m.modalidade} ({m.count})</Chip>
                    ))}
                  </div>
                </div>
              )}
              {results.pncp.contratacoes.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: V.zinc, margin: "0 0 6px" }}>Contratações recentes:</p>
                  {results.pncp.contratacoes.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < 4 ? `1px solid ${V.fog}` : "none" }}>
                      <p style={{ fontSize: 12, color: V.night, margin: 0, lineHeight: 1.4 }}>{c.objeto.slice(0, 120)}{c.objeto.length > 120 ? '...' : ''}</p>
                      <p style={{ fontSize: 10, color: V.ash, margin: "2px 0 0" }}>{c.orgaoEntidade} · {c.modalidade} · R${c.valorEstimado > 0 ? (c.valorEstimado / 1000).toFixed(0) + 'k' : '—'}</p>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 10, color: V.ash, margin: "8px 0 0", fontFamily: V.mono }}>
                Fonte: PNCP · {results.pncp.periodoConsultado}
              </p>
            </div>
          </Expandable>
        )}

        {/* ═══ CTA ═══ */}
        {!hideCTA && (<><div style={{ padding: "24px 0 16px" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: V.night, margin: "0 0 8px", lineHeight: 1.4 }}>
            Agora você sabe. O próximo passo é agir.
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 4px", lineHeight: 1.6 }}>
            <strong style={{ color: V.night }}>Antes:</strong> Não sabia o que fazer primeiro
          </p>
          <p style={{ fontSize: 14, color: V.zinc, margin: "0 0 20px", lineHeight: 1.6 }}>
            <strong style={{ color: V.teal }}>Agora:</strong> Sei onde estou e o que fazer para disputar mais
          </p>
        </div>

        <div style={{ background: V.night, borderRadius: 14, padding: "28px 20px", marginBottom: 16, color: V.white }}>
          <div style={{ fontFamily: V.mono, fontSize: 9, color: V.ash, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 4 }}>
            Pacote completo · pagamento único
          </div>
          <div style={{ fontFamily: V.display, fontSize: 32, fontWeight: 700, marginBottom: 16 }}>R$ 497</div>

          {[
            "Diagnóstico completo por canal (Google, Instagram, Maps, IA)",
            "Itens estruturantes — o básico que precisa estar no lugar",
            "Relatório setorial do seu mercado com dados reais",
            "Posts prontos para publicar conectados ao contexto da semana",
          ].map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
              <span style={{ color: V.amber, fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 13, color: V.mist }}>{d}</span>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${V.graphite}` }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="Cupom" value={coupon}
                onChange={(e: any) => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${V.slate}`, background: V.graphite, color: V.white, fontSize: 13, fontFamily: V.mono, outline: "none" }} />
              {coupon.length > 0 && (
                <button onClick={() => setCouponApplied(true)} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: couponApplied ? V.teal : V.amber, color: V.white, fontSize: 12, fontFamily: V.mono, cursor: "pointer" }}>
                  {couponApplied ? "✓" : "Aplicar"}
                </button>
              )}
            </div>
            <button onClick={() => onCheckout(couponApplied ? coupon : undefined)} disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: V.white, color: V.night, fontSize: 15, fontWeight: 600,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "Redirecionando..." : "Gerar meu plano de ação"}
            </button>
            <p style={{ fontSize: 11, color: V.ash, textAlign: "center", marginTop: 8 }}>Pagamento único · sem assinatura</p>
          </div>
        </div></>)}

        {/* Feedback */}
        {leadId && (
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <FeedbackWidget leadId={leadId} triggerPoint="post_instant_value" />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0 0" }}>
          <p style={{ fontSize: 11, color: V.ash, fontStyle: "italic", lineHeight: 1.6, margin: "0 0 16px" }}>
            Resultado depende da execução. Virô dá a inteligência — a ação é sua.
          </p>
          <span style={{ fontFamily: V.display, fontSize: 14, fontWeight: 700, color: V.night }}>Virô</span>
          <p style={{ fontSize: 10, color: V.ash, fontFamily: V.mono, marginTop: 2 }}>virolocal.com</p>
        </div>
      </div>
    </div>
  );
}
