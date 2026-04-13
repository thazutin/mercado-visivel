// ============================================================================
// Virô Radar — Blueprint System
// Define como cada segmento de negócio é analisado, pontuado e atendido.
// ============================================================================

/** Fontes de dados disponíveis no pipeline */
export type DataSource =
  | 'google_maps'       // Google Places API — ficha, reviews, fotos, concorrentes
  | 'serp'              // SERP scraping — posição orgânica por termo
  | 'instagram'         // Instagram do negócio
  | 'instagram_competitors' // Instagram dos concorrentes
  | 'google_trends'     // Sazonalidade e tendências de busca
  | 'google_ads'        // Google Ads Transparency — concorrentes investindo
  | 'reclame_aqui'      // Reputação cross-platform
  | 'ifood'             // Rating, reviews, posição no iFood
  | 'tripadvisor'       // Rating, reviews no TripAdvisor
  | 'mercado_livre'     // Posição, reputação, vendas no ML
  | 'linkedin'          // Perfil empresa, decisores
  | 'pncp'              // Licitações públicas (Portal Nacional)
  | 'ibge'              // População, renda, dados demográficos
  | 'site_traffic'      // Tráfego estimado (SimilarWeb/Semrush)
  | 'youtube'           // Canal do negócio
  | 'tiktok'            // Perfil TikTok
  | 'doctoralia'        // Perfil em Doctoralia (saúde)
  | 'ccee_aneel';       // Dados do setor energético

/** Canais de marketing prioritários por blueprint */
export type MarketingChannel =
  | 'google_maps'
  | 'google_ads'
  | 'google_organic'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'email_marketing'
  | 'whatsapp'
  | 'ifood'
  | 'mercado_livre'
  | 'marketplace_outros'
  | 'site'
  | 'blog_seo'
  | 'eventos'
  | 'parcerias_locais'
  | 'indicacao';

/** Tipos de ação que a máquina de crescimento pode gerar */
export type ActionType =
  | 'otimizar_google_maps'     // Ficha, fotos, categorias, descrição
  | 'responder_reviews'        // Co-pilot de respostas (já existe)
  | 'capturar_reviews'         // Pedir reviews a clientes
  | 'bio_instagram'            // Ajustar bio e perfil
  | 'posts_instagram'          // Calendário de posts
  | 'posts_linkedin'           // Posts para empresa e pessoal
  | 'video_reels'              // Roteiros de reels/stories
  | 'google_ads_setup'         // Estrutura de campanha
  | 'landing_page'             // Estrutura e copy de landing page
  | 'email_nurturing'          // Jornada de emails
  | 'whatsapp_templates'       // Mensagens prontas
  | 'white_paper'              // Paper/material técnico
  | 'evento_webinar'           // Estrutura de evento
  | 'videocast'                // Roteiro de podcast/videocast
  | 'parcerias_locais'         // Template de proposta de parceria
  | 'seo_conteudo'             // Blog posts otimizados
  | 'ifood_otimizar'           // Cardápio, fotos, promoções iFood
  | 'ml_otimizar'              // Anúncios, reputação Mercado Livre
  | 'prospeccao_b2b'           // Lista de prospects + mensagens
  | 'comparativo_expansao'     // Análise de cidades/segmentos
  | 'calendario_sazonal';      // Ações por sazonalidade

/** Configuração de uma fonte de dados no blueprint */
export interface DataSourceConfig {
  enabled: boolean;
  /** Peso na composição do score (0-1). Soma de todos deve ser ~1 */
  weight: number;
  /** Somente pra fontes que serão integradas depois */
  status: 'active' | 'planned' | 'not_applicable';
}

/** Blueprint completo de um segmento */
export interface Blueprint {
  id: string;
  label: string;                    // "Restaurante / Food Service"
  description: string;              // 1 frase descritiva
  icon: string;                     // Emoji representativo

  /** Tipo de cliente primário */
  primaryClientType: 'b2c' | 'b2b' | 'b2g' | 'mixed';

  /** Fontes de dados e seus pesos */
  dataSources: Partial<Record<DataSource, DataSourceConfig>>;

  /** Pesos do score 4D (devem somar ~1) */
  scoreWeights: {
    d1_descoberta: number;       // Busca orgânica + Maps
    d2_credibilidade: number;    // Reviews + reputação
    d3_presenca: number;         // Social + conteúdo
    d4_reputacao: number;        // NPS cross-platform + AI visibility
  };

  /** Canais de marketing em ordem de prioridade */
  channels: MarketingChannel[];

  /** Ações que fazem sentido pra esse segmento */
  actionTypes: ActionType[];

  /** Ações básicas (sempre executadas primeiro, geram percepção positiva imediata) */
  quickWins: ActionType[];

  /** Label pra benchmark ("restaurantes em SP", "clínicas em BH") */
  benchmarkTemplate: string;

  /** Palavras-chave que ajudam na classificação automática */
  keywords: string[];

  /** Se esse segmento tem sazonalidade forte */
  seasonalityRelevance: 'high' | 'medium' | 'low';

  /** Métrica principal de sucesso pra esse segmento */
  primaryKPI: string;
}
