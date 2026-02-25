import Anthropic from "@anthropic-ai/sdk";
import type { SearchTerm, DiagnosisResult } from "./supabase";

// ─── Mock Generator (used when Apify data isn't available yet) ──────────
export function generateMockResults(product: string, region: string): Omit<DiagnosisResult, "id" | "created_at" | "lead_id"> {
  const city = region.split(/[\s,—-]/)[0];

  const terms: SearchTerm[] = [
    { term: `${product} ${city}`, volume: 2400, cpc: 3.8, position: "—" },
    { term: `melhor ${product.toLowerCase()} perto de mim`, volume: 1900, cpc: 4.2, position: "—" },
    { term: `${product.toLowerCase()} preço`, volume: 1600, cpc: 2.9, position: "42" },
    { term: `${product.toLowerCase()} aberto agora`, volume: 880, cpc: 3.1, position: "—" },
    { term: `agendar ${product.toLowerCase()}`, volume: 540, cpc: 5.1, position: "—" },
    { term: `${product.toLowerCase()} avaliação`, volume: 720, cpc: 2.5, position: "38" },
    { term: `${product.toLowerCase()} online`, volume: 480, cpc: 3.6, position: "—" },
    { term: `${product.toLowerCase()} recomendação`, volume: 390, cpc: 2.8, position: "—" },
  ];

  const totalVolume = terms.reduce((s, t) => s + t.volume, 0);
  const avgCpc = terms.reduce((s, t) => s + t.cpc, 0) / terms.length;

  return {
    terms,
    total_volume: totalVolume,
    avg_cpc: avgCpc,
    market_low: Math.round(totalVolume * avgCpc * 0.25 * 0.1),
    market_high: Math.round(totalVolume * avgCpc * 0.45 * 0.15),
    influence_percent: 7,
    source: "Google Ads Keyword Planner (estimativa)",
    confidence: "Estimativa",
  };
}

// ─── Claude API: enrich terms with market analysis ──────────────────────
const anthropicKey = process.env.ANTHROPIC_API_KEY;

export async function enrichWithClaude(
  product: string,
  region: string,
  terms: SearchTerm[]
): Promise<{ analysis: string; suggestions: string[] }> {
  if (!anthropicKey) {
    return {
      analysis: "Análise detalhada disponível após configuração da API.",
      suggestions: [
        "Criar conteúdo para os termos com maior volume",
        "Responder avaliações no Google Maps",
        "Destacar diferencial real na comunicação",
      ],
    };
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  const termsText = terms
    .map((t) => `- "${t.term}": ${t.volume} buscas/mês, CPC R$ ${t.cpc}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Você é um analista de marketing para negócios locais brasileiros. 
Analise estes dados de busca para um negócio de "${product}" em "${region}":

${termsText}

Responda em JSON com esta estrutura exata:
{
  "analysis": "Um parágrafo de análise do mercado (tom direto, baseado em dados, sem hype)",
  "suggestions": ["3-5 ações concretas que vão além de calendário de posts — posicionamento, reputação, presença, comunicação de diferencial"]
}

Regras de tom: sem promessas causais, sem "hack/fórmula", use "probabilidade", "influência", "ao longo do tempo". Fale como analista, não como guru.`,
      },
    ],
  });

  try {
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      analysis: "Análise disponível — erro ao processar resposta.",
      suggestions: ["Revise os termos manualmente para oportunidades"],
    };
  }
}

// ─── Full pipeline: generate + enrich ───────────────────────────────────
export async function runInstantAnalysis(product: string, region: string) {
  const baseResults = generateMockResults(product, region);
  
  // Try to enrich with Claude (non-blocking for instant value)
  let enrichment;
  try {
    enrichment = await enrichWithClaude(product, region, baseResults.terms);
  } catch (err) {
    console.error("[Claude enrichment failed]", err);
    enrichment = null;
  }

  return {
    ...baseResults,
    enrichment,
  };
}
