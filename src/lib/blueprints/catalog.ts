// ============================================================================
// Virô Radar — Catálogo de Blueprints
// 25 blueprints cobrindo >90% dos negócios brasileiros.
// Cada blueprint define fontes de dados, pesos de score, canais e ações.
// ============================================================================

import type { Blueprint } from './types';

// ─── HELPERS ────────────────────────────────────────────────────────────
const src = (weight: number, status: 'active' | 'planned' = 'active') =>
  ({ enabled: true, weight, status } as const);
const planned = (weight: number) =>
  ({ enabled: false, weight, status: 'planned' as const });
const na = () =>
  ({ enabled: false, weight: 0, status: 'not_applicable' as const });

// ─── T1: ALTA DEMANDA, IMPLEMENTAÇÃO DIRETA ─────────────────────────

const restaurante_food: Blueprint = {
  id: 'restaurante_food',
  label: 'Restaurante / Food Service',
  description: 'Restaurantes, lanchonetes, cafeterias, bares, pizzarias, hamburguerias, docerias e delivery.',
  icon: '🍽️',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.30),
    serp: src(0.10),
    instagram: src(0.20),
    instagram_competitors: src(0.05),
    google_trends: planned(0.05),
    google_ads: planned(0.05),
    reclame_aqui: planned(0.03),
    ifood: planned(0.15),
    ibge: src(0.07),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.35, d3_presenca: 0.25, d4_reputacao: 0.15 },
  channels: ['google_maps', 'ifood', 'instagram', 'whatsapp', 'google_ads', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'ifood_otimizar', 'whatsapp_templates', 'parcerias_locais',
    'calendario_sazonal', 'google_ads_setup',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'capturar_reviews'],
  benchmarkTemplate: 'restaurantes em {region}',
  keywords: ['restaurante', 'lanchonete', 'bar', 'pizzaria', 'hamburgueria', 'cafeteria', 'doceria', 'padaria', 'confeitaria', 'sushi', 'churrascaria', 'food', 'delivery', 'cozinha', 'gastronomia', 'buffet', 'açaí', 'sorveteria', 'pastelaria'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Clientes novos por mês via Google + iFood',
};

const varejo_local: Blueprint = {
  id: 'varejo_local',
  label: 'Varejo / Comércio Local',
  description: 'Lojas físicas de varejo: roupas, calçados, presentes, pet shops, material de construção, papelarias.',
  icon: '🏪',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.30),
    serp: src(0.15),
    instagram: src(0.20),
    instagram_competitors: src(0.05),
    google_trends: planned(0.10),
    google_ads: planned(0.05),
    ibge: src(0.10),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.25, d3_presenca: 0.30, d4_reputacao: 0.15 },
  channels: ['google_maps', 'instagram', 'google_ads', 'whatsapp', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'google_ads_setup', 'whatsapp_templates', 'parcerias_locais',
    'calendario_sazonal', 'landing_page',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'capturar_reviews'],
  benchmarkTemplate: 'comércios locais em {region}',
  keywords: ['loja', 'comércio', 'varejo', 'roupa', 'calçado', 'sapataria', 'presente', 'pet shop', 'petshop', 'material de construção', 'papelaria', 'brinquedo', 'ótica', 'joalheria', 'bijuteria', 'floricultura', 'livraria', 'bazar', 'armarinho', 'magazine', 'outlet'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Visitas à loja por mês',
};

const ecommerce_marketplace: Blueprint = {
  id: 'ecommerce_marketplace',
  label: 'E-commerce / Marketplace',
  description: 'Vendedores online: Mercado Livre, Shopee, Amazon, loja própria, dropshipping.',
  icon: '🛒',
  primaryClientType: 'b2c',
  dataSources: {
    serp: src(0.25),
    google_ads: planned(0.15),
    instagram: src(0.15),
    mercado_livre: planned(0.20),
    google_trends: planned(0.10),
    site_traffic: planned(0.10),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.25, d3_presenca: 0.25, d4_reputacao: 0.15 },
  channels: ['mercado_livre', 'google_ads', 'google_organic', 'instagram', 'email_marketing', 'site'],
  actionTypes: [
    'seo_conteudo', 'google_ads_setup', 'ml_otimizar',
    'bio_instagram', 'posts_instagram', 'email_nurturing',
    'landing_page', 'calendario_sazonal', 'whatsapp_templates',
  ],
  quickWins: ['bio_instagram', 'seo_conteudo', 'ml_otimizar'],
  benchmarkTemplate: 'e-commerces de {product} no Brasil',
  keywords: ['ecommerce', 'e-commerce', 'loja virtual', 'loja online', 'mercado livre', 'shopee', 'amazon', 'dropshipping', 'marketplace', 'venda online', 'site de vendas', 'magalu', 'shopify'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Vendas mensais + ticket médio',
};

const servicos_local: Blueprint = {
  id: 'servicos_local',
  label: 'Serviços Locais',
  description: 'Prestadores de serviço com área de atendimento: encanador, eletricista, pintor, frete, limpeza, dedetização.',
  icon: '🔧',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.35),
    serp: src(0.20),
    instagram: src(0.10),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.05),
    ibge: src(0.10),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.35, d3_presenca: 0.15, d4_reputacao: 0.15 },
  channels: ['google_maps', 'google_ads', 'whatsapp', 'indicacao', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'google_ads_setup', 'whatsapp_templates', 'parcerias_locais',
    'landing_page', 'calendario_sazonal',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'capturar_reviews', 'whatsapp_templates'],
  benchmarkTemplate: 'serviços de {product} em {region}',
  keywords: ['encanador', 'eletricista', 'pintor', 'frete', 'mudança', 'limpeza', 'dedetização', 'manutenção', 'reparo', 'conserto', 'instalação', 'montagem', 'reforma', 'pedreiro', 'marceneiro', 'serralheiro', 'chaveiro', 'vidraceiro', 'jardinagem', 'piscineiro', 'ar condicionado'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Orçamentos recebidos por mês',
};

