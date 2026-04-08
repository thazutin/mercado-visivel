// Mapeamento de categorias Virô → códigos CNAE (Classificação Nacional de Atividades Econômicas)
// Usado para buscar empresas por setor no Brasil.io (dataset socios-brasil)
// Fonte: IBGE CONCLA — https://concla.ibge.gov.br/busca-online-cnae.html

export interface CNAEMapping {
  category: string;
  cnaePrimarios: string[];    // Códigos CNAE 7 dígitos (sem pontuação)
  cnaeGrupos: string[];       // Grupos CNAE 2-3 dígitos para busca ampla
  descricao: string;
}

export const CNAE_MAPPINGS: CNAEMapping[] = [
  // ═══ SAÚDE & ESTÉTICA ═══
  {
    category: 'clinica_estetica',
    cnaePrimarios: ['9602501', '9602502', '8690999', '8630503'],
    cnaeGrupos: ['96', '86'],
    descricao: 'Clínicas de estética, centros de beleza e procedimentos estéticos',
  },
  {
    category: 'odontologia',
    cnaePrimarios: ['8630504', '8630501'],
    cnaeGrupos: ['86'],
    descricao: 'Consultórios e clínicas odontológicas',
  },
  {
    category: 'veterinaria',
    cnaePrimarios: ['7500100', '9609207', '4789004'],
    cnaeGrupos: ['75'],
    descricao: 'Clínicas veterinárias e pet shops',
  },
  {
    category: 'psicologia_terapia',
    cnaePrimarios: ['8650003', '8650004', '8650099'],
    cnaeGrupos: ['86'],
    descricao: 'Consultórios de psicologia e terapia',
  },
  {
    category: 'medicina_geral',
    cnaePrimarios: ['8630503', '8630501', '8630502', '8610101'],
    cnaeGrupos: ['86'],
    descricao: 'Consultórios médicos e clínicas de saúde',
  },

  // ═══ SERVIÇOS PROFISSIONAIS ═══
  {
    category: 'advocacia',
    cnaePrimarios: ['6911701', '6911702', '6911703'],
    cnaeGrupos: ['69'],
    descricao: 'Escritórios de advocacia e serviços jurídicos',
  },
  {
    category: 'contabilidade',
    cnaePrimarios: ['6920601', '6920602'],
    cnaeGrupos: ['69'],
    descricao: 'Escritórios de contabilidade e auditoria',
  },
  {
    category: 'arquitetura_design',
    cnaePrimarios: ['7111100', '7410202'],
    cnaeGrupos: ['71', '74'],
    descricao: 'Escritórios de arquitetura e design de interiores',
  },
  {
    category: 'consultoria',
    cnaePrimarios: ['7020400', '7490104', '7490199'],
    cnaeGrupos: ['70', '74'],
    descricao: 'Consultorias empresariais e de gestão',
  },
  {
    category: 'marketing_agencia',
    cnaePrimarios: ['7311400', '7312200', '7319002'],
    cnaeGrupos: ['73'],
    descricao: 'Agências de publicidade, marketing e comunicação',
  },

  // ═══ FITNESS & BEM-ESTAR ═══
  {
    category: 'academia_studio',
    cnaePrimarios: ['9313100', '9319101'],
    cnaeGrupos: ['93'],
    descricao: 'Academias, studios de pilates e fitness',
  },
  {
    category: 'salao_barbearia',
    cnaePrimarios: ['9602501', '9602502'],
    cnaeGrupos: ['96'],
    descricao: 'Salões de beleza e barbearias',
  },

  // ═══ ALIMENTAÇÃO ═══
  {
    category: 'restaurante',
    cnaePrimarios: ['5611201', '5611202', '5611203'],
    cnaeGrupos: ['56'],
    descricao: 'Restaurantes e estabelecimentos de alimentação',
  },
  {
    category: 'cafeteria_padaria',
    cnaePrimarios: ['5611203', '1091101', '1091102'],
    cnaeGrupos: ['56', '10'],
    descricao: 'Cafeterias, padarias e confeitarias',
  },

  // ═══ EDUCAÇÃO ═══
  {
    category: 'escola_curso',
    cnaePrimarios: ['8599604', '8599603', '8593700'],
    cnaeGrupos: ['85'],
    descricao: 'Escolas, cursos e centros de ensino',
  },
  {
    category: 'educacao_infantil',
    cnaePrimarios: ['8511200', '8512100'],
    cnaeGrupos: ['85'],
    descricao: 'Educação infantil e pré-escola',
  },

  // ═══ CONSTRUÇÃO ═══
  {
    category: 'reforma_construcao',
    cnaePrimarios: ['4330401', '4330403', '4330499'],
    cnaeGrupos: ['43', '41'],
    descricao: 'Reformas, construções e serviços de acabamento',
  },
  {
    category: 'energia_solar',
    cnaePrimarios: ['4321500', '3511500'],
    cnaeGrupos: ['43', '35'],
    descricao: 'Instalação de energia solar e geração distribuída',
  },

  // ═══ IMOBILIÁRIO ═══
  {
    category: 'imobiliaria',
    cnaePrimarios: ['6821801', '6821802', '6810201'],
    cnaeGrupos: ['68'],
    descricao: 'Imobiliárias e corretagem de imóveis',
  },

  // ═══ VAREJO ═══
  {
    category: 'varejo_fisico',
    cnaePrimarios: ['4712100', '4789099'],
    cnaeGrupos: ['47'],
    descricao: 'Comércio varejista em geral',
  },
  {
    category: 'moda_vestuario',
    cnaePrimarios: ['4781400', '4782201'],
    cnaeGrupos: ['47'],
    descricao: 'Lojas de roupas, calçados e acessórios',
  },

  // ═══ TECNOLOGIA ═══
  {
    category: 'ti_software',
    cnaePrimarios: ['6201501', '6202300', '6204000'],
    cnaeGrupos: ['62', '63'],
    descricao: 'Desenvolvimento de software e serviços de TI',
  },

  // ═══ AUTOMOTIVO ═══
  {
    category: 'automotivo',
    cnaePrimarios: ['4520001', '4520002', '4520005'],
    cnaeGrupos: ['45'],
    descricao: 'Oficinas mecânicas e serviços automotivos',
  },

  // ═══ TURISMO ═══
  {
    category: 'turismo_hotel',
    cnaePrimarios: ['5510801', '5510802', '7911200'],
    cnaeGrupos: ['55', '79'],
    descricao: 'Hotéis, pousadas e agências de turismo',
  },

  // ═══ COMMODITIES & METAIS (B2B / setor público) ═══
  {
    category: 'metais_sucata',
    cnaePrimarios: ['4687703', '4687701', '3831999', '3811400'],
    cnaeGrupos: ['46', '38'],
    descricao: 'Comércio atacadista de sucata de metais, cobre, alumínio, ferro e reciclagem',
  },
  {
    category: 'metalurgia_fundicao',
    cnaePrimarios: ['2451200', '2452100', '2511000', '2512800'],
    cnaeGrupos: ['24', '25'],
    descricao: 'Metalurgia, fundição de metais e fabricação de produtos siderúrgicos',
  },
  {
    category: 'construcao_materiais',
    cnaePrimarios: ['4744099', '4744001', '4744002', '4744003', '4679603'],
    cnaeGrupos: ['47', '46'],
    descricao: 'Comércio de materiais de construção, cimento, aço, ferragens',
  },

  // ═══ SAÚDE INSTITUCIONAL (hospitalar / setor público) ═══
  {
    category: 'hospitalar_distribuidora',
    cnaePrimarios: ['4644301', '4645101', '4645102', '4645103'],
    cnaeGrupos: ['46'],
    descricao: 'Distribuidoras de medicamentos, equipamentos e materiais hospitalares',
  },

  // ═══ SERVIÇOS B2B / B2G ═══
  {
    category: 'limpeza_conservacao',
    cnaePrimarios: ['8121400', '8122200', '8129000'],
    cnaeGrupos: ['81'],
    descricao: 'Empresas de limpeza, conservação predial e serviços terceirizados',
  },
  {
    category: 'seguranca_vigilancia',
    cnaePrimarios: ['8011101', '8012900', '8020001'],
    cnaeGrupos: ['80'],
    descricao: 'Vigilância, segurança patrimonial e monitoramento eletrônico',
  },
  {
    category: 'uniformes_epi',
    cnaePrimarios: ['1412601', '1412602', '4642701'],
    cnaeGrupos: ['14', '46'],
    descricao: 'Confecção e comércio de uniformes profissionais e EPIs',
  },
  {
    category: 'transporte_logistica',
    cnaePrimarios: ['4930202', '4930201', '5320202', '5229099'],
    cnaeGrupos: ['49', '53'],
    descricao: 'Transporte de cargas, logística, distribuição e entrega',
  },
];

