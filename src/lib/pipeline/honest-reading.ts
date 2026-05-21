// ============================================================================
// Virô — Leitura Honesta do diagnóstico
// Um parágrafo curto (máx 5 frases) escrito como consultor estratégico
// olhando os dados crus: força + fragilidade + tradução. PT-BR.
// Roda em runPostDiagnosisEnrichment, salva em diagnoses.honest_reading
// e flui pra diagnosis_display.honestReading no buildDisplayData.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface HonestReadingInput {
  businessName: string;
  product: string;
  region: string;
  clientType: "b2c" | "b2b" | "b2g" | "mixed";
  score: number;
  maps?: { found: boolean; rating: number | null; reviewCount: number | null; photos: number } | null;
  instagram?: { handle: string; followers: number; postsLast30d: number; engagementRate: number; dataAvailable: boolean } | null;
  competitorAvgRating?: number;
  competitorAvgReviews?: number;
  topCompetitorIG?: { handle: string; followers: number; postsLast30d: number; bio?: string } | null;
  searchVolume?: number;
  audienciaTarget?: number;
  challenge?: string;
}

const CHALLENGE_LABELS: Record<string, string> = {
  frequencia: "fazer o cliente voltar mais vezes",
  cross_sell: "vender mais itens por venda",
  market_share: "tirar clientes dos concorrentes",
  awareness: "ser encontrado por quem ainda não conhece",
  novo_segmento: "abrir num novo público",
  expansao_geo: "abrir em novas regiões",
  novo_canal: "abrir um canal novo de venda",
  novo_produto: "lançar um produto novo",
};

export async function generateHonestReading(input: HonestReadingInput): Promise<string> {
  const challengeText = input.challenge ? CHALLENGE_LABELS[input.challenge] || input.challenge : null;

  const dataDump = [
    `Negócio: ${input.businessName} · ${input.product} · ${input.region} · ${input.clientType}`,
    `Score atual: ${input.score}/100`,
    challengeText ? `Desafio declarado pelo dono: ${challengeText}` : null,
    input.maps?.found
      ? `Google Maps: encontrado · ★${input.maps.rating ?? "?"} · ${input.maps.reviewCount ?? 0} reviews · ${input.maps.photos ?? 0} fotos`
      : `Google Maps: NÃO encontrado`,
    input.instagram?.dataAvailable
      ? `Instagram @${input.instagram.handle}: ${input.instagram.followers} seg · ${input.instagram.postsLast30d} posts/30d · ${(input.instagram.engagementRate * 100).toFixed(1)}% engajamento`
      : `Instagram: sem dados`,
    input.competitorAvgRating && input.competitorAvgRating > 0
      ? `Concorrentes (média): ★${input.competitorAvgRating.toFixed(1)} · ${input.competitorAvgReviews ?? 0} reviews`
      : null,
    input.topCompetitorIG
      ? `Concorrente IG mais ativo: @${input.topCompetitorIG.handle} (${input.topCompetitorIG.followers} seg, ${input.topCompetitorIG.postsLast30d} posts/30d${input.topCompetitorIG.bio ? `, bio: "${input.topCompetitorIG.bio.slice(0, 80)}"` : ""})`
      : null,
    input.searchVolume && input.searchVolume > 0 ? `Buscas no mercado: ${input.searchVolume}/mês` : null,
    input.audienciaTarget && input.audienciaTarget > 0 ? `Audiência estimada: ${input.audienciaTarget} pessoas no raio` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Você é um consultor estratégico de marketing que olha os dados crus do negócio
e devolve UMA leitura honesta — direto, sem floreios, em português brasileiro.

DADOS:
${dataDump}

REGRAS RÍGIDAS:
- UM ÚNICO parágrafo, máximo 5 frases.
- Estrutura: força do negócio (1 frase) → o que está travando (1-2 frases com dado concreto) →
  tradução estratégica (1-2 frases dizendo o que isso significa pro próximo passo).
- Cite NÚMEROS reais dos dados acima quando disponíveis.
- Compare com concorrente nominado quando relevante.
- Tom: consultor que conhece o setor, fala como gente, sem jargão.
  ✗ "Você tem um CAC desfavorável"
  ✓ "Você tem fundação boa, mas pouca gente sabe que você existe."
- NÃO comece com "Você", "Seu negócio", "O cenário" — abra com um verbo ou observação.
- NÃO use bullet points, listas ou markdown.
- NÃO termine com "Vamos lá", "Bora", call to action — é leitura, não pitch.
- Em até ~80 palavras.

Devolva APENAS o parágrafo, sem aspas, sem prefixo.`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      temperature: 0.35,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("")
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "");
    return text;
  } catch (err) {
    console.error("[HonestReading] Falha ao gerar:", (err as Error).message);
    return "";
  }
}