const saude_clinica: Blueprint = {
  id: 'saude_clinica',
  label: 'Saúde / Clínica',
  description: 'Clínicas, consultórios, dentistas, fisioterapeutas, psicólogos, nutricionistas, veterinários.',
  icon: '🏥',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.30),
    serp: src(0.20),
    instagram: src(0.15),
    doctoralia: planned(0.10),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.05),
    ibge: src(0.10),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.40, d3_presenca: 0.20, d4_reputacao: 0.15 },
  channels: ['google_maps', 'google_ads', 'instagram', 'indicacao', 'site'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'google_ads_setup', 'landing_page', 'seo_conteudo',
    'email_nurturing', 'whatsapp_templates',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'capturar_reviews', 'bio_instagram'],
  benchmarkTemplate: 'clínicas de {product} em {region}',
  keywords: ['clínica', 'consultório', 'dentista', 'odontologia', 'fisioterapia', 'psicólogo', 'psicóloga', 'nutricionista', 'fonoaudiólogo', 'dermatologista', 'ortopedista', 'oftalmologista', 'pediatra', 'ginecologista', 'médico', 'médica', 'terapeuta', 'veterinário', 'veterinária', 'hospital', 'laboratório', 'exames', 'saúde'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Agendamentos por mês',
};

const beleza_estetica: Blueprint = {
  id: 'beleza_estetica',
  label: 'Beleza / Estética',
  description: 'Salões, barbearias, estúdios de estética, spas, clínicas de estética, maquiagem, nail designer.',
  icon: '💇',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.25),
    serp: src(0.10),
    instagram: src(0.30),
    instagram_competitors: src(0.05),
    google_ads: planned(0.05),
    ibge: src(0.10),
    google_trends: planned(0.05),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.20, d2_credibilidade: 0.30, d3_presenca: 0.35, d4_reputacao: 0.15 },
  channels: ['instagram', 'google_maps', 'whatsapp', 'indicacao', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'whatsapp_templates', 'parcerias_locais', 'calendario_sazonal',
  ],
  quickWins: ['bio_instagram', 'otimizar_google_maps', 'responder_reviews', 'posts_instagram'],
  benchmarkTemplate: 'salões e estéticas em {region}',
  keywords: ['salão', 'barbearia', 'barbeiro', 'barba', 'cabelo', 'corte', 'cabeleireiro', 'cabeleireira', 'estética', 'spa', 'maquiagem', 'manicure', 'pedicure', 'nail', 'unha', 'depilação', 'sobrancelha', 'lash', 'extensão', 'micropigmentação', 'design', 'beleza', 'skincare', 'facial', 'corporal', 'massagem'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Agendamentos por mês via Instagram + WhatsApp',
};

const educacao_curso: Blueprint = {
  id: 'educacao_curso',
  label: 'Educação / Cursos',
  description: 'Escolas, cursos livres, idiomas, preparatórios, mentorias, treinamentos, EAD.',
  icon: '📚',
  primaryClientType: 'b2c',
  dataSources: {
    serp: src(0.25),
    google_maps: src(0.15),
    instagram: src(0.20),
    google_ads: planned(0.10),
    youtube: planned(0.10),
    google_trends: planned(0.10),
    ibge: src(0.05),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.25, d3_presenca: 0.30, d4_reputacao: 0.15 },
  channels: ['google_organic', 'instagram', 'youtube', 'google_ads', 'email_marketing', 'whatsapp'],
  actionTypes: [
    'seo_conteudo', 'bio_instagram', 'posts_instagram', 'video_reels',
    'google_ads_setup', 'landing_page', 'email_nurturing',
    'whatsapp_templates', 'calendario_sazonal',
    'otimizar_google_maps', 'responder_reviews',
  ],
  quickWins: ['bio_instagram', 'otimizar_google_maps', 'seo_conteudo', 'landing_page'],
  benchmarkTemplate: 'escolas e cursos de {product} em {region}',
  keywords: ['escola', 'curso', 'idioma', 'inglês', 'espanhol', 'preparatório', 'vestibular', 'concurso', 'mentoria', 'treinamento', 'EAD', 'online', 'aula', 'professor', 'professora', 'coaching', 'capacitação', 'certificação', 'faculdade', 'pós-graduação', 'MBA'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Matrículas por mês',
};

const profissional_liberal: Blueprint = {
  id: 'profissional_liberal',
  label: 'Profissional Liberal',
  description: 'Advogados, contadores, arquitetos, engenheiros, designers, fotógrafos, consultores independentes.',
  icon: '👔',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.20),
    serp: src(0.25),
    instagram: src(0.15),
    linkedin: planned(0.15),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.05),
    ibge: src(0.05),
    google_trends: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.30, d3_presenca: 0.25, d4_reputacao: 0.15 },
  channels: ['google_organic', 'google_maps', 'linkedin', 'instagram', 'indicacao', 'site'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'seo_conteudo', 'bio_instagram', 'posts_instagram',
    'posts_linkedin', 'landing_page', 'google_ads_setup',
    'email_nurturing',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'seo_conteudo'],
  benchmarkTemplate: 'profissionais de {product} em {region}',
  keywords: ['advogado', 'advocacia', 'escritório', 'contador', 'contabilidade', 'arquiteto', 'arquitetura', 'engenheiro', 'designer', 'fotógrafo', 'fotografia', 'consultor', 'consultoria', 'freelancer', 'autônomo', 'personal', 'coach', 'assessor', 'perito', 'tradutor', 'redator'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Clientes novos por mês',
};