// ─── LOOKUP ──────────────────────────────────────────────────────────────────

/**
 * Encontra mapeamento CNAE pela categoria Virô (exact match ou keyword).
 */
export function findCNAEMapping(categoryOrProduct: string): CNAEMapping | null {
  const input = categoryOrProduct.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Exact match por category
  const exact = CNAE_MAPPINGS.find(m => m.category === input);
  if (exact) return exact;

  // Keyword match (reutiliza sector-benchmarks keywords)
  // Importar dinamicamente para evitar circular dependency
  try {
    // Fallback: matching simples contra descricao
    for (const mapping of CNAE_MAPPINGS) {
      const desc = mapping.descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (desc.includes(input) || input.includes(mapping.category.replace(/_/g, ' '))) {
        return mapping;
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Encontra CNAE usando o findBenchmark de sector-benchmarks para matching robusto.
 */
export function findCNAEByProduct(product: string, differentiator?: string): CNAEMapping | null {
  try {
    // Usa o mesmo matching de keywords do sector-benchmarks
    const { findBenchmark } = require('@/config/sector-benchmarks');
    const bench = findBenchmark(product, differentiator);
    if (bench) {
      return CNAE_MAPPINGS.find(m => m.category === bench.category) || null;
    }
  } catch { /* module not available */ }

  return findCNAEMapping(product);
}
