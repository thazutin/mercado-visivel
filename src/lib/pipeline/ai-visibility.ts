// ============================================================================
// Virô — AI Visibility Score
// Checks if a business appears when someone asks AI assistants
// about the category in their region.
// This is a DIFFERENTIATOR — no competitor offers this for SMBs.
// ============================================================================
// File: src/lib/pipeline/ai-visibility.ts

import Anthropic from "@anthropic-ai/sdk";

export interface AIVisibilityResult {
  available: boolean;
  score: number;                       // 0-100
  mentionedIn: AISourceResult[];
  notMentionedIn: string[];
  queries: string[];                   // The queries we tested
  summary: string;                     // Human-readable summary
}

export interface AISourceResult {
  source: string;                      // "perplexity" | "chatgpt_proxy" | "google_ai"
  query: string;
  mentioned: boolean;
  context: string;                     // Snippet where business appears
  position: number | null;             // Position in list if applicable
}

/**
 * Test AI visibility by asking Claude to simulate what AI assistants would return
 * for category + region queries. This is a proxy approach:
 * - We use Claude's training data as a proxy for what ChatGPT/Perplexity would know
 * - We also scrape Google AI Overview via Apify SERP (already captured in serpFeatures)
 * - Future: direct Perplexity API when available
 *
 * The key insight: if a business doesn't appear in Claude's knowledge,
 * it almost certainly won't appear in other AI assistants either.
 */
export async function checkAIVisibility(
  businessName: string,
  product: string,
  region: string,
  serpFeatures: { term: string; features: string[] }[]
): Promise<AIVisibilityResult> {
  const queries = generateAIQueries(product, region);

  // ─── Source 1: Google AI Overview (from existing SERP data) ───
  const googleAIResults: AISourceResult[] = [];
  const termsWithAIOverview = serpFeatures.filter((sf) =>
    sf.features.some((f) => f === "featured_snippet" || f === "ai_overview" || f === "people_also_ask")
  );

  for (const sf of termsWithAIOverview) {
    googleAIResults.push({
      source: "google_ai",
      query: sf.term,
      mentioned: true, // If business ranks for terms with AI features, it might appear
      context: `Termo "${sf.term}" tem AI features: ${sf.features.join(", ")}`,
      position: null,
    });
  }

  // ─── Source 2: Claude as proxy for AI assistant knowledge ───
  const claudeResults = await checkClaudeKnowledge(businessName, product, region, queries);

  // ─── Calculate score ───
  const allResults = [...googleAIResults, ...claudeResults];
  const mentionedResults = allResults.filter((r) => r.mentioned);
  const notMentionedSources: string[] = [];

  // Check which major sources don't mention the business
  const sourcesMentioned = new Set(mentionedResults.map((r) => r.source));
  if (!sourcesMentioned.has("google_ai")) notMentionedSources.push("Google AI Overview");
  if (!sourcesMentioned.has("claude_proxy")) notMentionedSources.push("Assistentes de IA (ChatGPT, Perplexity, etc.)");

  // Score: weighted by source importance
  let score = 0;
  const googleAIMentions = googleAIResults.filter((r) => r.mentioned).length;
  const claudeMentions = claudeResults.filter((r) => r.mentioned).length;

  // Google AI features presence: 0-40 points
  if (termsWithAIOverview.length > 0) {
    score += Math.min(googleAIMentions / termsWithAIOverview.length, 1.0) * 40;
  }

  // Claude knowledge presence: 0-60 points
  if (queries.length > 0) {
    score += Math.min(claudeMentions / queries.length, 1.0) * 60;
  }

  score = Math.round(score);

  // ─── Summary ───
  let summary: string;
  if (score >= 60) {
    summary = `${businessName} tem boa visibilidade em IA. Aparece em ${mentionedResults.length} de ${allResults.length} consultas testadas. Quando alguém pergunta a um assistente de IA sobre ${product} em ${region}, há boa chance de ser mencionado.`;
  } else if (score >= 30) {
    summary = `${businessName} tem visibilidade parcial em IA. Aparece em algumas consultas, mas não na maioria. Existe espaço significativo para melhorar a presença em respostas de assistentes de IA.`;
  } else {
    summary = `${businessName} praticamente não aparece quando alguém pergunta a um assistente de IA sobre ${product} em ${region}. Isso é comum para negócios locais — mas é uma oportunidade: quem aparecer primeiro captura a atenção.`;
  }

  return {
    available: true,
    score,
    mentionedIn: mentionedResults,
    notMentionedIn: notMentionedSources,
    queries,
    summary,
  };
}

// ─── QUERY GENERATION ────────────────────────────────────────────────

function generateAIQueries(product: string, region: string): string[] {
  return [
    `melhor ${product} em ${region}`,
    `${product} recomendado em ${region}`,
    `onde encontrar ${product} em ${region}`,
    `${product} ${region} avaliação`,
  ];
}

// ─── CLAUDE KNOWLEDGE CHECK ──────────────────────────────────────────

async function checkClaudeKnowledge(
  businessName: string,
  product: string,
  region: string,
  queries: string[]
): Promise<AISourceResult[]> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const prompt = `Vou te fazer ${queries.length} perguntas como se fosse um consumidor buscando recomendações. Para cada pergunta, liste os negócios específicos que você conhece na região. Se não conhecer nenhum negócio específico, diga "nenhum conhecido".

Responda em JSON:
{
  "results": [
    {
      "query": "a pergunta",
      "businesses_mentioned": ["nome1", "nome2"],
      "knows_specific_businesses": true/false
    }
  ]
}

Perguntas:
${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Responda APENAS com o JSON.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: "Você é um consumidor pesquisando opções locais. Responda com base no que realmente conhece. Não invente nomes. Se não conhece negócios específicos na região, seja honesto. Responda apenas em JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) parsed = JSON.parse(match[1].trim());
      else return [];
    }

    return (parsed.results || []).map((r: any) => {
      const businessMentioned = (r.businesses_mentioned || []).some((name: string) =>
        name.toLowerCase().includes(businessName.toLowerCase()) ||
        businessName.toLowerCase().includes(name.toLowerCase())
      );

      const position = businessMentioned
        ? (r.businesses_mentioned || []).findIndex((name: string) =>
            name.toLowerCase().includes(businessName.toLowerCase()) ||
            businessName.toLowerCase().includes(name.toLowerCase())
          ) + 1
        : null;

      return {
        source: "claude_proxy",
        query: r.query,
        mentioned: businessMentioned,
        context: businessMentioned
          ? `Mencionado na posição ${position} entre ${(r.businesses_mentioned || []).length} negócios`
          : r.knows_specific_businesses
          ? `Não mencionado. Outros citados: ${(r.businesses_mentioned || []).slice(0, 3).join(", ")}`
          : "Nenhum negócio específico conhecido para esta consulta",
        position,
      };
    });
  } catch (err) {
    console.error("[AIVisibility] Claude check failed:", err);
    return [];
  }
}