const criador_cpf: Blueprint = {
  id: 'criador_cpf',
  label: 'Criador de Conteúdo / CPF',
  description: 'Influenciadores, criadores, artistas, artesãos, produtores de conteúdo que monetizam sua paixão.',
  icon: '🎨',
  primaryClientType: 'b2c',
  dataSources: {
    instagram: src(0.35),
    instagram_competitors: src(0.10),
    tiktok: planned(0.15),
    youtube: planned(0.10),
    serp: src(0.10),
    google_trends: planned(0.10),
    ibge: src(0.05),
    google_ads: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.20, d2_credibilidade: 0.15, d3_presenca: 0.50, d4_reputacao: 0.15 },
  channels: ['instagram', 'tiktok', 'youtube', 'email_marketing', 'site', 'whatsapp'],
  actionTypes: [
    'bio_instagram', 'posts_instagram', 'video_reels',
    'seo_conteudo', 'landing_page', 'email_nurturing',
    'calendario_sazonal', 'parcerias_locais',
  ],
  quickWins: ['bio_instagram', 'posts_instagram', 'video_reels'],
  benchmarkTemplate: 'criadores de {product}',
  keywords: ['criador', 'influenciador', 'influencer', 'conteúdo', 'creator', 'artesão', 'artesanato', 'artista', 'músico', 'cantor', 'podcaster', 'youtuber', 'tiktoker', 'streamer', 'produtor', 'digital', 'monetizar', 'paixão', 'hobby', 'personalidade'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Alcance + engajamento + monetização por mês',
};

const fitness_academia: Blueprint = {
  id: 'fitness_academia',
  label: 'Fitness / Academia / Esporte',
  description: 'Academias, estúdios de pilates, yoga, crossfit, personal trainers, nutrição esportiva.',
  icon: '💪',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.25),
    instagram: src(0.25),
    serp: src(0.10),
    instagram_competitors: src(0.05),
    google_ads: planned(0.10),
    ibge: src(0.10),
    google_trends: planned(0.10),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.25, d3_presenca: 0.35, d4_reputacao: 0.15 },
  channels: ['instagram', 'google_maps', 'whatsapp', 'indicacao', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'whatsapp_templates', 'parcerias_locais', 'calendario_sazonal',
    'google_ads_setup',
  ],
  quickWins: ['bio_instagram', 'otimizar_google_maps', 'responder_reviews', 'posts_instagram'],
  benchmarkTemplate: 'academias e estúdios em {region}',
  keywords: ['academia', 'pilates', 'yoga', 'crossfit', 'personal', 'trainer', 'musculação', 'funcional', 'esporte', 'natação', 'artes marciais', 'luta', 'boxe', 'dança', 'spinning', 'studio', 'estúdio'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Matrículas novas por mês',
};

// ─── T2: B2B ────────────────────────────────────────────────────────

