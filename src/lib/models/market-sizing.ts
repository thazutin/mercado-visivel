// ============================================================================
// Step 3 — Market Sizing (Modelo Proprietário)
// Cálculo de dimensionamento de mercado baseado em intenção digital
// ============================================================================

import type {
  Step2Output,
  Step3Output,
  Step4Output,
  MarketSizing,
  TermVolumeData,
  SerpPosition,
  IBGEData,
} from '../types/pipeline.types';

// --- CTR BENCHMARKS POR POSIÇÃO ORGÂNICA ---
// Fonte: Advanced Web Ranking + Backlinko (2024-2025)
// Ajustados para busca local (local pack presente)

export const CTR_BENCHMARKS = {
  // Sem local pack (resultados orgânicos puros)
  organic: {
    1: 0.285,   // 28.5%
    2: 0.155,   // 15.5%
    3: 0.110,   // 11.0%
    4: 0.080,   // 8.0%
    5: 0.062,   // 6.2%
    6: 0.048,   // 4.8%
    7: 0.038,   // 3.8%
    8: 0.030,   // 3.0%
    9: 0.026,   // 2.6%
    10: 0.023,  // 2.3%
  } as Record<number, number>,
  
  // Com local pack (Google Maps results empurram orgânico pra baixo)
  withLocalPack: {
    1: 0.220,   // Local pack absorve ~20% dos cliques
    2: 0.120,
    3: 0.085,
    4: 0.060,
    5: 0.045,
    6: 0.035,
    7: 0.028,
    8: 0.022,
    9: 0.018,
    10: 0.015,
  } as Record<number, number>,
  
  // Posição no local pack (3-pack do Google Maps)
  localPack: {
    1: 0.170,   // 17.0% — posição 1 no Maps
    2: 0.120,   // 12.0%
    3: 0.080,   // 8.0%
  } as Record<number, number>,
  
  // Não encontrado nos top 30
  notFound: 0.001,  // ~0.1% — quase zero mas não zero
};

// --- TAXAS DE CONVERSÃO POR CATEGORIA ---
// Fonte: Compilação de benchmarks de indústria (WordStream, Unbounce, HubSpot)
// Estes são visitante → lead/contato, não visitante → venda fechada

export interface CategoryBenchmark {
  conversionRate: { low: number; mid: number; high: number };
  avgTicketMultiplier: number;  // Ajuste se o ticket informado parece fora da faixa
  notes: string;
}

export const CATEGORY_BENCHMARKS: Record<string, CategoryBenchmark> = {
  // Saúde e Estética
  'clinica_estetica': {
    conversionRate: { low: 0.025, mid: 0.040, high: 0.065 },
    avgTicketMultiplier: 1.0,
    notes: 'Ciclo de decisão médio. Confiança é fator decisivo.',
  },
  'odontologia': {
    conversionRate: { low: 0.030, mid: 0.050, high: 0.075 },
    avgTicketMultiplier: 1.0,
    notes: 'Urgência aumenta conversão. Busca local forte.',
  },
  'veterinaria': {
    conversionRate: { low: 0.035, mid: 0.055, high: 0.080 },
    avgTicketMultiplier: 1.0,
    notes: 'Emergência + localização são drivers principais.',
  },
  'psicologia_terapia': {
    conversionRate: { low: 0.020, mid: 0.035, high: 0.055 },
    avgTicketMultiplier: 1.0,
    notes: 'Ciclo longo. Confiança pessoal é crítica.',
  },
  
  // Serviços profissionais
  'advocacia': {
    conversionRate: { low: 0.015, mid: 0.030, high: 0.050 },
    avgTicketMultiplier: 1.0,
    notes: 'Ticket alto, decisão complexa. SEO é principal canal.',
  },
  'contabilidade': {
    conversionRate: { low: 0.020, mid: 0.035, high: 0.055 },
    avgTicketMultiplier: 1.0,
    notes: 'Recorrência alta. Indicação compete com busca.',
  },
  'arquitetura_design': {
    conversionRate: { low: 0.015, mid: 0.025, high: 0.040 },
    avgTicketMultiplier: 1.0,
    notes: 'Portfolio visual é decisivo. Instagram forte.',
  },
  
  // Fitness e Bem-estar
  'academia_studio': {
    conversionRate: { low: 0.035, mid: 0.055, high: 0.080 },
    avgTicketMultiplier: 1.0,
    notes: 'Localização é fator #1. Sazonalidade em janeiro.',
  },
  
  // Alimentação
  'restaurante': {
    conversionRate: { low: 0.045, mid: 0.070, high: 0.100 },
    avgTicketMultiplier: 1.0,
    notes: 'Conversão alta. Decisão rápida, influenciada por reviews e fotos.',
  },
  'cafeteria_padaria': {
    conversionRate: { low: 0.050, mid: 0.075, high: 0.110 },
    avgTicketMultiplier: 1.0,
    notes: 'Impulso + localização. Google Maps é rei.',
  },
  
  // Educação
  'escola_curso': {
    conversionRate: { low: 0.015, mid: 0.030, high: 0.050 },
    avgTicketMultiplier: 1.0,
    notes: 'Ciclo longo. Sazonalidade forte (jan-fev, jul).',
  },
  
  // Casa e Construção
  'reforma_construcao': {
    conversionRate: { low: 0.020, mid: 0.035, high: 0.055 },
    avgTicketMultiplier: 1.0,
    notes: 'Ticket alto, decisão consultiva. Orçamento é gate.',
  },
  'energia_solar': {
    conversionRate: { low: 0.015, mid: 0.025, high: 0.040 },
    avgTicketMultiplier: 1.0,
    notes: 'Ticket muito alto. Ciclo de decisão 30-90 dias.',
  },
  
  // Imobiliário
  'imobiliaria': {
    conversionRate: { low: 0.010, mid: 0.020, high: 0.035 },
    avgTicketMultiplier: 1.0,
    notes: 'Ciclo mais longo do mercado. Volume compensa conversão baixa.',
  },
  
  // E-commerce
  'ecommerce_nicho': {
    conversionRate: { low: 0.015, mid: 0.025, high: 0.040 },
    avgTicketMultiplier: 1.0,
    notes: 'Competição com marketplaces. Diferenciação é chave.',
  },
  
  // Fallback para categorias não mapeadas
  'default': {
    conversionRate: { low: 0.020, mid: 0.035, high: 0.055 },
    avgTicketMultiplier: 1.0,
    notes: 'Benchmark genérico. Refinar com dados reais.',
  },
};

