// ============================================================================
// Virô Radar — Growth Machine Types
// Estrutura da máquina de crescimento: ações quick-win, pilares estratégicos,
// provocações de crescimento, e KPIs.
// ============================================================================

/** Ação quick-win: básica, executável hoje, gera percepção positiva imediata */
export interface QuickWinAction {
  id: string;
  type: string;                    // ActionType do blueprint
  title: string;                   // "Otimizar ficha do Google Meu Negócio"
  description: string;             // Dado real: "Sua ficha tem 0 fotos, média do setor: 12"
  impact: string;                  // "+8pts Credibilidade"
  timeEstimate: string;            // "~15 min"
  steps: string[];                 // Passo a passo concreto
  copyReady?: string;              // Texto pronto pra copiar/colar
  /** Conteúdo gerado completo (preenchido após "Gerar conteúdo") */
  generatedContent?: any;
}

/** Pilar estratégico: operação montada (paper, evento, posts, etc.) */
export interface StrategicPillar {
  id: string;
  type: string;                    // 'content_engine' | 'authority' | 'prospecting' | 'expansion'
  title: string;                   // "Motor de Conteúdo Instagram"
  description: string;             // "Calendário de 12 posts baseado nos temas..."
  channel: string;                 // Canal primário
  priority: number;                // 1 = mais importante
  /** Itens gerados dentro do pilar */
  items: StrategicItem[];
  /** KPI do pilar */
  kpi: { metric: string; target: string; timeframe: string };
}

export interface StrategicItem {
  id: string;
  title: string;
  type: 'copy' | 'template' | 'structure' | 'checklist' | 'script';
  content: string;                 // Conteúdo pronto
  copyable: boolean;               // Pode copiar/colar?
}

/** Provocação de crescimento: baseada em dados reais, direciona análise */
export interface GrowthProvocation {
  id: string;
  insight: string;                 // "Há 3 cidades vizinhas com menos concorrência"
  dataSource: string;              // De onde veio o insight
  actionLabel: string;             // "Explorar essa oportunidade"
  analysisType: string;            // 'expansion' | 'segment' | 'competitor' | 'seasonal'
}

/** Resultado completo da máquina de crescimento */
export interface GrowthMachineResult {
  blueprintId: string;
  blueprintLabel: string;

  /** Score com benchmark do setor */
  score: {
    current: number;
    benchmark: number;             // Média do setor na região
    benchmarkLabel: string;        // "restaurantes em Campinas"
    gap: number;                   // benchmark - current
  };

  /** Ações básicas (sempre primeiro, geram percepção positiva) */
  quickWins: QuickWinAction[];

  /** Pilares estratégicos (operação montada) */
  strategicPillars: StrategicPillar[];

  /** Provocações de crescimento (baseadas em dados reais) */
  provocations: GrowthProvocation[];

  /** KPIs gerais do plano */
  kpis: {
    thirtyDay: string;
    ninetyDay: string;
    primaryMetric: string;
  };

  /** Metadados */
  generatedAt: string;
  weekNumber: number;
}