const vending_machine_b2b: Blueprint = {
  id: 'vending_machine_b2b',
  label: 'Vending Machine / Auto-serviço B2B',
  description: 'Operadores de vending de snacks, café ou bebidas que instalam máquinas em empresas (modelo B2B, decisor em Facilities/RH).',
  icon: '🥤',
  primaryClientType: 'b2b',
  dataSources: {
    linkedin: planned(0.30),    // decisor + perfil das empresas-alvo
    serp: src(0.10),
    google_maps: src(0.10),     // localizar empresas no raio
    instagram: src(0.15),       // awareness + cases visuais
    instagram_competitors: src(0.10),
    site_traffic: planned(0.05),
    google_trends: planned(0.05),
    pncp: planned(0.05),        // licitações governo/SP
    ibge: src(0.10),            // densidade empresas no raio
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.20, d3_presenca: 0.30, d4_reputacao: 0.25 },
  channels: ['linkedin', 'parcerias_locais', 'instagram', 'indicacao', 'eventos', 'email_marketing'],
  actionTypes: [
    'posts_linkedin', 'prospeccao_b2b',
    'parcerias_locais', 'posts_instagram', 'video_reels',
    'evento_webinar', 'white_paper',
    'landing_page', 'email_nurturing',
    'bio_instagram', 'whatsapp_templates',
  ],
  // Sem quick wins de Google Ads ou capturar_reviews — não fazem sentido pro modelo B2B vending
  quickWins: ['posts_linkedin', 'bio_instagram', 'landing_page'],
  benchmarkTemplate: 'operadores de vending B2B em {region}',
  keywords: [
    'vending', 'vending machine', 'vending machines',
    'máquina automática', 'máquina de snacks', 'máquina de café',
    'auto-serviço', 'autosserviço', 'auto serviço',
    'balcão urbano', 'balcao urbano',
    'snacks empresa', 'snacks corporativo',
    'café corporativo', 'cafe corporativo',
  ],
  seasonalityRelevance: 'low',
  primaryKPI: 'Pontos ativos × ticket médio mensal por ponto',

  // ─── Lente cirúrgica pra B2B vending ──────────────────────────────────
  seedTerms: [
    'vending machine snacks empresa',
    'máquina automática snacks escritório',
    'snack break corporativo',
    'auto-serviço alimentação fábrica',
    'vending café corporativo',
    'máquina de venda automática empresa',
    'fornecedor vending machine',
    'instalar máquina snacks sem custo',
  ],

  // CNAEs das EMPRESAS-ALVO (não dos concorrentes). Hunter+Brasil.io vão
  // retornar essas empresas pra montar pipeline de prospecção real.
  // Indústrias gerais (10-33), logística (49-53), TI e BPO (62, 82),
  // saúde 86), educação superior (85), construção corporativa (41).
  clientTargetCnaes: [
    '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
    '41', '42', '43',
    '49', '50', '51', '52', '53',
    '62', '63',
    '82', '85', '86',
  ],
  clientTargetLabel: 'Galpões logísticos, indústrias, escritórios corporativos, hospitais e instituições com 50+ funcionários',

  // Quick wins cirúrgicos pra vending B2B — substituem os templates genéricos.
  customQuickWins: [
    {
      id: 'qw-vending-prediomap',
      title: 'Mapear 10 prédios corporativos no raio de 3km',
      description: 'Lista priorizada de empresas-alvo (50+ funcionários) com decisor identificado. Foco em galpões logísticos, indústrias, escritórios de TI e hospitais.',
      impact: '+10 pts Pipeline B2B',
      timeEstimate: '~30 min',
      steps: [
        'Abra Google Maps, filtra "indústrias", "logística", "centros administrativos" no seu raio',
        'Pra cada prédio: pegue nome da empresa principal e endereço',
        'Cruze com LinkedIn — busca "Facilities" ou "Operações" + nome da empresa',
        'Anota: empresa · decisor · cargo · URL LinkedIn em uma planilha',
        'Priorize: empresas com 50-300 funcionários (sweet spot pra vending B2B)',
      ],
    },
    {
      id: 'qw-vending-qrindicacao',
      title: 'Imprimir QR code "Indique seu prédio" no ponto mais bem-sucedido',
      description: 'Cada cliente atendido conhece outras empresas que poderiam ter vending. Transforme satisfação em pipeline com 1 ação de baixo custo.',
      impact: '+5 pts Indicação',
      timeEstimate: '~20 min',
      steps: [
        'No Canva, crie cartão A5 com QR code linkando pra wa.me/SEU_NUMERO?text=Quero+indicar+um+predio',
        'Texto curto: "Indique um prédio com vending e ganhe X reais em snacks free quando virar ponto ativo"',
        'Imprima 5 unidades e fixe no ponto que mais rende',
        'Track: cada indicação que vira ponto = referência interna do que funciona pra captar',
      ],
      copyReady: 'Conheço um prédio que adoraria ter máquinas como essas. Quem é o contato pra eu fazer a apresentação?',
    },
    {
      id: 'qw-vending-linkedin-decisor',
      title: 'Otimizar perfil LinkedIn pra ser encontrado por Facilities',
      description: 'Decisor de Facilities/RH usa LinkedIn pra pesquisar fornecedores. Headline e Sobre certos te colocam em buscas de "vending empresa".',
      impact: '+7 pts Visibilidade B2B',
      timeEstimate: '~20 min',
      steps: [
        'Headline: "Operação Balcão Urbano | Vending corporativo sem custo de instalação"',
        'Sobre: 3 frases: (1) o que faz (2) pra quem (Facilities, RH, indústrias 50+ funcionários) (3) o diferencial (sem custo de instalação)',
        'Adicione 3 fotos: 1 da máquina instalada em ponto real, 1 do seu time, 1 da variedade de snacks',
        'Conecte com 20 pessoas com cargo "Facilities", "Operações", "RH" em empresas do seu raio',
      ],
    },
  ],
};

const b2b_servicos: Blueprint = {
  id: 'b2b_servicos',
  label: 'Serviços B2B',
  description: 'Empresas que vendem serviços para outras empresas: TI, RH, contabilidade, marketing, jurídico.',
  icon: '🏢',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    linkedin: planned(0.25),
    google_ads: planned(0.15),
    site_traffic: planned(0.10),
    instagram: src(0.05),
    google_maps: src(0.10),
    reclame_aqui: planned(0.05),
    google_trends: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.25, d3_presenca: 0.20, d4_reputacao: 0.20 },
  channels: ['linkedin', 'google_organic', 'google_ads', 'email_marketing', 'site', 'eventos'],
  actionTypes: [
    'seo_conteudo', 'posts_linkedin', 'google_ads_setup',
    'landing_page', 'email_nurturing', 'white_paper',
    'evento_webinar', 'prospeccao_b2b',
    'otimizar_google_maps', 'responder_reviews',
  ],
  quickWins: ['otimizar_google_maps', 'seo_conteudo', 'posts_linkedin', 'landing_page'],
  benchmarkTemplate: 'empresas de {product} B2B',
  keywords: ['B2B', 'empresarial', 'corporativo', 'outsourcing', 'terceirização', 'SaaS', 'software', 'TI', 'tecnologia', 'RH', 'recursos humanos', 'recrutamento', 'consultoria empresarial', 'gestão', 'ERP', 'CRM'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Leads qualificados por mês',
};

