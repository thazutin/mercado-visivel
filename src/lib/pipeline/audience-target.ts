// ============================================================================
// Virô — Audience Target Estimation via Claude
// Estima o percentual da população que é público-alvo do negócio
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { AudienciaTarget } from "../types/pipeline.types";

/**
 * Usa Claude Haiku para inferir o público-alvo e estimar
 * o percentual da população local que representa clientes potenciais.
 * Timeout: 5s, falha silenciosa retornando null.
 */
export async function inferirTargetAudiencia(
  segmento: string,
  descricao: string,
  populacaoRaio: number,
  claude: Anthropic,
): Promise<AudienciaTarget | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Dado o segmento de negócio abaixo, estime o percentual da população local que representa o público-alvo potencial.

Segmento: ${segmento}
Descrição: ${descricao}

Responda APENAS com JSON válido, sem markdown:
{
  "targetProfile": "descrição curta do perfil (máx 60 chars)",
  "estimatedPercentage": 0.XX,
  "rationale": "justificativa em 1 frase"
}

Considere fatores como: faixa etária típica do cliente, poder aquisitivo necessário, frequência de compra. Seja conservador — percentuais acima de 0.30 são raros.`,
        },
      ],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    // Extrai JSON mesmo se vier com markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Audience Target] Claude não retornou JSON válido:", text.slice(0, 100));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const percentage = Math.min(Math.max(parsed.estimatedPercentage || 0.05, 0.01), 0.50);
    const audienciaTarget = Math.round(populacaoRaio * percentage);

    console.log(`[Audience Target] ${parsed.targetProfile}: ${(percentage * 100).toFixed(1)}% → ${audienciaTarget.toLocaleString("pt-BR")} pessoas`);

    return {
      targetProfile: (parsed.targetProfile || "Público geral").slice(0, 60),
      estimatedPercentage: percentage,
      audienciaTarget,
      rationale: parsed.rationale || "",
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.warn("[Audience Target] Timeout (5s)");
    } else {
      console.warn("[Audience Target] Erro:", (err as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
