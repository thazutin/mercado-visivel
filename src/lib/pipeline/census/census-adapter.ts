// ============================================================================
// Census Adapter — Interface para dados censitários multi-país
// Permite internacionalização do módulo de audiência estimada
// ============================================================================

/**
 * Resultado padronizado de consulta censitária.
 * Independe do país de origem — todos os adapters retornam este formato.
 */
export interface CensusResult {
  /** População do município/cidade */
  populacao: number;
  /** Nome do município/cidade */
  municipioNome: string;
  /** Identificador do município na fonte oficial (ex: código IBGE, FIPS, etc.) */
  municipioId: string;
  /** Estado/província/região administrativa */
  estado: string;
  /** Ano de referência dos dados */
  ano: number;
  /** Nome da fonte de dados (ex: "IBGE", "INE Portugal", "US Census Bureau") */
  fonte: string;
}

/**
 * Interface que todo adapter de censo deve implementar.
 * Cada país tem sua própria implementação com a API oficial correspondente.
 */
export interface CensusAdapter {
  /**
   * Busca população de uma cidade/município pelo nome.
   * Retorna null se não encontrar ou se a API estiver indisponível.
   */
  getPopulation(city: string, state: string): Promise<CensusResult | null>;

  /** População total do país (valor estático para cálculos nacionais) */
  getNationalPopulation(): number;

  /** Nome do país em português */
  getCountryName(): string;
}