const b2b_industria: Blueprint = {
  id: 'b2b_industria',
  label: 'Indústria / Manufatura',
  description: 'Fábricas, indústrias, manufatura que vendem para outras empresas ou distribuidores.',
  icon: '🏭',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    google_ads: planned(0.15),
    linkedin: planned(0.20),
    pncp: src(0.10),
    site_traffic: planned(0.10),
    google_maps: src(0.10),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.25, d3_presenca: 0.15, d4_reputacao: 0.25 },
  channels: ['google_organic', 'linkedin', 'google_ads', 'email_marketing', 'eventos', 'site'],
  actionTypes: [
    'seo_conteudo', 'posts_linkedin', 'google_ads_setup',
    'landing_page', 'email_nurturing', 'white_paper',
    'evento_webinar', 'videocast', 'prospeccao_b2b',
    'otimizar_google_maps',
  ],
  quickWins: ['otimizar_google_maps', 'seo_conteudo', 'posts_linkedin'],
  benchmarkTemplate: 'indústrias de {product}',
  keywords: ['indústria', 'fábrica', 'manufatura', 'produção', 'fabricante', 'fornecedor', 'distribuidor', 'atacado', 'matéria-prima', 'embalagem', 'metalúrgica', 'química', 'plástico', 'têxtil', 'alimentos', 'bebidas'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Contratos novos por trimestre',
};

const b2b_tecnologia: Blueprint = {
  id: 'b2b_tecnologia',
  label: 'Tecnologia / SaaS',
  description: 'Startups, SaaS, plataformas digitais, apps, fintechs, healthtechs.',
  icon: '💻',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    google_ads: planned(0.15),
    linkedin: planned(0.20),
    site_traffic: planned(0.15),
    instagram: src(0.05),
    google_trends: planned(0.10),
    reclame_aqui: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.20, d3_presenca: 0.25, d4_reputacao: 0.20 },
  channels: ['google_organic', 'linkedin', 'google_ads', 'email_marketing', 'site', 'blog_seo', 'eventos'],
  actionTypes: [
    'seo_conteudo', 'posts_linkedin', 'google_ads_setup',
    'landing_page', 'email_nurturing', 'white_paper',
    'evento_webinar', 'videocast', 'prospeccao_b2b',
    'bio_instagram', 'posts_instagram',
  ],
  quickWins: ['seo_conteudo', 'posts_linkedin', 'landing_page', 'email_nurturing'],
  benchmarkTemplate: 'empresas de tecnologia em {product}',
  keywords: ['SaaS', 'startup', 'app', 'aplicativo', 'plataforma', 'software', 'fintech', 'healthtech', 'edtech', 'proptech', 'legaltech', 'agritech', 'martech', 'API', 'cloud', 'IA', 'inteligência artificial', 'automação'],
  seasonalityRelevance: 'low',
  primaryKPI: 'MRR + leads qualificados',
};

const b2b_energia: Blueprint = {
  id: 'b2b_energia',
  label: 'Energia / Utilities',
  description: 'Trading de energia, solar, eólica, GD, eficiência energética, utilities.',
  icon: '⚡',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    google_ads: planned(0.15),
    linkedin: planned(0.20),
    pncp: src(0.10),
    ccee_aneel: planned(0.15),
    site_traffic: planned(0.05),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.20, d3_presenca: 0.15, d4_reputacao: 0.30 },
  channels: ['linkedin', 'google_organic', 'google_ads', 'email_marketing', 'eventos', 'site'],
  actionTypes: [
    'seo_conteudo', 'posts_linkedin', 'google_ads_setup',
    'landing_page', 'email_nurturing', 'white_paper',
    'evento_webinar', 'videocast', 'prospeccao_b2b',
  ],
  quickWins: ['seo_conteudo', 'posts_linkedin', 'landing_page', 'white_paper'],
  benchmarkTemplate: 'empresas de energia em {region}',
  keywords: ['energia', 'solar', 'eólica', 'fotovoltaica', 'GD', 'geração distribuída', 'mercado livre', 'ACL', 'ACR', 'trading', 'comercializadora', 'eficiência energética', 'sustentabilidade', 'ESG', 'utility', 'elétrica'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Contratos novos + MW comercializados',
};

const agencia_consultoria: Blueprint = {
  id: 'agencia_consultoria',
  label: 'Agência / Consultoria de Marketing',
  description: 'Agências de marketing, publicidade, branding, PR, performance, social media.',
  icon: '📊',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    instagram: src(0.20),
    linkedin: planned(0.20),
    site_traffic: planned(0.10),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.05),
    google_trends: planned(0.05),
    google_maps: src(0.05),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.25, d3_presenca: 0.30, d4_reputacao: 0.15 },
  channels: ['instagram', 'linkedin', 'google_organic', 'site', 'indicacao', 'eventos'],
  actionTypes: [
    'bio_instagram', 'posts_instagram', 'video_reels',
    'posts_linkedin', 'seo_conteudo', 'landing_page',
    'email_nurturing', 'white_paper', 'evento_webinar',
    'videocast', 'otimizar_google_maps',
  ],
  quickWins: ['bio_instagram', 'posts_linkedin', 'seo_conteudo', 'otimizar_google_maps'],
  benchmarkTemplate: 'agências de {product}',
  keywords: ['agência', 'agencia', 'publicidade', 'propaganda', 'marketing digital', 'performance', 'social media', 'branding', 'design', 'criação', 'mídia', 'assessoria de imprensa', 'PR', 'relações públicas', 'tráfego pago'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Clientes ativos + MRR',
};

