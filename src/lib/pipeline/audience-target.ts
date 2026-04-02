// ============================================================================
// Virô — Audience Target Estimation via Claude
// Estima o percentual da população que é público-alvo do negócio
// ============================================================================

import type { AudienciaTarget } from "../types/pipeline.types";

/**
 * Usa Claude Haiku para inferir o público-alvo e estimar
 * o percentual da população local que representa clientes potenciais.
 * Timeout: 8s, falha silenciosa retornando null.
 */
export async function inferirTargetAudiencia(
  segmento: string,
  descricao: string,
  populacaoRaio: number,
  claudeClient: { createMessage: (params: any) => Promise<any> },
  clientType: 'b2c' | 'b2b' | 'b2g' = 'b2c',
): Promise<AudienciaTarget | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const isB2B = clientType === 'b2b';
    const isB2G = clientType === 'b2g';
    // B2B: ~1 empresa para cada 8 habitantes; B2G: órgãos públicos (~1:2000)
    const populacaoBase = isB2G
      ? Math.round(populacaoRaio / 2000)
      : isB2B ? Math.round(populacaoRaio / 8) : populacaoRaio;

    console.log(`[Audience Target] START: segmento="${segmento}", pop=${populacaoRaio}, clientType=${clientType}, base=${populacaoBase}`);

    // Prioridade 1: benchmark curado (se disponível, pula Claude — economiza 2-3s)
    try {
      const { getTargetPercentage, findBenchmark } = await import('@/config/sector-benchmarks');
      const benchPct = getTargetPercentage(segmento, clientType);
      if (benchPct !== null) {
        const bench = findBenchmark(segmento);
        const audienciaTarget = Math.round(populacaoBase * benchPct);
        const unitLabel = isB2G ? 'órgãos' : isB2B ? 'empresas' : 'pessoas';
        console.log(`[Audience Target] Benchmark: ${bench?.category} → ${(benchPct * 100).toFixed(1)}% → ${audienciaTarget.toLocaleString("pt-BR")} ${unitLabel}`);
        return {
          targetProfile: bench?.targetProfile || bench?.category.replace(/_/g, ' ') || segmento,
          estimatedPercentage: benchPct,
          audienciaTarget,
          rationale: `Benchmark setorial: ${(benchPct * 100).toFixed(1)}% da base de ${populacaoBase.toLocaleString('pt-BR')} ${unitLabel}`,
        };
      }
    } catch { /* benchmark import failed, continue to Claude */ }

    // Prioridade 2: Claude Haiku (para categorias sem benchmark)
    let promptContent: string;
    if (isB2G) {
      promptContent = `Dado o segmento de negócio abaixo (B2G — vende para GOVERNO / setor público), estime o percentual dos órgãos públicos locais que representam clientes potenciais.

Segmento: ${segmento}
Descrição: ${descricao}
Órgãos públicos estimados na região: ~${populacaoBase.toLocaleString('pt-BR')}

Responda APENAS com JSON válido, sem markdown:
{
  "targetProfile": "tipo de órgão público-cliente (máx 60 chars, ex: Prefeituras e secretarias de saúde municipais)",
  "estimatedPercentage": 0.XX,
  "rationale": "justificativa em 1 frase"
}

Considere: nível de governo (municipal, estadual, federal), tipo de contratação (licitação, pregão, dispensa), frequência de compra. Percentuais B2G são tipicamente entre 0.10 e 0.50.`;
    } else if (isB2B) {
      promptContent = `Dado o segmento de negócio abaixo (B2B — vende para OUTRAS EMPRESAS), estime o percentual das empresas locais que representam clientes potenciais.

Segmento: ${segmento}
Descrição: ${descricao}
Empresas estimadas na região: ~${populacaoBase.toLocaleString('pt-BR')}

Responda APENAS com JSON válido, sem markdown:
{
  "targetProfile": "tipo de empresa-cliente (máx 60 chars, ex: PMEs do setor de serviços com 2-20 funcionários)",
  "estimatedPercentage": 0.XX,
  "rationale": "justificativa em 1 frase"
}

Considere: porte típico da empresa-cliente, setor de atuação, necessidade do serviço. Seja conservador — percentuais acima de 0.30 são raros.`;
    } else {
      promptContent = `Dado o segmento de negócio abaixo, estime o percentual da população local que representa o público-alvo potencial.

Segmento: ${segmento}
Descrição: ${descricao}

Responda APENAS com JSON válido, sem markdown:
{
  "targetProfile": "descrição curta do perfil (máx 60 chars)",
  "estimatedPercentage": 0.XX,
  "rationale": "justificativa em 1 frase"
}

Considere fatores como: faixa etária típica do cliente, poder aquisitivo necessário, frequência de compra. Seja conservador — percentuais acima de 0.30 são raros.`;
    }

    const res = await claudeClient.createMessage({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: promptContent,
        },
      ],
    });

    const text = (res.content || [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    console.log(`[Audience Target] Claude response: "${text.slice(0, 150)}"`);
    // Extrai JSON mesmo se vier com markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Audience Target] Claude não retornou JSON válido:", text.slice(0, 100));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const percentage = Math.min(Math.max(parsed.estimatedPercentage || 0.05, 0.01), 0.50);
    const audienciaTarget = Math.round(populacaoBase * percentage);

    const unitLabel = isB2G ? 'órgãos' : isB2B ? 'empresas' : 'pessoas';
    console.log(`[Audience Target] ${parsed.targetProfile}: ${(percentage * 100).toFixed(1)}% → ${audienciaTarget.toLocaleString("pt-BR")} ${unitLabel}`);

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
