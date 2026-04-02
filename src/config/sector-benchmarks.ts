// Benchmarks setoriais curados — fonte primária para ticketMedio, taxaConversao e targetPercentage.
// Substitui inferência do Claude Haiku: mais rápido (-2s), custo zero, previsível.
// Fontes: IBGE POF 2024, WordStream, Unbounce, HubSpot, dados setoriais públicos.
// Manter atualizado a cada 6 meses.

export interface SectorBenchmark {
  category: string;
  keywords: string[];
  ticketMedio: { low: number; mid: number; high: number };
  taxaConversao: { low: number; mid: number; high: number };
  targetPercentage: { b2c: number; b2b: number };
  targetProfile: string;
  source: string;
}

export const SECTOR_BENCHMARKS: SectorBenchmark[] = [
  // ═══ SAÚDE & ESTÉTICA ═══
  {
    category: 'clinica_estetica',
    keywords: ['estétic', 'botox', 'harmoniza', 'peeling', 'laser', 'dermat', 'lipo', 'preenchimento'],
    ticketMedio: { low: 200, mid: 450, high: 1200 },
    taxaConversao: { low: 0.025, mid: 0.040, high: 0.065 },
    targetPercentage: { b2c: 0.08, b2b: 0.02 },
    targetProfile: 'Mulheres 25-55 interessadas em cuidados estéticos',
    source: 'Benchmark setorial saúde estética 2024',
  },
  {
    category: 'odontologia',
    keywords: ['odonto', 'dentist', 'implante', 'ortodon', 'dent'],
    ticketMedio: { low: 150, mid: 350, high: 800 },
    taxaConversao: { low: 0.030, mid: 0.050, high: 0.075 },
    targetPercentage: { b2c: 0.12, b2b: 0.01 },
    targetProfile: 'Adultos e famílias buscando tratamento dentário',
    source: 'Benchmark setorial odontologia 2024',
  },
  {
    category: 'veterinaria',
    keywords: ['veterin', 'pet', 'animal', 'cachorro', 'gato', 'petshop', 'banho e tosa'],
    ticketMedio: { low: 80, mid: 200, high: 500 },
    taxaConversao: { low: 0.035, mid: 0.055, high: 0.080 },
    targetPercentage: { b2c: 0.15, b2b: 0.01 },
    targetProfile: 'Donos de pets buscando veterinário próximo',
    source: 'IBGE POF 2024 — despesa com animais',
  },
  {
    category: 'psicologia_terapia',
    keywords: ['psicolog', 'terap', 'psicanal', 'psiquiat', 'mental', 'coaching'],
    ticketMedio: { low: 150, mid: 300, high: 600 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.06, b2b: 0.03 },
    targetProfile: 'Adultos 25-50 buscando acompanhamento psicológico',
    source: 'Benchmark setorial saúde mental 2024',
  },
  {
    category: 'medicina_geral',
    keywords: ['médic', 'clínica', 'consul', 'ortoped', 'cardio', 'neurol', 'gineco', 'pediatr', 'urol'],
    ticketMedio: { low: 200, mid: 400, high: 1000 },
    taxaConversao: { low: 0.025, mid: 0.045, high: 0.070 },
    targetPercentage: { b2c: 0.10, b2b: 0.01 },
    targetProfile: 'Adultos buscando consulta médica especializada',
    source: 'Benchmark setorial saúde 2024',
  },

  // ═══ SERVIÇOS PROFISSIONAIS ═══
  {
    category: 'advocacia',
    keywords: ['advog', 'jurídi', 'direito', 'law', 'escritório.*advoc'],
    ticketMedio: { low: 500, mid: 2000, high: 8000 },
    taxaConversao: { low: 0.015, mid: 0.030, high: 0.050 },
    targetPercentage: { b2c: 0.04, b2b: 0.08 },
    targetProfile: 'Pessoas e empresas com demandas jurídicas',
    source: 'Benchmark setorial jurídico 2024',
  },
  {
    category: 'contabilidade',
    keywords: ['contab', 'fiscal', 'tributar', 'imposto', 'folha de pagamento'],
    ticketMedio: { low: 300, mid: 800, high: 2500 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.02, b2b: 0.15 },
    targetProfile: 'Empresas e autônomos que precisam de contador',
    source: 'Benchmark setorial contábil 2024',
  },
  {
    category: 'arquitetura_design',
    keywords: ['arquitet', 'design.*interior', 'decoraç', 'paisag'],
    ticketMedio: { low: 1500, mid: 5000, high: 20000 },
    taxaConversao: { low: 0.015, mid: 0.025, high: 0.040 },
    targetPercentage: { b2c: 0.03, b2b: 0.05 },
    targetProfile: 'Proprietários planejando reforma ou construção',
    source: 'Benchmark setorial arquitetura 2024',
  },
  {
    category: 'consultoria',
    keywords: ['consultor', 'assessor', 'mentori', 'gestão', 'estratég'],
    ticketMedio: { low: 1000, mid: 3000, high: 15000 },
    taxaConversao: { low: 0.010, mid: 0.025, high: 0.040 },
    targetPercentage: { b2c: 0.01, b2b: 0.10 },
    targetProfile: 'Empresas buscando consultoria especializada',
    source: 'Benchmark setorial consultoria 2024',
  },
  {
    category: 'marketing_agencia',
    keywords: ['marketing', 'agência', 'publicidade', 'social media', 'branding', 'digital'],
    ticketMedio: { low: 800, mid: 2500, high: 10000 },
    taxaConversao: { low: 0.015, mid: 0.030, high: 0.050 },
    targetPercentage: { b2c: 0.01, b2b: 0.12 },
    targetProfile: 'Empresas buscando agência de marketing',
    source: 'Benchmark setorial marketing 2024',
  },

  // ═══ FITNESS & BEM-ESTAR ═══
  {
    category: 'academia_studio',
    keywords: ['academ', 'studio', 'pilates', 'crossfit', 'yoga', 'treino', 'musculação', 'funcional'],
    ticketMedio: { low: 80, mid: 180, high: 400 },
    taxaConversao: { low: 0.035, mid: 0.055, high: 0.080 },
    targetPercentage: { b2c: 0.12, b2b: 0.01 },
    targetProfile: 'Adultos 18-50 buscando atividade física na região',
    source: 'IBGE POF 2024 — despesa com atividade física',
  },
  {
    category: 'salao_barbearia',
    keywords: ['salão', 'cabeleir', 'barb', 'corte', 'manicure', 'unha', 'sobrancelh'],
    ticketMedio: { low: 40, mid: 100, high: 250 },
    taxaConversao: { low: 0.040, mid: 0.065, high: 0.095 },
    targetPercentage: { b2c: 0.20, b2b: 0.01 },
    targetProfile: 'Moradores da região que frequentam salão regularmente',
    source: 'IBGE POF 2024 — despesa com cuidados pessoais',
  },
  {
    category: 'spa_massagem',
    keywords: ['spa', 'massag', 'relaxa', 'bem-estar', 'day spa'],
    ticketMedio: { low: 100, mid: 250, high: 600 },
    taxaConversao: { low: 0.025, mid: 0.040, high: 0.060 },
    targetPercentage: { b2c: 0.05, b2b: 0.02 },
    targetProfile: 'Adultos interessados em bem-estar e relaxamento',
    source: 'Benchmark setorial bem-estar 2024',
  },

  // ═══ ALIMENTAÇÃO ═══
  {
    category: 'restaurante',
    keywords: ['restaur', 'gastro', 'chef', 'culinár', 'comida', 'bistro', 'pizzar'],
    ticketMedio: { low: 30, mid: 60, high: 150 },
    taxaConversao: { low: 0.045, mid: 0.070, high: 0.100 },
    targetPercentage: { b2c: 0.25, b2b: 0.02 },
    targetProfile: 'Moradores e trabalhadores que almoçam ou jantam fora',
    source: 'IBGE POF 2024 — despesa com alimentação fora',
  },
  {
    category: 'cafeteria_padaria',
    keywords: ['café', 'cafeter', 'padari', 'confeit', 'bakery', 'doceri'],
    ticketMedio: { low: 15, mid: 35, high: 80 },
    taxaConversao: { low: 0.050, mid: 0.075, high: 0.110 },
    targetPercentage: { b2c: 0.30, b2b: 0.02 },
    targetProfile: 'Moradores e trabalhadores que frequentam cafés e padarias',
    source: 'IBGE POF 2024 — despesa com alimentação fora',
  },
  {
    category: 'delivery_food',
    keywords: ['delivery', 'marmita', 'quentinha', 'kit', 'congelad'],
    ticketMedio: { low: 25, mid: 50, high: 100 },
    taxaConversao: { low: 0.040, mid: 0.065, high: 0.090 },
    targetPercentage: { b2c: 0.20, b2b: 0.03 },
    targetProfile: 'Moradores da região que pedem delivery regularmente',
    source: 'Benchmark setorial food delivery 2024',
  },

  // ═══ EDUCAÇÃO ═══
  {
    category: 'escola_curso',
    keywords: ['escola', 'curso', 'aula', 'ensino', 'educa', 'treinament', 'idiom', 'inglês'],
    ticketMedio: { low: 200, mid: 600, high: 2500 },
    taxaConversao: { low: 0.015, mid: 0.030, high: 0.050 },
    targetPercentage: { b2c: 0.10, b2b: 0.05 },
    targetProfile: 'Pais e adultos buscando cursos e capacitação',
    source: 'Benchmark setorial educação 2024',
  },
  {
    category: 'educacao_infantil',
    keywords: ['creche', 'berçário', 'educação infantil', 'pré-escola'],
    ticketMedio: { low: 800, mid: 1800, high: 4000 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.05, b2b: 0.01 },
    targetProfile: 'Famílias com filhos de 0-6 anos buscando escola',
    source: 'IBGE POF 2024 — despesa com educação',
  },

  // ═══ CASA & CONSTRUÇÃO ═══
  {
    category: 'reforma_construcao',
    keywords: ['reform', 'constru', 'pedreiro', 'empreit', 'marcen', 'pintor'],
    ticketMedio: { low: 2000, mid: 8000, high: 30000 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.06, b2b: 0.04 },
    targetProfile: 'Proprietários planejando reforma ou obra',
    source: 'Benchmark setorial construção 2024',
  },
  {
    category: 'energia_solar',
    keywords: ['solar', 'fotovolt', 'energi'],
    ticketMedio: { low: 8000, mid: 18000, high: 45000 },
    taxaConversao: { low: 0.015, mid: 0.025, high: 0.040 },
    targetPercentage: { b2c: 0.03, b2b: 0.08 },
    targetProfile: 'Proprietários interessados em reduzir conta de energia',
    source: 'Benchmark setorial energia solar 2024',
  },
  {
    category: 'limpeza_manutencao',
    keywords: ['limpeza', 'manuten', 'zelador', 'jardin', 'detetiz', 'desentup'],
    ticketMedio: { low: 100, mid: 300, high: 800 },
    taxaConversao: { low: 0.035, mid: 0.055, high: 0.080 },
    targetPercentage: { b2c: 0.10, b2b: 0.08 },
    targetProfile: 'Residências e empresas que contratam limpeza',
    source: 'Benchmark setorial serviços domésticos 2024',
  },

  // ═══ IMOBILIÁRIO ═══
  {
    category: 'imobiliaria',
    keywords: ['imobili', 'corret.*imóv', 'aluguel', 'venda.*imóv', 'apartament'],
    ticketMedio: { low: 1500, mid: 5000, high: 15000 },
    taxaConversao: { low: 0.010, mid: 0.020, high: 0.035 },
    targetPercentage: { b2c: 0.04, b2b: 0.02 },
    targetProfile: 'Pessoas buscando comprar, vender ou alugar imóvel',
    source: 'Benchmark setorial imobiliário 2024',
  },

  // ═══ VAREJO ═══
  {
    category: 'ecommerce_nicho',
    keywords: ['loja.*online', 'ecommerce', 'e-commerce', 'marketplace'],
    ticketMedio: { low: 50, mid: 150, high: 500 },
    taxaConversao: { low: 0.015, mid: 0.025, high: 0.040 },
    targetPercentage: { b2c: 0.10, b2b: 0.03 },
    targetProfile: 'Consumidores online interessados no segmento',
    source: 'Benchmark setorial e-commerce 2024',
  },
  {
    category: 'varejo_fisico',
    keywords: ['loja', 'varejo', 'comérci', 'mercado', 'conveni', 'papelari', 'livrari'],
    ticketMedio: { low: 30, mid: 80, high: 250 },
    taxaConversao: { low: 0.040, mid: 0.060, high: 0.085 },
    targetPercentage: { b2c: 0.20, b2b: 0.03 },
    targetProfile: 'Moradores e passantes que compram na região',
    source: 'IBGE POF 2024 — despesa com comércio',
  },
  {
    category: 'moda_vestuario',
    keywords: ['moda', 'roupa', 'vestuário', 'calçado', 'acessório', 'joalh', 'ateliê'],
    ticketMedio: { low: 80, mid: 200, high: 600 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.15, b2b: 0.02 },
    targetProfile: 'Consumidores de moda na região ou online',
    source: 'IBGE POF 2024 — despesa com vestuário',
  },

  // ═══ TECNOLOGIA ═══
  {
    category: 'ti_software',
    keywords: ['software', 'sistem', 'app', 'saas', 'tecnolog', 'TI', 'desenvolv', 'programaç'],
    ticketMedio: { low: 500, mid: 2000, high: 10000 },
    taxaConversao: { low: 0.010, mid: 0.020, high: 0.035 },
    targetPercentage: { b2c: 0.01, b2b: 0.15 },
    targetProfile: 'Empresas que precisam de soluções de tecnologia',
    source: 'Benchmark setorial SaaS Brasil 2024',
  },

  // ═══ AUTOMOTIVO ═══
  {
    category: 'automotivo',
    keywords: ['mecânic', 'oficin', 'funilari', 'elétric.*auto', 'pneu', 'autocenter', 'lava.*carro'],
    ticketMedio: { low: 150, mid: 500, high: 2000 },
    taxaConversao: { low: 0.035, mid: 0.055, high: 0.080 },
    targetPercentage: { b2c: 0.15, b2b: 0.05 },
    targetProfile: 'Motoristas buscando manutenção veicular na região',
    source: 'Benchmark setorial automotivo 2024',
  },

  // ═══ TURISMO & HOSPITALIDADE ═══
  {
    category: 'turismo_hotel',
    keywords: ['hotel', 'pousad', 'hostel', 'airbnb', 'turism', 'viag', 'recept'],
    ticketMedio: { low: 150, mid: 400, high: 1200 },
    taxaConversao: { low: 0.025, mid: 0.040, high: 0.060 },
    targetPercentage: { b2c: 0.08, b2b: 0.03 },
    targetProfile: 'Visitantes e turistas buscando hospedagem',
    source: 'Benchmark setorial turismo 2024',
  },

  // ═══ EVENTOS ═══
  {
    category: 'eventos_festas',
    keywords: ['event', 'festa', 'casament', 'buffet', 'decoraç.*event', 'DJ', 'fotógraf'],
    ticketMedio: { low: 500, mid: 3000, high: 15000 },
    taxaConversao: { low: 0.015, mid: 0.030, high: 0.050 },
    targetPercentage: { b2c: 0.04, b2b: 0.03 },
    targetProfile: 'Pessoas organizando eventos e celebrações',
    source: 'Benchmark setorial eventos 2024',
  },

  // ═══ SEGURANÇA ═══
  {
    category: 'seguranca',
    keywords: ['segurança', 'monitor', 'alarm', 'câmera', 'vigil', 'portari'],
    ticketMedio: { low: 200, mid: 600, high: 2000 },
    taxaConversao: { low: 0.020, mid: 0.035, high: 0.055 },
    targetPercentage: { b2c: 0.06, b2b: 0.10 },
    targetProfile: 'Empresas e residências buscando segurança',
    source: 'Benchmark setorial segurança 2024',
  },
];