// ─── T3: NICHO ──────────────────────────────────────────────────────

const imobiliaria: Blueprint = {
  id: 'imobiliaria',
  label: 'Imobiliária / Corretor',
  description: 'Imobiliárias, corretores, construtoras, incorporadoras, administradoras de imóveis.',
  icon: '🏠',
  primaryClientType: 'b2c',
  dataSources: {
    serp: src(0.25),
    google_maps: src(0.15),
    google_ads: planned(0.15),
    instagram: src(0.15),
    site_traffic: planned(0.10),
    google_trends: planned(0.10),
    ibge: src(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.25, d3_presenca: 0.25, d4_reputacao: 0.15 },
  channels: ['google_organic', 'google_ads', 'instagram', 'site', 'google_maps', 'email_marketing'],
  actionTypes: [
    'seo_conteudo', 'google_ads_setup', 'bio_instagram', 'posts_instagram',
    'video_reels', 'landing_page', 'email_nurturing',
    'otimizar_google_maps', 'responder_reviews', 'calendario_sazonal',
  ],
  quickWins: ['otimizar_google_maps', 'bio_instagram', 'seo_conteudo', 'responder_reviews'],
  benchmarkTemplate: 'imobiliárias em {region}',
  keywords: ['imobiliária', 'corretor', 'imóvel', 'imóveis', 'apartamento', 'casa', 'terreno', 'aluguel', 'locação', 'venda', 'construtora', 'incorporadora', 'condomínio', 'loteamento', 'lançamento'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Leads qualificados por mês',
};

const telecom_isp: Blueprint = {
  id: 'telecom_isp',
  label: 'Telecom / Provedor de Internet',
  description: 'Provedores de internet, telefonia, TV por assinatura, ISPs regionais.',
  icon: '📡',
  primaryClientType: 'b2c',
  dataSources: {
    serp: src(0.25),
    google_maps: src(0.20),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.15),
    ibge: src(0.15),
    instagram: src(0.05),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.35, d3_presenca: 0.15, d4_reputacao: 0.20 },
  channels: ['google_organic', 'google_maps', 'google_ads', 'whatsapp', 'parcerias_locais', 'indicacao'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'google_ads_setup', 'seo_conteudo', 'landing_page',
    'parcerias_locais', 'whatsapp_templates',
    'comparativo_expansao', 'calendario_sazonal',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'capturar_reviews', 'landing_page'],
  benchmarkTemplate: 'provedores de internet em {region}',
  keywords: ['internet', 'provedor', 'ISP', 'fibra', 'banda larga', 'wifi', 'telecom', 'telefonia', 'TV', 'streaming', 'rede', 'conectividade'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Assinantes novos por mês + churn',
};

const turismo_hotelaria: Blueprint = {
  id: 'turismo_hotelaria',
  label: 'Turismo / Hotelaria',
  description: 'Hotéis, pousadas, hostels, agências de viagem, guias turísticos, experiências.',
  icon: '🏨',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.25),
    serp: src(0.15),
    tripadvisor: planned(0.15),
    instagram: src(0.15),
    google_ads: planned(0.10),
    google_trends: planned(0.10),
    ibge: src(0.05),
    reclame_aqui: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.35, d3_presenca: 0.25, d4_reputacao: 0.15 },
  channels: ['google_maps', 'google_organic', 'instagram', 'google_ads', 'site', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'seo_conteudo', 'google_ads_setup', 'landing_page',
    'parcerias_locais', 'calendario_sazonal', 'email_nurturing',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'calendario_sazonal'],
  benchmarkTemplate: 'hotéis e pousadas em {region}',
  keywords: ['hotel', 'pousada', 'hostel', 'hospedagem', 'resort', 'turismo', 'viagem', 'agência de viagem', 'guia', 'passeio', 'experiência', 'chalé', 'camping', 'glamping', 'airbnb'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Taxa de ocupação + reservas diretas',
};

const construcao_reforma: Blueprint = {
  id: 'construcao_reforma',
  label: 'Construção / Reforma',
  description: 'Construtoras, empreiteiras, reformas, acabamentos, paisagismo, piscinas, decoração.',
  icon: '🏗️',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.25),
    serp: src(0.25),
    instagram: src(0.15),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.05),
    ibge: src(0.10),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.30, d3_presenca: 0.20, d4_reputacao: 0.15 },
  channels: ['google_organic', 'google_maps', 'instagram', 'google_ads', 'indicacao', 'site'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'seo_conteudo', 'google_ads_setup', 'landing_page',
    'whatsapp_templates', 'parcerias_locais',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'seo_conteudo'],
  benchmarkTemplate: 'empresas de {product} em {region}',
  keywords: ['construção', 'reforma', 'empreiteira', 'construtora', 'pedreiro', 'acabamento', 'pintura', 'gesso', 'drywall', 'paisagismo', 'piscina', 'decoração', 'design de interiores', 'móveis planejados', 'marcenaria', 'elétrica', 'hidráulica', 'telhado'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Orçamentos fechados por mês',
};

