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

/** Pilar estratégico: aposta de crescimento com plano completo */
export interface StrategicPillar {
  id: string;
  type: string;                    // 'content_engine' | 'authority' | 'prospecting' | 'expansion' | 'retention'
  title: string;                   // "Sistema de Fidelização por WhatsApp"
  description: string;             // POR QUE: cita dados reais e conecta com objetivo
  channel: string;                 // Canal primário
  priority: number;                // 1 = mais importante
  // Campos de plano de crescimento
  objective?: string;              // O que vai resolver (1 frase)
  targetMetric?: string;           // Métrica quantitativa (ex: "40% dos clientes voltando em 15 dias")
  timeline?: string;               // Timeline (ex: "30 dias setup, resultados em 60 dias")
  resources?: string;              // O que investir (tempo, dinheiro, equipe)
  risks?: string;                  // Riscos e mitigação
  tools?: string[];                // Ferramentas externas recomendadas
  /** Etapas do pilar com conteúdo pronto */
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