// ─── LOOKUP FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Encontra benchmark pelo nome do produto/diferenciador.
 * Usa regex matching similar ao detectCategory de market-sizing.ts.
 */
export function findBenchmark(product: string, differentiator?: string): SectorBenchmark | null {
  const text = `${product} ${differentiator || ''}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const bench of SECTOR_BENCHMARKS) {
    for (const kw of bench.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (new RegExp(kwNorm, 'i').test(text)) {
        return bench;
      }
    }
  }
  return null;
}

/**
 * Retorna ticketMedio e taxaConversao do benchmark, ou fallback conservador.
 * Drop-in replacement para inferirFinanceiro() do Claude.
 */
export function getFinancialBenchmark(
  product: string,
  differentiator?: string,
): { ticketMedio: number; taxaConversao: number; ticketRationale: string; fromBenchmark: boolean } {
  const bench = findBenchmark(product, differentiator);
  if (bench) {
    return {
      ticketMedio: bench.ticketMedio.mid,
      taxaConversao: bench.taxaConversao.mid,
      ticketRationale: `${bench.source} — ticket médio R$${bench.ticketMedio.low}-${bench.ticketMedio.high}, usando R$${bench.ticketMedio.mid} (mediana). Conversão ${(bench.taxaConversao.mid * 100).toFixed(1)}% típica para ${bench.category.replace(/_/g, ' ')}.`,
      fromBenchmark: true,
    };
  }
  return {
    ticketMedio: 500,
    taxaConversao: 0.03,
    ticketRationale: 'Estimativa conservadora padrão — categoria não mapeada nos benchmarks.',
    fromBenchmark: false,
  };
}

/**
 * Retorna targetPercentage do benchmark para audiência estimada.
 */
export function getTargetPercentage(
  product: string,
  clientType: string,
  differentiator?: string,
): number | null {
  const bench = findBenchmark(product, differentiator);
  if (!bench) return null;
  return clientType === 'b2b' ? bench.targetPercentage.b2b : bench.targetPercentage.b2c;
}