const juridico_advocacia: Blueprint = {
  id: 'juridico_advocacia',
  label: 'Jurídico / Advocacia',
  description: 'Escritórios de advocacia, advogados especializados, mediação, compliance.',
  icon: '⚖️',
  primaryClientType: 'mixed',
  dataSources: {
    serp: src(0.30),
    google_maps: src(0.15),
    google_ads: planned(0.15),
    linkedin: planned(0.15),
    site_traffic: planned(0.10),
    instagram: src(0.05),
    reclame_aqui: planned(0.05),
    google_trends: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.30, d3_presenca: 0.15, d4_reputacao: 0.20 },
  channels: ['google_organic', 'google_ads', 'linkedin', 'google_maps', 'site', 'indicacao'],
  actionTypes: [
    'seo_conteudo', 'google_ads_setup', 'posts_linkedin',
    'landing_page', 'otimizar_google_maps', 'responder_reviews',
    'email_nurturing', 'white_paper', 'bio_instagram',
  ],
  quickWins: ['otimizar_google_maps', 'seo_conteudo', 'responder_reviews', 'posts_linkedin'],
  benchmarkTemplate: 'escritórios de advocacia em {region}',
  keywords: ['advogado', 'advocacia', 'jurídico', 'escritório de advocacia', 'direito', 'trabalhista', 'tributário', 'civil', 'criminal', 'empresarial', 'previdenciário', 'família', 'consumidor', 'compliance', 'mediação', 'arbitragem', 'LGPD'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Consultas iniciais por mês',
};

const contabilidade: Blueprint = {
  id: 'contabilidade',
  label: 'Contabilidade',
  description: 'Escritórios contábeis, contadores, BPO financeiro, abertura de empresa.',
  icon: '🧮',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.30),
    google_maps: src(0.20),
    google_ads: planned(0.15),
    linkedin: planned(0.10),
    site_traffic: planned(0.05),
    reclame_aqui: planned(0.05),
    google_trends: planned(0.10),
    ibge: src(0.05),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.30, d3_presenca: 0.15, d4_reputacao: 0.20 },
  channels: ['google_organic', 'google_maps', 'google_ads', 'linkedin', 'indicacao', 'site'],
  actionTypes: [
    'seo_conteudo', 'google_ads_setup', 'otimizar_google_maps',
    'responder_reviews', 'capturar_reviews', 'posts_linkedin',
    'landing_page', 'email_nurturing', 'calendario_sazonal',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'seo_conteudo', 'capturar_reviews'],
  benchmarkTemplate: 'contabilidades em {region}',
  keywords: ['contabilidade', 'contador', 'escritório contábil', 'BPO', 'financeiro', 'fiscal', 'imposto', 'declaração', 'IRPF', 'MEI', 'abertura de empresa', 'CNPJ', 'folha de pagamento', 'DP', 'departamento pessoal'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Clientes ativos na carteira',
};

const franquia_rede: Blueprint = {
  id: 'franquia_rede',
  label: 'Franquia / Rede',
  description: 'Franquias, redes com múltiplas unidades, licenciamento de marca.',
  icon: '🔗',
  primaryClientType: 'mixed',
  dataSources: {
    google_maps: src(0.20),
    serp: src(0.20),
    instagram: src(0.15),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.10),
    site_traffic: planned(0.10),
    ibge: src(0.10),
    google_trends: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.30, d3_presenca: 0.25, d4_reputacao: 0.20 },
  channels: ['google_maps', 'instagram', 'google_ads', 'google_organic', 'site', 'email_marketing'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'google_ads_setup',
    'seo_conteudo', 'landing_page', 'email_nurturing',
    'comparativo_expansao',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'bio_instagram', 'comparativo_expansao'],
  benchmarkTemplate: 'franquias de {product} em {region}',
  keywords: ['franquia', 'franqueado', 'franqueador', 'rede', 'filial', 'unidade', 'licenciamento', 'marca', 'padronização', 'expansão', 'multi-unidade', 'master franquia'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Performance por unidade + expansão',
};

const pet_veterinario: Blueprint = {
  id: 'pet_veterinario',
  label: 'Pet / Veterinário',
  description: 'Pet shops, clínicas veterinárias, banho e tosa, dog walkers, creches pet.',
  icon: '🐾',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.30),
    instagram: src(0.25),
    serp: src(0.10),
    google_ads: planned(0.05),
    reclame_aqui: planned(0.05),
    ibge: src(0.10),
    google_trends: planned(0.10),
    instagram_competitors: src(0.05),
  },
  scoreWeights: { d1_descoberta: 0.25, d2_credibilidade: 0.30, d3_presenca: 0.30, d4_reputacao: 0.15 },
  channels: ['instagram', 'google_maps', 'whatsapp', 'indicacao', 'parcerias_locais'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'bio_instagram', 'posts_instagram', 'video_reels',
    'whatsapp_templates', 'parcerias_locais', 'calendario_sazonal',
  ],
  quickWins: ['bio_instagram', 'otimizar_google_maps', 'responder_reviews', 'posts_instagram'],
  benchmarkTemplate: 'pet shops e veterinárias em {region}',
  keywords: ['pet', 'petshop', 'pet shop', 'veterinário', 'veterinária', 'vet', 'banho e tosa', 'dog walker', 'creche pet', 'hotel pet', 'ração', 'acessório pet', 'adestramento', 'comportamento animal'],
  seasonalityRelevance: 'medium',
  primaryKPI: 'Clientes recorrentes por mês',
};