// --- CATEGORY DETECTION ---
// Claude faz isso no Step 1, mas ter um fallback mecânico é prudente

export function detectCategory(product: string, differentiator: string): string {
  const text = `${product} ${differentiator}`.toLowerCase();
  
  const matchers: [string, RegExp][] = [
    ['clinica_estetica', /estétic|botox|harmoniza|peeling|laser|dermat/],
    ['odontologia', /odonto|dentist|implante|ortodon|dent[eá]/],
    ['veterinaria', /veterin|pet|animal|cachorro|gato/],
    ['psicologia_terapia', /psicolog|terap|psicanal|psiquiat|mental/],
    ['advocacia', /advog|jurídi|direito|escritório.*(law|advoc)/],
    ['contabilidade', /contab|fiscal|tributar|imposto/],
    ['arquitetura_design', /arquitet|design.*interior|decoraç/],
    ['academia_studio', /academ|studio|pilates|crossfit|yoga|treino/],
    ['restaurante', /restaur|gastro|chef|culinár|comida/],
    ['cafeteria_padaria', /café|cafeter|padari|confeit|bakery/],
    ['escola_curso', /escola|curso|aula|ensino|educa|treinament/],
    ['reforma_construcao', /reform|constru|pedreiro|empreit|marcen/],
    ['energia_solar', /solar|fotovolt|energi/],
    ['imobiliaria', /imobili|corret.*imóv|aluguel|venda.*imóv/],
    ['ecommerce_nicho', /loja.*online|ecommerce|e-commerce|marketplace/],
  ];

  for (const [category, regex] of matchers) {
    if (regex.test(text)) return category;
  }
  return 'default';
}

// --- MARKET SIZING CALCULATOR ---

export function calculateMarketSizing(
  step2: Step2Output,
  serpPositions: SerpPosition[],
  ticket: number,
  category: string,
  ibgeData?: IBGEData | null,
  currency: 'BRL' | 'USD' | 'EUR' = 'BRL',
): Step3Output {
  const startTime = Date.now();
  const benchmark = CATEGORY_BENCHMARKS[category] || CATEGORY_BENCHMARKS['default'];

  // 1. Volume ponderado por intenção (já calculado no step2, mas recalculamos pra transparência)
  const weightedVolume = step2.weightedMonthlyVolume;
  const totalVolume = step2.totalMonthlyVolume;

  // 2. Determinar se local pack está presente (afeta CTR benchmarks)
  const hasLocalPack = serpPositions.some(
    sp => sp.serpFeatures?.includes('local_pack')
  );
  const ctrTable = hasLocalPack ? CTR_BENCHMARKS.withLocalPack : CTR_BENCHMARKS.organic;

  // 3. Market potential (range)
  // Low: se o negócio ficasse em posição 3 para todos os termos
  // Mid: posição 2
  // High: posição 1
  const ctrPos1 = ctrTable[1];
  const ctrPos2 = ctrTable[2];
  const ctrPos3 = ctrTable[3];

  const marketLow = Math.round(
    weightedVolume * ctrPos3 * benchmark.conversionRate.low * ticket * 12
  );
  const marketMid = Math.round(
    weightedVolume * ctrPos2 * benchmark.conversionRate.mid * ticket * 12
  );
  const marketHigh = Math.round(
    weightedVolume * ctrPos1 * benchmark.conversionRate.high * ticket * 12
  );

  // 4. Montar premissas expostas
  const assumptions = {
    ctrBenchmark: [
      { position: 1, ctr: ctrPos1 },
      { position: 2, ctr: ctrPos2 },
      { position: 3, ctr: ctrPos3 },
    ],
    conversionRate: benchmark.conversionRate,
    conversionSource: `Benchmark ${category} — compilação WordStream/Unbounce 2024-2025`,
    ticketUsed: ticket,
  };

  // Ajuste IBGE: normaliza para cidade de 500k hab (cap 2x, floor 0.3x)
  let adjustedMid = marketMid;
  if (ibgeData && ibgeData.populacao > 0) {
    const ratio = Math.max(0.3, Math.min(2.0, ibgeData.populacao / 500_000));
    adjustedMid = Math.round(marketMid * ratio);
  }

  let disclaimer = 'Dimensionamento baseado em intenção digital de busca. Representa o mercado que busca ativamente online — não inclui demanda offline, indicações ou tráfego de passagem. Números são estimativas fundamentadas, não projeções garantidas.';
  if (ibgeData && ibgeData.populacao > 0) {
    disclaimer += ` Mercado baseado em população real de ${ibgeData.municipio}: ${ibgeData.populacao.toLocaleString()} habitantes.`;
  }

  const sizing: MarketSizing = {
    totalSearchVolume: totalVolume,
    weightedSearchVolume: weightedVolume,
    marketPotential: {
      low: marketLow,
      mid: adjustedMid,
      high: marketHigh,
      currency,
    },
    assumptions,
    disclaimer,
  };

  return {
    sizing,
    processingTimeMs: Date.now() - startTime,
  };
}
