// ============================================================================
// Índice de Saturação de Mercado
// Calcula a relação entre demanda (buscas) e oferta (concorrentes ativos)
// ============================================================================

export interface CompetitionIndex {
  totalCompetitors: number;       // total encontrado no Maps
  activeCompetitors: number;      // com presença digital (site OU instagram)
  totalSearchVolume: number;      // soma dos volumes de todos os termos
  indexValue: number;             // buscas por concorrente ativo
  label: 'subatendido' | 'equilibrado' | 'saturado';
  labelText: string;
  color: 'green' | 'yellow' | 'red';
  competitors: CompetitorDetail[];
}

export interface CompetitorDetail {
  name: string;
  hasWebsite: boolean;
  hasInstagram: boolean;
  mapsPosition?: number;
  rating?: number;
  reviewCount?: number;
}

/**
 * Calcula o índice de saturação de mercado.
 *
 * - Concorrente ativo = tem website OU instagram nos dados do Maps
 * - indexValue = totalSearchVolume ÷ activeCompetitors
 * - > 500 buscas/concorrente → subatendido (verde)
 * - 200–500 → equilibrado (amarelo)
 * - < 200 → saturado (vermelho)
 */
export function calcularIndiceSaturacao(
  mapsResults: any[],
  totalSearchVolume: number,
): CompetitionIndex {
  // Extrai concorrentes do resultado do Maps scraper
  const competitors: CompetitorDetail[] = mapsResults.map((r: any, i: number) => ({
    name: r.title || r.name || r.businessName || `Concorrente ${i + 1}`,
    hasWebsite: !!(r.website || r.url || r.site),
    hasInstagram: !!(
      r.instagram_url || r.instagramUrl ||
      (typeof r.socialMedia === 'object' && r.socialMedia?.instagram)
    ),
    mapsPosition: i + 1,
    rating: r.rating || r.totalScore || undefined,
    reviewCount: r.reviewCount || r.reviewsCount || r.reviews || undefined,
  }));

  const totalCompetitors = competitors.length;
  const activeCompetitors = competitors.filter(c => c.hasWebsite || c.hasInstagram).length;

  let indexValue = 0;
  let label: CompetitionIndex['label'] = 'subatendido';
  let labelText = 'Muita demanda, pouca concorrência';
  let color: CompetitionIndex['color'] = 'green';

  if (activeCompetitors === 0) {
    // Sem concorrência digital identificada
    indexValue = totalSearchVolume > 0 ? totalSearchVolume : 0;
    label = 'subatendido';
    labelText = 'Nenhum concorrente digital encontrado';
    color = 'green';
  } else {
    indexValue = Math.round(totalSearchVolume / activeCompetitors);

    if (indexValue > 500) {
      label = 'subatendido';
      labelText = 'Muita demanda, pouca concorrência';
      color = 'green';
    } else if (indexValue >= 200) {
      label = 'equilibrado';
      labelText = 'Concorrência compatível com a demanda';
      color = 'yellow';
    } else {
      label = 'saturado';
      labelText = 'Muita concorrência para a demanda';
      color = 'red';
    }
  }

  console.log(`[CompetitionIndex] total=${totalCompetitors}, ativos=${activeCompetitors}, volume=${totalSearchVolume}, index=${indexValue}, label=${label}`);

  return {
    totalCompetitors,
    activeCompetitors,
    totalSearchVolume,
    indexValue,
    label,
    labelText,
    color,
    competitors,
  };
}
