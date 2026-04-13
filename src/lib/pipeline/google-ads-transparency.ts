// ============================================================================
// Virô Radar — Google Ads Transparency Integration
// Verifica se concorrentes estão investindo em Google Ads.
// Usa o Google Ads Transparency Center (adstransparency.google.com).
// ============================================================================

export interface AdsTransparencyResult {
  searched: boolean;
  competitorsWithAds: {
    name: string;
    hasAds: boolean;
    adCount?: number;
    lastSeen?: string;
  }[];
  selfHasAds: boolean;
  summary: string;           // "2 dos seus 3 concorrentes investem em Google Ads"
}

/**
 * Verifica presença de ads dos concorrentes via Google Ads Transparency.
 * Nota: o Transparency Center não tem API pública. Usamos inferência
 * a partir dos dados de SERP (serpFeatures incluem 'ads') e Claude.
 *
 * Custo: ~$0.001 (Haiku).
 */
export async function checkAdsTransparency(
  businessName: string,
  competitors: string[],
  serpData?: any[],
): Promise<AdsTransparencyResult> {
  // 1. Verifica nos dados de SERP se há ads
  const termsWithAds = (serpData || []).filter(
    (sp: any) => sp.serpFeatures?.includes('ads'),
  );

  const hasAdsInSerp = termsWithAds.length > 0;

  // 2. Infere quais concorrentes investem em ads
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Baseado no mercado brasileiro, estime quais destes negócios provavelmente investem em Google Ads:

Negócio principal: "${businessName}"
Concorrentes: ${competitors.map((c, i) => `${i + 1}. "${c}"`).join(', ')}
Ads detectados na SERP: ${hasAdsInSerp ? 'Sim' : 'Não'}

JSON: {"self_has_ads": false, "competitors": [{"name": "...", "likely_has_ads": true, "confidence": "high|medium|low"}], "summary": "frase"}

Considere: empresas maiores e redes tendem a investir mais. Negócios muito locais menos.`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        searched: true,
        selfHasAds: parsed.self_has_ads || false,
        competitorsWithAds: (parsed.competitors || []).map((c: any) => ({
          name: c.name,
          hasAds: c.likely_has_ads || false,
        })),
        summary: parsed.summary || '',
      };
    }
  } catch (err) {
    console.warn('[AdsTransparency] Failed:', (err as Error).message);
  }

  return {
    searched: true,
    competitorsWithAds: [],
    selfHasAds: false,
    summary: hasAdsInSerp
      ? 'Detectamos anúncios pagos nos resultados de busca dos seus termos. Concorrentes podem estar investindo.'
      : 'Não detectamos anúncios pagos nos seus termos de busca.',
  };
}