const automotivo: Blueprint = {
  id: 'automotivo',
  label: 'Automotivo',
  description: 'Oficinas, concessionárias, autopeças, funilarias, lava-rápido, estacionamentos.',
  icon: '🚗',
  primaryClientType: 'b2c',
  dataSources: {
    google_maps: src(0.35),
    serp: src(0.20),
    google_ads: planned(0.10),
    reclame_aqui: planned(0.10),
    instagram: src(0.05),
    ibge: src(0.10),
    google_trends: planned(0.10),
  },
  scoreWeights: { d1_descoberta: 0.35, d2_credibilidade: 0.35, d3_presenca: 0.10, d4_reputacao: 0.20 },
  channels: ['google_maps', 'google_organic', 'google_ads', 'whatsapp', 'indicacao'],
  actionTypes: [
    'otimizar_google_maps', 'responder_reviews', 'capturar_reviews',
    'google_ads_setup', 'seo_conteudo', 'whatsapp_templates',
    'landing_page', 'parcerias_locais',
  ],
  quickWins: ['otimizar_google_maps', 'responder_reviews', 'capturar_reviews', 'whatsapp_templates'],
  benchmarkTemplate: 'oficinas e autopeças em {region}',
  keywords: ['oficina', 'mecânico', 'mecânica', 'concessionária', 'autopeças', 'funilaria', 'pintura', 'lava-rápido', 'lava jato', 'estacionamento', 'pneu', 'borracharia', 'elétrica automotiva', 'retífica', 'escapamento', 'suspensão', 'freio'],
  seasonalityRelevance: 'low',
  primaryKPI: 'Ordens de serviço por mês',
};

const agro_rural: Blueprint = {
  id: 'agro_rural',
  label: 'Agro / Rural',
  description: 'Agronegócio, revendas agrícolas, cooperativas, agroindústria, pecuária, insumos.',
  icon: '🌾',
  primaryClientType: 'b2b',
  dataSources: {
    serp: src(0.25),
    google_ads: planned(0.10),
    linkedin: planned(0.15),
    google_maps: src(0.10),
    pncp: src(0.10),
    ibge: src(0.15),
    google_trends: planned(0.10),
    site_traffic: planned(0.05),
  },
  scoreWeights: { d1_descoberta: 0.30, d2_credibilidade: 0.25, d3_presenca: 0.15, d4_reputacao: 0.30 },
  channels: ['google_organic', 'linkedin', 'eventos', 'indicacao', 'whatsapp', 'email_marketing'],
  actionTypes: [
    'seo_conteudo', 'posts_linkedin', 'landing_page',
    'email_nurturing', 'white_paper', 'evento_webinar',
    'prospeccao_b2b', 'otimizar_google_maps',
    'calendario_sazonal', 'whatsapp_templates',
  ],
  quickWins: ['otimizar_google_maps', 'seo_conteudo', 'posts_linkedin', 'calendario_sazonal'],
  benchmarkTemplate: 'empresas agro em {region}',
  keywords: ['agro', 'agrícola', 'agricultura', 'pecuária', 'fazenda', 'sítio', 'cooperativa', 'revenda agrícola', 'insumo', 'semente', 'fertilizante', 'defensivo', 'irrigação', 'máquina agrícola', 'safra', 'colheita', 'agroindústria', 'laticínio'],
  seasonalityRelevance: 'high',
  primaryKPI: 'Volume de vendas por safra',
};

// ─── CATÁLOGO COMPLETO ──────────────────────────────────────────────

export const BLUEPRINT_CATALOG: Blueprint[] = [
  // T1: Alta demanda
  restaurante_food,
  varejo_local,
  ecommerce_marketplace,
  servicos_local,
  saude_clinica,
  beleza_estetica,
  educacao_curso,
  profissional_liberal,
  criador_cpf,
  fitness_academia,
  // T2: B2B
  vending_machine_b2b,
  b2b_servicos,
  b2b_industria,
  b2b_tecnologia,
  b2b_energia,
  agencia_consultoria,
  // T3: Nicho
  imobiliaria,
  telecom_isp,
  turismo_hotelaria,
  construcao_reforma,
  juridico_advocacia,
  contabilidade,
  franquia_rede,
  pet_veterinario,
  automotivo,
  agro_rural,
];

/** Lookup rápido por ID */
export const BLUEPRINT_MAP = Object.fromEntries(
  BLUEPRINT_CATALOG.map(bp => [bp.id, bp]),
) as Record<string, Blueprint>;

/** Fallback quando classificação falha */
export const DEFAULT_BLUEPRINT_ID = 'servicos_local';

/** Todos os keywords de todos os blueprints (pra matching rápido) */
export const ALL_KEYWORDS = BLUEPRINT_CATALOG.flatMap(bp =>
  bp.keywords.map(kw => ({ keyword: kw.toLowerCase(), blueprintId: bp.id })),
);
